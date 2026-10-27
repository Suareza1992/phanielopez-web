// F1 Girlies PR community: watch parties (RSVP), the race-weekend "Quiniela", and the photo wall.
// Nobody needs an account:
//   • RSVP = name + Instagram handle or phone. The visitor gets a private cancel link (shown on screen).
//   • Quiniela = nickname + Instagram handle. A random device cookie lets the same device change its
//     pick until qualifying starts; nobody else can overwrite it.
//   • Photos sent by visitors stay private until the owner approves them in /admin.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import express from 'express';
import { db, tx, ROOT, DATA_DIR, UPLOAD_DIR } from './db.js';
import { requireUser, limiter, sha256 } from './auth.js';

export const community = express.Router();
const PENDING_DIR = path.join(DATA_DIR, 'pending');
fs.mkdirSync(PENDING_DIR, { recursive: true });

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id         INTEGER PRIMARY KEY,
    title      TEXT NOT NULL DEFAULT '',
    race_round INTEGER,                         -- optional link to the F1 calendar
    starts_at  TEXT NOT NULL,                   -- ISO, UTC
    venue      TEXT NOT NULL,
    address    TEXT NOT NULL DEFAULT '',
    map_url    TEXT NOT NULL DEFAULT '',
    capacity   INTEGER NOT NULL DEFAULT 0,      -- people (incl. guests); 0 = no limit
    notes      TEXT NOT NULL DEFAULT '',
    published  INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS rsvps (
    id          INTEGER PRIMARY KEY,
    event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    contact     TEXT NOT NULL,                  -- as shown to the owner: @handle or phone
    contact_key TEXT NOT NULL,                  -- normalised, one RSVP per person per event
    guests      INTEGER NOT NULL DEFAULT 0,
    status      TEXT NOT NULL CHECK (status IN ('confirmed', 'waitlist', 'cancelled')),
    token_hash  TEXT NOT NULL UNIQUE,           -- cancel link (only its SHA-256 is stored)
    created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (event_id, contact_key)
  );
  CREATE TABLE IF NOT EXISTS predictions (
    id         INTEGER PRIMARY KEY,
    round      INTEGER NOT NULL,
    nickname   TEXT NOT NULL,
    handle     TEXT NOT NULL,                   -- Instagram handle, lowercase; one pick per race
    p1         TEXT NOT NULL,
    p2         TEXT NOT NULL,
    p3         TEXT NOT NULL,
    token_hash TEXT NOT NULL,                   -- the device that made it can edit it
    hidden     INTEGER NOT NULL DEFAULT 0,      -- owner can hide an entry (spam, rude nickname)
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (round, handle)
  );
  CREATE TABLE IF NOT EXISTS photos (
    id          INTEGER PRIMARY KEY,
    file        TEXT NOT NULL,                  -- pending: name in DATA_DIR/pending · approved: /uploads/<name>
    caption     TEXT NOT NULL DEFAULT '',
    credit      TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL CHECK (status IN ('pending', 'approved')),
    source      TEXT NOT NULL CHECK (source IN ('admin', 'member')),
    created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    approved_at TEXT
  );
  -- Small cache for data fetched from the F1 API (grid, results), so restarts don't refetch.
  CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL);
