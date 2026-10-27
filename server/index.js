import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import compression from 'compression';
import { ROOT, UPLOAD_DIR } from './db.js';
import {
  loadUser, requireUser, publicUser, startSession, endSession, checkLogin, passwordProblem, limiter,
  getInvite, acceptInvite, findUserByEmail, createPasswordReset, getPasswordReset, completePasswordReset,
  changePassword, RESET_TTL_MINUTES,
} from './auth.js';
import { canSendEmail, sendEmail, resetEmail } from './email.js';
import { editorPayload, saveContent, resetContent, renderPage, renderText } from './content.js';
import { community } from './community.js';

const PUBLIC = path.join(ROOT, 'public');
const isProd = process.env.NODE_ENV === 'production';
const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1); // behind Railway's (or any host's) HTTPS proxy

// gzip HTML/CSS/JS/JSON (fonts and photos are already compressed and get skipped).
app.use(compression());

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Origin-Agent-Cluster': '?1',
    'X-DNS-Prefetch-Control': 'off',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': [
      // Everything is self-hosted (fonts included) and there are no inline scripts or styles,
      // so the policy can stay this tight. The only outside call is the live F1 results API.
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "font-src 'self'",
      "img-src 'self' data:",
      "connect-src 'self' https://api.jolpi.ca",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      ...(isProd ? ['upgrade-insecure-requests'] : []),
    ].join('; '),
  });
  if (isProd) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

app.use(express.json({ limit: '100kb' }));
app.use(loadUser);

// CSRF guard: every state-changing API call from our own pages sends this header, which a
// cross-site form or image can't set.
app.use('/api', (req, res, next) => {
  if (req.method !== 'GET' && req.get('x-requested-with') !== 'phanie') return res.status(403).json({ error: 'Solicitud no permitida.' });
  res.set('Cache-Control', 'no-store');
  next();
});

