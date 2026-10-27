// Home page: next-race crawl + calendar carousel. (The mobile menu lives in nav.js, shared by every page.)

// ---------- F1 2026: next-race crawl + calendar ----------
const RACES = window.F1_2026 || [];
const TZ = 'America/Puerto_Rico';
// The crawl's closing phrase is editable by the owner (rendered into <meta name="site-tagline">).
const TAGLINE = document.querySelector('meta[name="site-tagline"]')?.content || 'Aprendemos · Compartimos · Vivimos la F1';
const HOUR = 36e5;
const DAY = 24 * HOUR;

// Race start in ms (every round has a UTC start in sessions.race).
const raceTime = (r) => Date.parse(r.sessions.race);
// A race stays "next" until ~2h after the start (roughly the chequered flag).
const isDone = (r, now) => now > raceTime(r) + 2 * HOUR;
const inWeekend = (r, now) => now >= Date.parse(`${r.start}T00:00:00Z`) && !isDone(r, now);

const fmtDay = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmtRace = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'short', timeZone: TZ });
const fmtTime = new Intl.DateTimeFormat('es-PR', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ });
const clean = (s) => s.replace(/\./g, '');
// Anything that can come from the live API is escaped before it goes into innerHTML.
const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function weekendRange(r) {
  const a = new Date(`${r.start}T12:00:00Z`);
  const b = new Date(`${r.end}T12:00:00Z`);
  if (a.getUTCMonth() === b.getUTCMonth()) return `${a.getUTCDate()}–${clean(fmtDay.format(b))}`;
  return `${clean(fmtDay.format(a))} – ${clean(fmtDay.format(b))}`;
}

function raceWhen(r, key = 'race') {
  const iso = r.sessions[key];
  if (!iso) return null;
  const d = new Date(iso);
  return `${clean(fmtRace.format(d))} · ${fmtTime.format(d)} (hora PR)`;
}

function winnerLine(r) {
  const w = r.winner;
  return w ? `${escHtml(w.driver)} (${escHtml(w.team)}, ${Number(w.year)})` : null;
}

function countdown(r, now) {
  const ms = raceTime(r) - now;
  if (ms <= 0) return '¡En pista ahora!';
  const d = Math.floor(ms / DAY);
  const h = Math.floor((ms % DAY) / HOUR);
  const m = Math.floor((ms % HOUR) / 6e4);
  if (d > 0) return `Faltan ${d} ${d === 1 ? 'día' : 'días'} y ${h} h`;
  if (h > 0) return `Faltan ${h} h y ${m} min`;
  return `Faltan ${m} min`;
}

function nextIndex(now) {
  return RACES.findIndex((r) => !isDone(r, now));
}

// --- Crawl ---
const crawl = document.querySelector('.crawl');
const belt = crawl && crawl.querySelector('.crawl__belt');
const labelText = crawl && crawl.querySelector('.crawl__label-text');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function crawlItems(now) {
  const i = nextIndex(now);
  if (i === -1) {
    return [
      '<strong>Temporada 2026 terminada</strong>',
      '23 Grandes Premios en los libros',
      'Nos vemos en la parrilla en 2027',
      TAGLINE,
    ];
  }
  const r = RACES[i];
  const after = RACES[i + 1];
  const left = RACES.length - i;
  const items = [
    `<strong>R${r.round}/${RACES.length} · ${r.name}</strong>`,
    `${r.circuit} · ${r.city}`,
    `Fin de semana: ${weekendRange(r)}`,
  ];
  const quali = raceWhen(r, 'quali');
  if (quali) items.push(`Clasificación: ${quali}`);
  const when = raceWhen(r);
  if (when) items.push(`Carrera: ${when}`);
  if (r.winner) items.push(`Último ganador aquí: ${winnerLine(r)}`);
  if (r.sprint) items.push('<em>Fin de semana sprint</em>');
  if (r.saturday) items.push('<em>Carrera en sábado</em>');
  items.push(`<span class="crawl__count">${countdown(r, now)}</span>`);
  if (after) items.push(`Después: ${after.name} · ${weekendRange(after)}`);
  items.push(left === 1 ? '¡Última carrera de la temporada!' : `Quedan ${left} carreras en 2026`);
  items.push(TAGLINE);
  return items;
}