`);

const HOUR = 36e5;
const bad = (res, error, status = 400) => res.status(status).json({ error });
const plain = (v, max) => String(v ?? '').replace(/[<>\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const newToken = () => crypto.randomBytes(24).toString('hex');
const hp = (req) => Boolean(req.body?.website); // honeypot: a hidden field only bots fill in

const rsvpLimit = limiter({ windowMs: HOUR, max: 12 });
const pickLimit = limiter({ windowMs: HOUR, max: 30 });
const photoLimit = limiter({ windowMs: HOUR, max: 6 });
const MAX_PENDING = 100;

/* ---------- F1 calendar, grid and results ---------- */

// The browser's calendar file is the single source of truth for race names and session times.
let calendar = null;
function races() {
  if (!calendar || process.env.NODE_ENV !== 'production') {
    const code = fs.readFileSync(path.join(ROOT, 'public', 'f1-2026.js'), 'utf8');
    const sandbox = { window: {} };
    vm.runInNewContext(code, sandbox, { timeout: 200 });
    calendar = sandbox.window.F1_2026 || [];
  }
  return calendar;
}
const raceByRound = (n) => races().find((r) => r.round === Number(n));

const API = 'https://api.jolpi.ca/ergast/f1/2026';
async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(6000), headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
// Cached fetch: fresh enough → cache; otherwise refetch; on failure → stale cache or fallback.
const inflight = new Map();
async function cached(key, ttl, load, fallback) {
  const row = db.prepare('SELECT value, updated_at FROM kv WHERE key = ?').get(key);
  if (row && Date.now() - row.updated_at < ttl) return JSON.parse(row.value);
  if (!inflight.has(key)) {
    inflight.set(key, load()
      .then((value) => {
        db.prepare('INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')
          .run(key, JSON.stringify(value), Date.now());
        return value;
      })
      .catch(() => (row ? JSON.parse(row.value) : fallback))
      .finally(() => inflight.delete(key)));
  }
  return inflight.get(key);
}

const FALLBACK_GRID = JSON.parse(fs.readFileSync(path.join(ROOT, 'server', 'f1-grid-2026.json'), 'utf8'));
// Race drivers = everyone in the championship standings (reserves and test drivers aren't listed there).
const grid = () => cached('grid', 12 * HOUR, async () => {
  const j = await getJson(`${API}/driverstandings.json?limit=100`);
  const list = j.MRData.StandingsTable.StandingsLists[0]?.DriverStandings || [];
  const out = list.map((d) => ({
    id: plain(d.Driver.driverId, 40),
    name: plain(`${d.Driver.givenName} ${d.Driver.familyName}`, 60).replace(/^Andrea /, ''),
    team: plain(d.Constructors.at(-1)?.name, 40).replace(/ F1 Team$/, ''),
  })).filter((d) => /^[a-z0-9_]+$/.test(d.id));
  if (out.length < 18) throw new Error('grid too small');
  return out;
}, FALLBACK_GRID);

// round → [P1, P2, P3] driver ids, for every race that has results.
const podiums = () => cached('podiums', 30 * 60e3, async () => {
  const lists = await Promise.all([1, 2, 3].map((p) => getJson(`${API}/results/${p}.json?limit=100`)));
  const out = {};
  lists.forEach((j, i) => {
    for (const race of j.MRData.RaceTable.Races) {
      const id = race.Results?.[0]?.Driver?.driverId;
      if (!/^[a-z0-9_]+$/.test(id || '')) continue;
      (out[race.round] ||= [null, null, null])[i] = id;
    }
  });
  for (const k of Object.keys(out)) if (out[k].includes(null)) delete out[k];
  return out;
}, {});

/* ---------- Quiniela ---------- */

export const SCORE = { exact: 3, onPodium: 1, perfectBonus: 2 }; // max 11 per race

function scoreEntry(entry, podium) {
  if (!podium) return null;
  const picks = [entry.p1, entry.p2, entry.p3];
  let pts = 0;
  let exact = 0;
  picks.forEach((d, i) => {
    if (podium[i] === d) { pts += SCORE.exact; exact += 1; } else if (podium.includes(d)) pts += SCORE.onPodium;
  });
  if (exact === 3) pts += SCORE.perfectBonus;
  return { pts, exact };
}

// The race people are predicting: the next one until ~3 h after its start. Picks lock when qualifying starts.
function currentRace(now = Date.now()) {
  const r = races().find((x) => now < Date.parse(x.sessions.race) + 3 * HOUR);
  if (!r) return null;
  const lockAt = r.sessions.quali;
  return { round: r.round, name: r.name, lockAt, raceAt: r.sessions.race, open: now < Date.parse(lockAt) };
}

function leaderboard(pods) {
  const rows = db.prepare('SELECT round, nickname, handle, p1, p2, p3, created_at FROM predictions WHERE hidden = 0 ORDER BY round').all();
  const players = new Map();
  for (const r of rows) {
    const s = scoreEntry(r, pods[r.round]);
    const p = players.get(r.handle) || { nickname: r.nickname, pts: 0, exact: 0, races: 0, first: r.created_at };
    p.nickname = r.nickname; // latest nickname wins
    if (s) { p.pts += s.pts; p.exact += s.exact; p.races += 1; }
    players.set(r.handle, p);
  }
  return [...players.values()]
    .filter((p) => p.races > 0)
    .sort((a, b) => b.pts - a.pts || b.exact - a.exact || a.first.localeCompare(b.first))
    .slice(0, 20)
    .map(({ nickname, pts, exact, races: n }) => ({ nickname, pts, exact, races: n }));
}

const deviceToken = (req) => {
  const m = /(?:^|;\s*)pl_q=([a-f0-9]{48})/.exec(req.headers.cookie || '');
  return m ? m[1] : null;
};

async function quinielaPayload(req) {
  const [drivers, pods] = await Promise.all([grid(), podiums()]);
  const current = currentRace();
  const names = Object.fromEntries(drivers.map((d) => [d.id, d.name]));
  const token = deviceToken(req);
  let mine = null;
  if (current && token) {
    const row = db.prepare('SELECT nickname, handle, p1, p2, p3 FROM predictions WHERE round = ? AND token_hash = ?').get(current.round, sha256(token));
    if (row) mine = row;
  }
  // Most recent race with results: its podium + the best scores that weekend.
  const lastRound = Math.max(0, ...Object.keys(pods).map(Number));
  let last = null;
  if (lastRound) {
    const entries = db.prepare('SELECT nickname, p1, p2, p3 FROM predictions WHERE round = ? AND hidden = 0').all(lastRound);
    const top = entries.map((e) => ({ nickname: e.nickname, ...scoreEntry(e, pods[lastRound]) }))
      .sort((a, b) => b.pts - a.pts || b.exact - a.exact).slice(0, 5);
    last = { round: lastRound, name: raceByRound(lastRound)?.name || `Ronda ${lastRound}`, podium: pods[lastRound].map((id) => names[id] || id), top, entries: entries.length };
  }
  const count = current ? db.prepare('SELECT COUNT(*) n FROM predictions WHERE round = ? AND hidden = 0').get(current.round).n : 0;
  return { current: current && { ...current, entries: count }, drivers, mine, leaderboard: leaderboard(pods), last, score: SCORE };
}

community.post('/api/girlies/quiniela', express.json({ limit: '4kb' }), async (req, res) => {
  if (hp(req)) return res.json({ ok: true });
  if (!pickLimit(req.ip)) return bad(res, 'Demasiados intentos. Espera un rato.', 429);
  const current = currentRace();
  if (!current) return bad(res, 'La temporada terminó. ¡Nos vemos en 2027!');
  if (!current.open) return bad(res, 'Las predicciones para esta carrera ya cerraron (empezó la clasificación).');
  const nickname = plain(req.body?.nickname, 24);
  const handle = String(req.body?.handle || '').trim().replace(/^@/, '').toLowerCase();
  if (nickname.length < 2) return bad(res, 'Escribe tu apodo (2 letras o más).');
  if (!/^[a-z0-9._]{1,30}$/.test(handle)) return bad(res, 'Escribe tu usuario de Instagram (letras, números, punto o guion bajo).');
  const ids = new Set((await grid()).map((d) => d.id));
  const picks = ['p1', 'p2', 'p3'].map((k) => String(req.body?.[k] || ''));
  if (!picks.every((p) => ids.has(p))) return bad(res, 'Elige un piloto para cada posición.');
  if (new Set(picks).size !== 3) return bad(res, 'Elige tres pilotos distintos.');

  let token = deviceToken(req);
  if (!token) {
    token = crypto.randomBytes(24).toString('hex');
    res.cookie('pl_q', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 365 * 864e5, path: '/' });
  }
  const tokenHash = sha256(token);
  const existing = db.prepare('SELECT id, token_hash FROM predictions WHERE round = ? AND handle = ?').get(current.round, handle);
  if (existing && existing.token_hash !== tokenHash) {
    return bad(res, `@${handle} ya tiene una predicción para esta carrera. Solo se puede cambiar desde el mismo teléfono o computadora.`, 409);
  }
  // A device changing its handle mid-weekend replaces its own earlier pick instead of adding a second one.
  tx(() => {
    db.prepare('DELETE FROM predictions WHERE round = ? AND token_hash = ? AND handle <> ?').run(current.round, tokenHash, handle);
    db.prepare(`INSERT INTO predictions (round, nickname, handle, p1, p2, p3, token_hash) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(round, handle) DO UPDATE SET nickname = excluded.nickname, p1 = excluded.p1, p2 = excluded.p2, p3 = excluded.p3, updated_at = CURRENT_TIMESTAMP`)
      .run(current.round, nickname, handle, ...picks, tokenHash);
  });
  res.json({ ok: true, updated: Boolean(existing), quiniela: await quinielaPayload({ headers: { cookie: `pl_q=${token}` } }) });
});

/* ---------- Watch parties ---------- */

const seatsTaken = (eventId) => db.prepare("SELECT COALESCE(SUM(1 + guests), 0) n FROM rsvps WHERE event_id = ? AND status = 'confirmed'").get(eventId).n;

function publicEvent(e) {
  const taken = seatsTaken(e.id);
  const race = e.race_round ? raceByRound(e.race_round) : null;
  return {
    id: e.id,
    title: e.title || (race ? `Watch party · ${race.name}` : 'Watch party'),
    raceName: race?.name || null,
    raceAt: race?.sessions.race || null,
    startsAt: e.starts_at,
    venue: e.venue,
    address: e.address,
    mapUrl: e.map_url,
    notes: e.notes,
    capacity: e.capacity,
    seatsLeft: e.capacity ? Math.max(0, e.capacity - taken) : null,
    going: taken,
  };
}

function upcomingEvents() {
  const since = new Date(Date.now() - 2 * HOUR).toISOString(); // keep showing an event until 2 h after it starts
  return db.prepare('SELECT * FROM events WHERE published = 1 AND starts_at > ? ORDER BY starts_at LIMIT 12').all(since).map(publicEvent);
}

// "@Handle" → ig:handle · "(787) 555-1234" → tel:7875551234
function normaliseContact(raw) {
  const v = String(raw || '').trim();
  const digits = v.replace(/[^\d]/g, '');
  if (/^[+\d\s().-]+$/.test(v) && digits.length >= 7 && digits.length <= 15) return { key: `tel:${digits}`, shown: v.slice(0, 25) };
  const handle = v.replace(/^@/, '').toLowerCase();
  if (/^[a-z0-9._]{1,30}$/.test(handle)) return { key: `ig:${handle}`, shown: `@${handle}` };
  return null;
}

// After a cancellation, move people up from the waitlist (in order) while they fit.
function promoteWaitlist(eventId) {
  const ev = db.prepare('SELECT capacity FROM events WHERE id = ?').get(eventId);
  if (!ev) return;
  const waiting = db.prepare("SELECT id, guests FROM rsvps WHERE event_id = ? AND status = 'waitlist' ORDER BY id").all(eventId);
  let taken = seatsTaken(eventId);
  for (const w of waiting) {
    if (ev.capacity && taken + 1 + w.guests > ev.capacity) continue;
    db.prepare("UPDATE rsvps SET status = 'confirmed' WHERE id = ?").run(w.id);
    taken += 1 + w.guests;
  }
}

community.post('/api/girlies/rsvp', express.json({ limit: '4kb' }), (req, res) => {
  if (hp(req)) return res.json({ status: 'confirmed', token: newToken() });
  if (!rsvpLimit(req.ip)) return bad(res, 'Demasiados intentos. Espera un rato.', 429);
  const ev = db.prepare('SELECT * FROM events WHERE id = ? AND published = 1').get(Number(req.body?.eventId));
  if (!ev) return bad(res, 'Ese evento ya no está disponible.', 404);
  if (Date.parse(ev.starts_at) < Date.now()) return bad(res, 'Este watch party ya empezó.');
  const name = plain(req.body?.name, 60);
  if (name.length < 2) return bad(res, 'Escribe tu nombre.');
  const contact = normaliseContact(req.body?.contact);
  if (!contact) return bad(res, 'Escribe tu usuario de Instagram o tu teléfono.');
  const guests = Math.max(0, Math.min(3, Math.trunc(Number(req.body?.guests) || 0)));

  const existing = db.prepare('SELECT status FROM rsvps WHERE event_id = ? AND contact_key = ?').get(ev.id, contact.key);
  if (existing && existing.status !== 'cancelled') {
    return bad(res, `Ya hay una reserva con ${contact.shown} para este evento.`, 409);
  }
  const token = newToken();
  const status = tx(() => {
    const fits = !ev.capacity || seatsTaken(ev.id) + 1 + guests <= ev.capacity;
    const s = fits ? 'confirmed' : 'waitlist';
    db.prepare(`INSERT INTO rsvps (event_id, name, contact, contact_key, guests, status, token_hash) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(event_id, contact_key) DO UPDATE SET name = excluded.name, contact = excluded.contact, guests = excluded.guests,
        status = excluded.status, token_hash = excluded.token_hash, created_at = CURRENT_TIMESTAMP`)
      .run(ev.id, name, contact.shown, contact.key, guests, s, sha256(token));
    return s;
  });
  res.json({ status, token, event: publicEvent(ev) });
});

community.post('/api/girlies/rsvp/cancel', express.json({ limit: '2kb' }), (req, res) => {
  const token = String(req.body?.token || '');
  if (!/^[a-f0-9]{48}$/.test(token)) return bad(res, 'Enlace no válido.', 404);
  const r = db.prepare('SELECT id, event_id, status FROM rsvps WHERE token_hash = ?').get(sha256(token));
  if (!r) return bad(res, 'No encontramos esa reserva.', 404);
  if (r.status !== 'cancelled') {
    tx(() => {
      db.prepare("UPDATE rsvps SET status = 'cancelled' WHERE id = ?").run(r.id);
      promoteWaitlist(r.event_id);
    });
  }
  res.json({ ok: true });
});

/* ---------- Photo wall ---------- */

const approvedPhotos = () => db.prepare("SELECT id, file, caption, credit FROM photos WHERE status = 'approved' ORDER BY COALESCE(approved_at, created_at) DESC LIMIT 60").all()
  .map((p) => ({ id: p.id, url: p.file, caption: p.caption, credit: p.credit }));

const isJpegPngWebp = (buf) => (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff ? 'jpg'
  : buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG' ? 'png'
    : buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP' ? 'webp' : null);

// Visitors' photos: the browser shrinks them first. Caption/credit travel in headers (URL-encoded).
community.post('/api/girlies/photos', express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '6mb' }), (req, res) => {
  if (!photoLimit(req.ip)) return bad(res, 'Ya enviaste varias fotos. Prueba más tarde.', 429);
  if (req.get('x-consent') !== 'yes') return bad(res, 'Confirma que tienes permiso de las personas en la foto.');
  const pending = db.prepare("SELECT COUNT(*) n FROM photos WHERE status = 'pending'").get().n;
  if (pending >= MAX_PENDING) return bad(res, 'Hay muchas fotos esperando revisión. Inténtalo en unos días.', 503);
  const buf = req.body;
  const ext = Buffer.isBuffer(buf) && buf.length ? isJpegPngWebp(buf) : null;
  if (!ext) return bad(res, 'Ese archivo no es una foto válida.');
  const decode = (h) => { try { return decodeURIComponent(req.get(h) || ''); } catch { return ''; } };
  const name = `${crypto.randomBytes(12).toString('base64url')}.${ext}`;
  fs.writeFileSync(path.join(PENDING_DIR, name), buf);
  db.prepare("INSERT INTO photos (file, caption, credit, status, source) VALUES (?, ?, ?, 'pending', 'member')")
    .run(name, plain(decode('x-caption'), 140), plain(decode('x-credit'), 40));
  res.status(201).json({ ok: true });
});

/* ---------- public bundle: one request for the whole page ---------- */

community.get('/api/girlies', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ events: upcomingEvents(), photos: approvedPhotos(), quiniela: await quinielaPayload(req) });
});

/* ---------- admin ---------- */

const adminEvent = (e) => ({
  ...publicEvent(e),        // title here is the display title (falls back to "Watch party · <race>")
  rawTitle: e.title,        // what the owner actually typed, for the edit form
  raceRound: e.race_round,
  published: Boolean(e.published),
  rsvps: db.prepare('SELECT id, name, contact, guests, status, created_at FROM rsvps WHERE event_id = ? ORDER BY id').all(e.id),
});

// "2026-11-01T14:00" typed in Puerto Rico time (UTC−4, no daylight saving) → UTC ISO.
function eventFromBody(b) {
  const local = String(b.startsLocal || '');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw new Error('Elige la fecha y la hora.');
  const startsAt = new Date(`${local}:00-04:00`).toISOString();
  const venue = plain(b.venue, 80);
  if (!venue) throw new Error('Escribe el lugar.');
  const mapUrl = String(b.mapUrl || '').trim();
  if (mapUrl && !/^https:\/\/[^\s]+$/i.test(mapUrl)) throw new Error('El enlace del mapa debe empezar con https://');
  const round = b.raceRound ? Number(b.raceRound) : null;
  if (round && !raceByRound(round)) throw new Error('Esa carrera no existe.');
  return {
    title: plain(b.title, 80), race_round: round, starts_at: startsAt, venue, address: plain(b.address, 140),
    map_url: mapUrl.slice(0, 500), capacity: Math.max(0, Math.min(5000, Math.trunc(Number(b.capacity) || 0))),
    notes: plain(b.notes, 400), published: b.published === false ? 0 : 1,
  };
}

community.get('/api/admin/events', requireUser, (_req, res) => {
  res.json({
    events: db.prepare('SELECT * FROM events ORDER BY starts_at DESC').all().map(adminEvent),
    races: races().map((r) => ({ round: r.round, name: r.name, raceAt: r.sessions.race })),
  });
});

community.post('/api/admin/events', requireUser, express.json(), (req, res) => {
  try {
    const e = eventFromBody(req.body || {});
    const { lastInsertRowid } = db.prepare(`INSERT INTO events (title, race_round, starts_at, venue, address, map_url, capacity, notes, published)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(e.title, e.race_round, e.starts_at, e.venue, e.address, e.map_url, e.capacity, e.notes, e.published);
    res.status(201).json({ id: Number(lastInsertRowid) });
  } catch (err) { bad(res, err.message); }
});