// In production the reset link's address comes ONLY from SITE_URL. Building it from the request's Host
// header would let someone ask for a reset with a forged Host and get the victim's link pointed at their site.
const siteOrigin = (req) => (process.env.SITE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
const resetReady = () => canSendEmail() && (!isProd || Boolean(process.env.SITE_URL));
if (isProd && !process.env.SITE_URL) console.warn('[config] SITE_URL is not set — "forgot password" stays off until it is.');
if (isProd && !process.env.DATA_DIR) console.warn('[config] DATA_DIR is not set — the database lives inside the app folder and will be lost on redeploy.');
const bad = (res, error, status = 400) => res.status(status).json({ error });
const loginLimit = limiter({ windowMs: 15 * 60e3, max: 10 });
const resetIpLimit = limiter({ windowMs: 15 * 60e3, max: 10 });
const resetEmailLimit = limiter({ windowMs: 60 * 60e3, max: 3 });
const tokenLimit = limiter({ windowMs: 15 * 60e3, max: 30 });

/* ---------- account ---------- */

app.get('/api/me', (req, res) => res.json({ user: publicUser(req.user), emailReady: resetReady() }));

app.post('/api/login', (req, res) => {
  const { email = '', password = '' } = req.body || {};
  if (!loginLimit(req.ip) || !loginLimit(`e:${String(email).toLowerCase()}`)) return bad(res, 'Demasiados intentos. Espera unos minutos.', 429);
  const user = checkLogin(email, String(password));
  if (!user) return bad(res, 'Correo o contraseña incorrectos.', 401);
  startSession(res, user.id);
  res.json({ user: publicUser(user) });
});

app.post('/api/logout', (req, res) => {
  endSession(req, res);
  res.json({ ok: true });
});

app.post('/api/password', requireUser, (req, res) => {
  const { current = '', password, confirm } = req.body || {};
  const problem = passwordProblem(password, confirm);
  if (problem) return bad(res, problem);
  if (!loginLimit(`pw:${req.user.id}`)) return bad(res, 'Demasiados intentos. Espera unos minutos.', 429);
  if (!changePassword(req.user.id, String(current), password)) return bad(res, 'La contraseña actual no es correcta.');
  startSession(res, req.user.id); // keep this device signed in
  res.json({ ok: true });
});

/* ---------- invite link → choose password ---------- */

app.get('/api/invite', (req, res) => {
  if (!tokenLimit(req.ip)) return bad(res, 'Demasiados intentos. Espera unos minutos.', 429);
  const invite = getInvite(req.query.token);
  if (!invite) return bad(res, 'Este enlace ya se usó o venció. Pide uno nuevo.', 404);
  res.json({ email: invite.email, name: invite.name });
});

app.post('/api/invite', (req, res) => {
  const { token, password, confirm } = req.body || {};
  const problem = passwordProblem(password, confirm);
  if (problem) return bad(res, problem);
  const invite = acceptInvite(String(token), password);
  if (!invite) return bad(res, 'Este enlace ya se usó o venció. Pide uno nuevo.', 404);
  startSession(res, invite.id);
  res.json({ ok: true });
});

/* ---------- forgot password ---------- */

// Same answer whether or not the email has an account, so this can't be used to find out who's registered.
app.post('/api/forgot', async (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim();
  if (!resetReady()) return bad(res, 'El envío de correos aún no está configurado. Pide ayuda a quien administra el sitio.', 503);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad(res, 'Escribe un correo válido.');
  if (!resetIpLimit(req.ip) || !resetEmailLimit(email)) return bad(res, 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.', 429);

  const user = findUserByEmail(email);
  if (user) {
    const token = createPasswordReset(user.id);
    const link = `${siteOrigin(req)}/admin/restablecer?token=${token}`;
    await sendEmail({ to: user.email, ...resetEmail({ name: user.name, link, minutes: RESET_TTL_MINUTES }) });
  }
  res.json({ sent: true });
});

app.get('/api/reset', (req, res) => {
  if (!tokenLimit(req.ip)) return bad(res, 'Demasiados intentos. Espera unos minutos.', 429);
  const user = getPasswordReset(req.query.token);
  if (!user) return bad(res, 'Este enlace ya se usó o venció. Pide uno nuevo.', 404);
  res.json({ email: user.email });
});

app.post('/api/reset', (req, res) => {
  const { token, password, confirm } = req.body || {};
  const problem = passwordProblem(password, confirm);
  if (problem) return bad(res, problem);
  const user = completePasswordReset(String(token), password);
  if (!user) return bad(res, 'Este enlace ya se usó o venció. Pide uno nuevo.', 404);
  startSession(res, user.id);
  res.json({ ok: true });
});

/* ---------- content ---------- */

app.get('/api/content', requireUser, (_req, res) => res.json(editorPayload()));

app.put('/api/content/:key', requireUser, (req, res) => {
  try {
    const value = saveContent(req.params.key, req.body?.value, req.user.email);
    res.json({ value, html: renderText(value) });
  } catch (err) {
    bad(res, err.message);
  }
});

app.delete('/api/content/:key', requireUser, (req, res) => {
  try {
    const value = resetContent(req.params.key);
    res.json({ value, html: renderText(value) });
  } catch (err) {
    bad(res, err.message);
  }
});

// Photo upload: raw body. The browser resizes to ≤2000px and re-encodes before sending,
// which also strips camera metadata (GPS etc.).
const SIGNATURES = { jpg: [0xff, 0xd8, 0xff], png: [0x89, 0x50, 0x4e, 0x47], webp: [0x52, 0x49, 0x46, 0x46] };
app.post('/api/uploads', requireUser, express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '8mb' }), (req, res) => {
  const buf = req.body;
  if (!Buffer.isBuffer(buf) || !buf.length) return bad(res, 'Elige una foto JPG, PNG o WEBP.');
  const ext = Object.keys(SIGNATURES).find((k) => SIGNATURES[k].every((b, i) => buf[i] === b));
  if (!ext || (ext === 'webp' && buf.toString('ascii', 8, 12) !== 'WEBP')) return bad(res, 'Ese archivo no es una foto válida.');
  const name = `${crypto.randomBytes(12).toString('base64url')}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  res.status(201).json({ url: `/uploads/${name}` });
});

app.use(community); // F1 Girlies: watch parties, quiniela, photo wall (public + admin APIs)

app.use('/api', (_req, res) => bad(res, 'No encontrado.', 404));

/* ---------- pages ---------- */

const page = (view) => (req, res) => {
  res.set('Cache-Control', req.user ? 'private, no-store' : 'no-cache');
  res.type('html').send(renderPage(view, { editing: Boolean(req.user) }));
};
app.get(['/', '/index.html'], page('index'));
app.get(['/f1-girlies', '/comunidad'], page('girlies'));

const adminPage = path.join(PUBLIC, 'admin', 'index.html');
app.get(['/admin', '/admin/olvide', '/admin/restablecer', '/admin/activar'], (_req, res) => {
  res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
  res.sendFile(adminPage);
});

app.get('/robots.txt', (_req, res) => res.type('text/plain').send('User-agent: *\nDisallow: /admin\nDisallow: /api/\n'));

// Uploaded photos never change (a new photo gets a new random name), so they cache for a year.
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '365d', immutable: true, fallthrough: false }));
// Caching for site files:
//   ?v=<hash> links (CSS/JS from the template) → 1 year; a new deploy changes the hash, so no stale code.
//   fonts and /img                               → 30 days.
//   anything else (admin panel files)            → revalidate every load; ETags make that a cheap 304.
app.use((req, res, next) => { res.locals.versioned = typeof req.query.v === 'string'; next(); });
app.use(express.static(PUBLIC, {
  index: false,
  etag: true,
  setHeaders: (res, file) => {
    if (res.locals.versioned) res.set('Cache-Control', 'public, max-age=31536000, immutable');
    else if (/[\\/](fonts|img)[\\/]/.test(file)) res.set('Cache-Control', 'public, max-age=2592000');
    else res.set('Cache-Control', 'no-cache');
  },
}));

app.use((err, _req, res, _next) => {
  if (err.type === 'entity.too.large') return bad(res, 'La foto es demasiado grande (máximo 8 MB).', 413);
  const status = err.status || err.statusCode;
  if (status >= 400 && status < 500) return res.status(status).end();
  console.error(err);
  bad(res, 'Algo salió mal. Inténtalo otra vez.', 500);
});

const port = Number(process.env.PORT) || 5196;
app.listen(port, () => console.log(`phanielopez.com running on http://localhost:${port}`));