function renderCrawl() {
  if (!belt) return;
  const now = Date.now();
  const i = nextIndex(now);
  const live = i !== -1 && inWeekend(RACES[i], now);
  labelText.textContent = i === -1 ? 'Temporada 2026' : live ? 'Este fin de semana' : 'Próxima carrera';
  crawl.classList.toggle('is-live', live);

  const group = `<ul class="crawl__group">${crawlItems(now).map((t) => `<li>${t}</li>`).join('')}</ul>`;
  // Two identical groups so the loop is seamless (the belt slides exactly one group width).
  belt.innerHTML = group + (reduceMotion.matches ? '' : group.replace('<ul', '<ul aria-hidden="true"'));
  // Constant reading speed regardless of how much text there is (~70px/s).
  const width = belt.firstElementChild.getBoundingClientRect().width;
  belt.style.setProperty('--crawl-duration', `${Math.max(20, width / 70)}s`);
}

// Only the countdowns change minute to minute — update them in place so the crawl never jumps.
function tickCountdown() {
  const i = nextIndex(Date.now());
  if (i === -1) return;
  const text = countdown(RACES[i], Date.now());
  document.querySelectorAll('.crawl__count').forEach((el) => { el.textContent = text; });
}

// --- Calendar: depth carousel (front card full size; neighbours shrink and fade with distance) ---
const ring = document.getElementById('calendar-ring');
const stage = ring && ring.parentElement;
const statusEl = document.getElementById('carousel-status');
const homeBtn = document.getElementById('carousel-home');
const N = RACES.length;
const SHRINK = 0.6;            // each step away from the front scales a card by this much
const FADE = 0.28;             // …and drops this much opacity
const VISIBLE = 3.4;           // cards further than this from the front are hidden
let pos = 0;                   // continuous index; wrapped per card in applyPos
let spacing = 0;               // px between card centres, one step apart
let cards = [];

const SESSION_LABELS = {
  fp1: 'Práctica 1', fp2: 'Práctica 2', fp3: 'Práctica 3',
  sq: 'Clasificación sprint', sprint: 'Sprint', quali: 'Clasificación', race: 'Carrera',
};
const fmtSessDay = new Intl.DateTimeFormat('es', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ });

const wrap = (i) => ((i % N) + N) % N;
const activeIndex = () => wrap(Math.round(pos));

function sessionsHtml(r, now) {
  return Object.entries(r.sessions).map(([key, iso]) => {
    const d = new Date(iso);
    const past = now > d.getTime() + (key === 'race' ? 2 : 1) * HOUR;
    return `
      <li class="${past ? 'is-past' : ''}${key === 'race' ? ' is-race' : ''}">
        <span class="sess__name">${SESSION_LABELS[key]}</span>
        <span class="sess__time">${clean(fmtSessDay.format(d)).replace(",", "")} · ${fmtTime.format(d)}</span>
      </li>`;
  }).join('');
}

function winnerHtml(r, done) {
  const w = r.winner;
  if (!w) return '<p class="win__none">Primera vez en este circuito.</p>';
  const label = done && w.year === 2026 ? 'Ganador 2026' : `Último ganador aquí · ${Number(w.year)}`;
  return `
    <p class="win__label">${label}</p>
    <p class="win__driver">${escHtml(w.driver)}</p>
    <p class="win__team">${escHtml(w.team)}</p>`;
}

function renderCalendar() {
  if (!ring) return;
  const now = Date.now();
  const next = nextIndex(now);
  const doneCount = next === -1 ? N : next;
  // On a re-render (fresh API data), keep the open card open and keyboard focus where it was.
  const openCard = ring.querySelector('.race.is-open');
  const openI = openCard ? Number(openCard.dataset.i) : -1;
  const hadFocus = ring.contains(document.activeElement);

  ring.innerHTML = RACES.map((r, i) => {
    const done = i < doneCount;
    const isNext = i === next;
    const isOpen = i === openI;
    const tags = [
      isNext ? `<span class="tag tag--lime">${inWeekend(r, now) ? 'Este fin de semana' : 'Próxima'}</span>` : '',
      done ? '<span class="tag tag--muted">Completada</span>' : '',
      r.sprint ? '<span class="tag">Sprint</span>' : '',
      r.saturday ? '<span class="tag">Sábado</span>' : '',
    ].join('');
    return `
      <article class="race${done ? ' race--done' : ''}${isNext ? ' race--next' : ''}${isOpen ? ' is-open' : ''}" data-i="${i}">
        <div class="race__top">
          <span class="race__round">R${String(r.round).padStart(2, '0')}</span>
          <span class="race__cc">${r.cc}</span>
        </div>
        <p class="race__num" aria-hidden="true">${String(r.round).padStart(2, '0')}</p>
        <p class="race__dates">${weekendRange(r)}</p>
        <h3 class="race__name">${r.name}</h3>
        <p class="race__place">${r.circuit} · ${r.city}</p>
        <p class="race__when">${raceWhen(r)}</p>
        ${isNext ? `<p class="race__count crawl__count">${countdown(r, now)}</p>` : ''}
        <div class="race__tags">${tags}</div>
        <button class="race__more" type="button" aria-expanded="${isOpen}" aria-controls="race-details-${i}" tabindex="-1">
          <span>Horarios y ganador</span><span class="race__plus" aria-hidden="true"></span>
        </button>
        <div class="race__details" id="race-details-${i}">
          <div class="race__details-inner">
            <div class="win">${winnerHtml(r, done)}</div>
            <ul class="sess">${sessionsHtml(r, now)}</ul>
          </div>
        </div>
      </article>`;
  }).join('');

  cards = [...ring.children];
  cards.forEach((c) => resizeObs.observe(c));
  // Place freshly rendered cards without animating them in from the centre.
  ring.classList.add('is-instant');
  layout();
  if (hadFocus) cards[activeIndex()].querySelector('.race__more').focus({ preventScroll: true });
  requestAnimationFrame(() => requestAnimationFrame(() => ring.classList.remove('is-instant')));
}