community.put('/api/admin/events/:id', requireUser, express.json(), (req, res) => {
  try {
    const e = eventFromBody(req.body || {});
    const r = db.prepare(`UPDATE events SET title = ?, race_round = ?, starts_at = ?, venue = ?, address = ?, map_url = ?, capacity = ?, notes = ?, published = ? WHERE id = ?`)
      .run(e.title, e.race_round, e.starts_at, e.venue, e.address, e.map_url, e.capacity, e.notes, e.published, Number(req.params.id));
    if (!r.changes) return bad(res, 'No encontrado.', 404);
    promoteWaitlist(Number(req.params.id)); // more seats → waitlist moves up
    res.json({ ok: true });
  } catch (err) { bad(res, err.message); }
});

community.delete('/api/admin/events/:id', requireUser, (req, res) => {
  db.prepare('DELETE FROM events WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

community.put('/api/admin/rsvps/:id', requireUser, express.json(), (req, res) => {
  const r = db.prepare('SELECT id, event_id FROM rsvps WHERE id = ?').get(Number(req.params.id));
  if (!r) return bad(res, 'No encontrado.', 404);
  const status = req.body?.status;
  if (!['confirmed', 'waitlist', 'cancelled'].includes(status)) return bad(res, 'Estado no válido.');
  tx(() => {
    db.prepare('UPDATE rsvps SET status = ? WHERE id = ?').run(status, r.id);
    if (status === 'cancelled') promoteWaitlist(r.event_id);
  });
  res.json({ ok: true });
});

community.get('/api/admin/events/:id/csv', requireUser, (req, res) => {
  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(Number(req.params.id));
  if (!ev) return res.status(404).end();
  // Leading = + - @ would make a spreadsheet treat the cell as a formula; prefix them with '.
  const cell = (v) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return `"${s.replace(/"/g, '""')}"`; };
  const rows = db.prepare('SELECT name, contact, guests, status, created_at FROM rsvps WHERE event_id = ? ORDER BY status, id').all(ev.id);
  const label = { confirmed: 'Confirmada', waitlist: 'En espera', cancelled: 'Cancelada' };
  const prTime = new Intl.DateTimeFormat('es-PR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Puerto_Rico' });
  const csv = ['Nombre,Contacto,Invitadas,Estado,Reservó (hora PR)', ...rows.map((r) => [r.name, r.contact, r.guests, label[r.status], prTime.format(new Date(`${r.created_at.replace(' ', 'T')}Z`))].map(cell).join(','))].join('\r\n');
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="reservas-${ev.id}.csv"` });
  res.send(`﻿${csv}`);
});

community.get('/api/admin/quiniela', requireUser, async (_req, res) => {
  const [drivers, pods] = await Promise.all([grid(), podiums()]);
  const names = Object.fromEntries(drivers.map((d) => [d.id, d.name]));
  const rows = db.prepare('SELECT id, round, nickname, handle, p1, p2, p3, hidden, updated_at FROM predictions ORDER BY round DESC, id').all();
  const byRound = new Map();
  for (const r of rows) {
    const s = scoreEntry(r, pods[r.round]);
    if (!byRound.has(r.round)) byRound.set(r.round, { round: r.round, name: raceByRound(r.round)?.name || `Ronda ${r.round}`, podium: pods[r.round]?.map((id) => names[id] || id) || null, entries: [] });
    byRound.get(r.round).entries.push({ id: r.id, nickname: r.nickname, handle: r.handle, picks: [r.p1, r.p2, r.p3].map((id) => names[id] || id), hidden: Boolean(r.hidden), pts: s?.pts ?? null });
  }
  res.json({ current: currentRace(), rounds: [...byRound.values()], leaderboard: leaderboard(pods), score: SCORE });
});

community.put('/api/admin/predictions/:id', requireUser, express.json(), (req, res) => {
  db.prepare('UPDATE predictions SET hidden = ? WHERE id = ?').run(req.body?.hidden ? 1 : 0, Number(req.params.id));
  res.json({ ok: true });
});

community.get('/api/admin/photos', requireUser, (_req, res) => {
  const all = db.prepare('SELECT id, file, caption, credit, status, source, created_at FROM photos ORDER BY id DESC').all();
  res.json({
    pending: all.filter((p) => p.status === 'pending').map((p) => ({ ...p, url: `/api/admin/photos/${p.id}/image` })),
    approved: all.filter((p) => p.status === 'approved').map((p) => ({ ...p, url: p.file })),
  });
});

// Pending photos are never public; only a signed-in admin can see them.
community.get('/api/admin/photos/:id/image', requireUser, (req, res) => {
  const p = db.prepare("SELECT file FROM photos WHERE id = ? AND status = 'pending'").get(Number(req.params.id));
  if (!p || !/^[A-Za-z0-9_-]+\.(jpg|png|webp)$/.test(p.file)) return res.status(404).end();
  res.set('Cache-Control', 'private, no-store');
  res.sendFile(path.join(PENDING_DIR, p.file));
});

// Owner adds a photo she already uploaded with the editor's uploader (/api/uploads).
community.post('/api/admin/photos', requireUser, express.json(), (req, res) => {
  const url = String(req.body?.url || '');
  if (!/^\/uploads\/[A-Za-z0-9_-]{8,64}\.(jpg|png|webp)$/.test(url)) return bad(res, 'Foto no válida.');
  db.prepare("INSERT INTO photos (file, caption, credit, status, source, approved_at) VALUES (?, ?, ?, 'approved', 'admin', CURRENT_TIMESTAMP)")
    .run(url, plain(req.body?.caption, 140), plain(req.body?.credit, 40));
  res.status(201).json({ ok: true });
});

community.put('/api/admin/photos/:id', requireUser, express.json(), (req, res) => {
  const p = db.prepare('SELECT * FROM photos WHERE id = ?').get(Number(req.params.id));
  if (!p) return bad(res, 'No encontrado.', 404);
  const caption = req.body?.caption !== undefined ? plain(req.body.caption, 140) : p.caption;
  const credit = req.body?.credit !== undefined ? plain(req.body.credit, 40) : p.credit;
  let file = p.file;
  if (req.body?.approve && p.status === 'pending') {
    fs.renameSync(path.join(PENDING_DIR, p.file), path.join(UPLOAD_DIR, p.file)); // now publicly served
    file = `/uploads/${p.file}`;
  }
  db.prepare("UPDATE photos SET caption = ?, credit = ?, file = ?, status = ?, approved_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE approved_at END WHERE id = ?")
    .run(caption, credit, file, req.body?.approve ? 'approved' : p.status, req.body?.approve ? 1 : 0, p.id);
  res.json({ ok: true });
});

// Removing a visitor's photo also deletes its file (pending or approved). The owner's own uploads keep
// their file, since the same photo might be used elsewhere on the site.
community.delete('/api/admin/photos/:id', requireUser, (req, res) => {
  const p = db.prepare('SELECT * FROM photos WHERE id = ?').get(Number(req.params.id));
  if (!p) return res.json({ ok: true });
  if (p.source === 'member') {
    const file = p.status === 'pending' ? path.join(PENDING_DIR, p.file) : path.join(UPLOAD_DIR, path.basename(p.file));
    fs.rmSync(file, { force: true });
  }
  db.prepare('DELETE FROM photos WHERE id = ?').run(p.id);
  res.json({ ok: true });
});
