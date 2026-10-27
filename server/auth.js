// Admin accounts: scrypt passwords, server-side sessions, invite links and "forgot password" links.
// Same model as Josué's platform: accounts are created WITHOUT a password (scripts/admin-invite.js);
// the owner opens a one-time link and chooses her own, so nobody else ever knows it.
import crypto from 'node:crypto';
import { db, tx } from './db.js';

export const COOKIE = 'pl_session';
const SESSION_DAYS = 30;
export const RESET_TTL_MINUTES = 60;
export const MIN_PASSWORD = 10;
const isProd = process.env.NODE_ENV === 'production';

export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const newToken = () => crypto.randomBytes(32).toString('hex');
const TOKEN_RE = /^[a-f0-9]{64}$/;

/* ---------- passwords ---------- */

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password, stored) {
  const [scheme, salt, hash] = String(stored).split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = crypto.scryptSync(password, Buffer.from(salt, 'base64'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

// A dummy hash so a login for an unknown email takes as long as a real one (no account probing by timing).
const DUMMY_HASH = hashPassword(crypto.randomBytes(12).toString('hex'));

export function checkLogin(email, password) {
  const user = db.prepare('SELECT id, email, name, password_hash FROM users WHERE email = ?').get(String(email).trim());
  const ok = verifyPassword(password, user?.password_hash || DUMMY_HASH);
  return ok && user?.password_hash ? user : null;
}

export function passwordProblem(password, confirm) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) return `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`;
  if (password.length > 200) return 'La contraseña es demasiado larga.';
  if (confirm !== undefined && password !== confirm) return 'Las contraseñas no coinciden.';
  return null;
}

/* ---------- rate limiting (in memory; fine for a single server) ---------- */

export function limiter({ windowMs, max }) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.reset < now) { hits.set(key, { n: 1, reset: now + windowMs }); return true; }
    entry.n += 1;
    if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    return entry.n <= max;
  };
}

/* ---------- sessions ---------- */

function readCookie(req, name) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function startSession(res, userId) {
  const token = newToken();
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha256(token), userId, Date.now() + SESSION_DAYS * 864e5);
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: isProd, maxAge: SESSION_DAYS * 864e5, path: '/' });
}

export function endSession(req, res) {
  const token = readCookie(req, COOKIE);
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
  res.clearCookie(COOKIE, { path: '/' });
}

// Attaches req.user (or null) to every request.
export function loadUser(req, _res, next) {
  req.user = null;
  const token = readCookie(req, COOKIE);
  if (token && TOKEN_RE.test(token)) {
    req.user = db.prepare(`
      SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?`).get(sha256(token), Date.now()) || null;
  }
  next();
}

export function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Inicia sesión otra vez.' });
  next();
}

export const publicUser = (u) => u && { email: u.email, name: u.name };

/* ---------- invites (created by scripts/admin-invite.js) ---------- */

export function getInvite(token) {
  if (!TOKEN_RE.test(String(token))) return null;
  const row = db.prepare('SELECT id, email, name, invite_expires_at FROM users WHERE invite_token_hash = ?').get(sha256(token));
  if (!row || !row.invite_expires_at || row.invite_expires_at < Date.now()) return null;
  return { id: row.id, email: row.email, name: row.name };
}

export function acceptInvite(token, password) {
  const invite = getInvite(token);
  if (!invite) return null;
  tx(() => {
    db.prepare('UPDATE users SET password_hash = ?, invite_token_hash = NULL, invite_expires_at = NULL WHERE id = ?').run(hashPassword(password), invite.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(invite.id);
    db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(invite.id);
  });
  return invite;
}

/* ---------- forgot password ---------- */

export function findUserByEmail(email) {
  return db.prepare('SELECT id, email, name FROM users WHERE email = ?').get(String(email).trim()) || null;
}

// Issues a fresh link for an account, killing any older one.
export function createPasswordReset(userId) {
  const token = newToken();
  tx(() => {
    db.prepare('DELETE FROM password_resets WHERE expires_at < ? OR user_id = ?').run(Date.now(), userId);
    db.prepare('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha256(token), userId, Date.now() + RESET_TTL_MINUTES * 60e3);
  });
  return token;
}

export function getPasswordReset(token) {
  if (!TOKEN_RE.test(String(token))) return null;
  return db.prepare(`
    SELECT u.id, u.email, u.name FROM password_resets r JOIN users u ON u.id = r.user_id
    WHERE r.token_hash = ? AND r.expires_at > ?`).get(sha256(token), Date.now()) || null;
}

// Sets the new password, burns the link and signs the account out everywhere.
export function completePasswordReset(token, password) {
  const user = getPasswordReset(token);
  if (!user) return null;
  tx(() => {
    db.prepare('UPDATE users SET password_hash = ?, invite_token_hash = NULL, invite_expires_at = NULL WHERE id = ?').run(hashPassword(password), user.id);
    db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
  });
  return user;
}

// Change password while signed in: other devices are signed out, this one stays.
export function changePassword(userId, current, next) {
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
  if (!row || !verifyPassword(current, row.password_hash)) return false;
  tx(() => {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(next), userId);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM password_resets WHERE user_id = ?').run(userId);
  });
  return true;
}