// Step size: on wide screens neighbours sit just clear of the front card; on phones they peek in.
function layout() {
  if (!cards.length) return;
  const w = cards[0].offsetWidth;
  spacing = Math.round(w * (window.innerWidth < 760 ? 0.72 : 0.95));
  applyPos();
}

function applyPos() {
  // Each card is placed by its signed distance from the front (wrapping R23 ↔ R01), so the loop is endless.
  const active = activeIndex();
  cards.forEach((c, i) => {
    const rel = wrap(i - pos + N / 2) - N / 2; // signed distance from the front, in cards
    const dist = Math.abs(rel);
    const far = dist > VISIBLE;
    c.style.transform = `translateX(${rel * spacing}px) scale(${Math.pow(SHRINK, dist)})`;
    c.style.opacity = far ? 0 : Math.max(0, 1 - dist * FADE);
    c.style.zIndex = String(100 - Math.round(dist * 10));
    c.classList.toggle('is-active', i === active);
    c.classList.toggle('is-far', far);
    c.setAttribute('aria-hidden', String(i !== active));
    c.querySelector('.race__more').tabIndex = i === active ? 0 : -1;
    if (i !== active && c.classList.contains('is-open')) setOpen(c, false);
  });
  const r = RACES[active];
  statusEl.textContent = `R${r.round} / ${N} · ${r.name}`;
  fitHeight();
}

// Cards are absolutely positioned, so the track takes the front card's height (it grows when expanded).
function fitHeight() {
  const front = cards[activeIndex()];
  if (front) ring.style.height = `${front.offsetHeight}px`;
}
const resizeObs = new ResizeObserver(() => fitHeight());

function goTo(target) {
  // Take the short way round the ring.
  let delta = wrap(target - activeIndex());
  if (delta > N / 2) delta -= N;
  pos = Math.round(pos) + delta;
  applyPos();
}

function setOpen(card, open) {
  card.classList.toggle('is-open', open);
  card.querySelector('.race__more').setAttribute('aria-expanded', String(open));
}

if (ring) {
  // Swipe / drag to spin (finger on phones, mouse on desktop). Cards follow the pointer, then on release:
  //   • a short but deliberate swipe (≥ 40 px, or any quick flick) always moves at least one card,
  //   • a fast flick carries on for extra cards (momentum), up to 4.
  // Pointer capture starts only after a real drag, so plain clicks/taps still reach the cards.
  const SWIPE_MIN = 40;        // px of travel that counts as "go to the next card"
  const FLICK_SPEED = 0.35;    // px/ms — faster than this is a flick even if short
  const MOMENTUM = 200;        // ms of "glide" for the speed above FLICK_SPEED
  const MAX_EXTRA = 4;
  let drag = null;
  let suppressClick = false;
  stage.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    suppressClick = false; // only the click that ends a drag is swallowed
    drag = { x: e.clientX, pos, moved: false, id: e.pointerId, samples: [{ x: e.clientX, t: e.timeStamp }] };
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 6) {
      drag.moved = true;
      try { stage.setPointerCapture(drag.id); } catch { /* pointer already gone — keep following moves anyway */ }
      ring.classList.add('is-instant');
    }
    if (drag.moved) {
      pos = drag.pos - dx / spacing;
      applyPos();
      drag.samples.push({ x: e.clientX, t: e.timeStamp });
      if (drag.samples.length > 6) drag.samples.shift(); // speed = the last few moves, not the whole drag
    }
  });
  const endDrag = (e) => {
    if (!drag) return;
    if (drag.moved && e.type === 'pointercancel') {
      // The browser took the gesture (e.g. the page started scrolling): just settle on the nearest card.
      ring.classList.remove('is-instant');
      pos = Math.round(pos);
      applyPos();
    } else if (drag.moved) {
      suppressClick = true;
      ring.classList.remove('is-instant');
      const dx = e.clientX - drag.x;
      const first = drag.samples[0];
      const dt = Math.max(1, e.timeStamp - first.t);
      const speed = (e.clientX - first.x) / dt; // px/ms, + = moving right
      const start = Math.round(drag.pos);
      let steps = Math.round(-dx / spacing); // where the finger left the cards
      const flick = Math.abs(speed) > FLICK_SPEED;
      if ((Math.abs(dx) >= SWIPE_MIN || flick) && steps === 0) steps = dx < 0 ? 1 : -1;
      if (flick && Math.sign(-speed) === Math.sign(steps || -speed)) {
        const extra = Math.min(MAX_EXTRA, Math.round(((Math.abs(speed) - FLICK_SPEED) * MOMENTUM) / spacing));
        steps += Math.sign(-speed) * extra;
      }
      pos = start + steps;
      applyPos();
    }
    drag = null;
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  // Stop the browser's own "drag this image/link" ghost from hijacking a mouse swipe.
  stage.addEventListener('dragstart', (e) => e.preventDefault());

  // Two-finger horizontal swipe on a trackpad (and shift+wheel on a mouse). Vertical scrolling is
  // left alone so the page still scrolls normally over the calendar.
  // One swipe = one card. After the fingers lift, macOS keeps sending "momentum" wheel events for a
  // second or two, always getting smaller. Those must not move more cards, but a NEW swipe started
  // while they're still arriving must. A new swipe is recognised by any of:
  //   • a pause in the event stream (> 200 ms),
  //   • the direction flipping,
  //   • the deltas climbing well above the lowest point they had faded to (momentum never speeds up).
  let wheelAcc = 0;
  let wheelLast = -Infinity;
  let wheelMovedAt = -1;    // timeStamp of the last card change in this stream (-1 = armed)
  let wheelTrough = 0;      // smallest |delta| seen since that change
  stage.addEventListener('wheel', (e) => {
    const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
    if (Math.abs(dx) <= Math.abs(e.deltaY) && !e.shiftKey) return; // mostly vertical → let the page scroll
    e.preventDefault();
    const abs = Math.abs(dx);
    const t = e.timeStamp;
    if (wheelMovedAt >= 0) {
      const pause = t - wheelLast > 200;
      const flipped = Math.sign(dx) !== Math.sign(wheelAcc) && abs > 3;
      wheelTrough = Math.min(wheelTrough, abs);
      const speedingUp = t - wheelMovedAt > 150 && abs > wheelTrough * 2 + 4;
      if (pause || flipped || speedingUp) { wheelMovedAt = -1; wheelAcc = 0; } // re-arm for the new swipe
    } else if (t - wheelLast > 200 || Math.sign(dx) !== Math.sign(wheelAcc)) {
      wheelAcc = 0; // a fresh (or reversed) gesture starts its own count
    }
    wheelLast = t;
    if (wheelMovedAt >= 0) return; // still the tail of the swipe that already moved a card
    wheelAcc += dx;
    if (Math.abs(wheelAcc) > 30) {
      goTo(activeIndex() + Math.sign(wheelAcc));
      wheelMovedAt = t;
      wheelTrough = abs;
    }
  }, { passive: false });

  // Which card is under the pointer, judged by on-screen bounds (fallback for clicks that land
  // between the scaled-down cards' outlines and the track).
  function cardAt(x, y) {
    let best = null;
    let bestDist = Infinity;
    cards.forEach((c, i) => {
      if (c.classList.contains('is-far')) return;
      const b = c.getBoundingClientRect();
      if (x < b.left || x > b.right || y < b.top || y > b.bottom) return;
      const dist = Math.abs(wrap(i - pos + N / 2) - N / 2); // prefer the card nearest the front
      if (dist < bestDist) { best = c; bestDist = dist; }
    });
    return best;
  }

  // Click any visible card to spin it to the front (same as pressing next/prev N times);
  // click the front card to expand it.
  stage.addEventListener('click', (e) => {
    if (suppressClick) { suppressClick = false; return; }
    const card = e.target.closest('.race') || cardAt(e.clientX, e.clientY);
    if (!card) return;
    const i = Number(card.dataset.i);
    if (i !== activeIndex()) goTo(i);
    else setOpen(card, !card.classList.contains('is-open'));
  });

  stage.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(activeIndex() + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(activeIndex() - 1); }
  });
  document.querySelectorAll('.carousel__btn').forEach((b) => {
    b.addEventListener('click', () => goTo(activeIndex() + Number(b.dataset.dir)));
  });
  homeBtn.addEventListener('click', () => {
    const n = nextIndex(Date.now());
    goTo(n === -1 ? N - 1 : n);
  });

  window.addEventListener('resize', () => {
    ring.classList.add('is-instant');
    layout();
    requestAnimationFrame(() => ring.classList.remove('is-instant'));
  });
}

function renderAll() {
  renderCrawl();
  renderCalendar();
}

// --- Live data: 2026 winners + session times from the Jolpica F1 API ---
// f1-2026.js stays the offline fallback; any network or parsing problem just leaves it as is.
const API = 'https://api.jolpi.ca/ergast/f1/2026';
const CACHE_KEY = 'f1-2026-live';
const CACHE_TTL = HOUR;
const API_SESSIONS = {
  fp1: 'FirstPractice', fp2: 'SecondPractice', fp3: 'ThirdPractice',
  sq: 'SprintQualifying', sprint: 'Sprint', quali: 'Qualifying',
};

function readCache() {
  try {
    const c = JSON.parse(sessionStorage.getItem(CACHE_KEY));
    return c && Date.now() - c.at < CACHE_TTL ? c : null;
  } catch { return null; }
}

function writeCache(c) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch { /* private mode / quota */ }
}

const getRaces = (url) => fetch(url)
  .then((res) => (res.ok ? res.json() : null))
  .then((j) => j?.MRData?.RaceTable?.Races || null)
  .catch(() => null);

async function fetchLive() {
  const cached = readCache();
  if (cached) return cached;
  const [results, schedule] = await Promise.all([
    getRaces(`${API}/results/1.json?limit=100`),
    getRaces(`${API}.json`),
  ]);
  if (!results && !schedule) return null;
  const live = { at: Date.now(), results: results || [], schedule: schedule || [] };
  writeCache(live);
  return live;
}

// Same round number and a race date within a week of ours, so a renumbered calendar can't
// pin a result on the wrong Grand Prix.
function localRound(api) {
  const r = RACES.find((x) => x.round === Number(api.round));
  return r && Math.abs(Date.parse(api.date) - raceTime(r)) < 7 * DAY ? r : null;
}

function applyLive(live) {
  live.schedule.forEach((a) => {
    const r = localRound(a);
    if (!r) return;
    const iso = (d, t) => (/^\d{4}-\d{2}-\d{2}$/.test(d) && /^\d{2}:\d{2}(:\d{2})?Z$/.test(t) ? `${d}T${t}` : null);
    if (iso(a.date, a.time)) r.sessions.race = iso(a.date, a.time);
    // Only update sessions this round already lists, so the card keeps its order and format.
    Object.entries(API_SESSIONS).forEach(([key, name]) => {
      const s = a[name];
      if (key in r.sessions && iso(s?.date, s?.time)) r.sessions[key] = iso(s.date, s.time);
    });
  });
  live.results.forEach((a) => {
    const r = localRound(a);
    const top = a.Results?.[0];
    if (!r || !top?.Driver || !top.Constructor) return;
    // Third-party data: keep it to short plain names (rendering escapes it as well).
    const plain = (v) => String(v ?? '').replace(/[<>]/g, '').slice(0, 60).trim();
    const driver = plain(`${top.Driver.givenName} ${top.Driver.familyName}`).replace(/^Andrea /, '');
    const team = plain(top.Constructor.name);
    if (driver && team) r.winner = { driver, team, year: 2026 };
  });
}

async function syncLive() {
  try {
    const live = await fetchLive();
    if (!live) return;
    const before = JSON.stringify(RACES);
    applyLive(live);
    if (JSON.stringify(RACES) !== before) renderAll(); // only touch the DOM when something changed
  } catch { /* keep the bundled data */ }
}

if (RACES.length) {
  const n0 = nextIndex(Date.now());
  pos = n0 === -1 ? N - 1 : n0;
  renderAll();
  document.fonts && document.fonts.ready.then(renderCrawl); // re-measure once web fonts settle
  reduceMotion.addEventListener('change', renderCrawl);
  syncLive();

  let lastNext = nextIndex(Date.now());
  let lastSync = Date.now();
  setInterval(() => {
    const n = nextIndex(Date.now());
    if (n !== lastNext) { lastNext = n; renderAll(); } // race finished → advance to the next one
    else tickCountdown();
    // A tab left open picks up new results once the cache has expired.
    if (Date.now() - lastSync > CACHE_TTL) { lastSync = Date.now(); syncLive(); }
  }, 30e3);
}
