#!/usr/bin/env node
/**
 * Create (or re-invite) an admin account and print a one-time activation link.
 * The person opens the link and chooses their own password — nobody else ever sees it.
 *
 *   npm run admin:invite -- --email stephanie@example.com --name "Stephanie López" --url https://phanielopez.com
 *
 * Options
 *   --email   (required) login email
 *   --name    display name (kept as-is when re-inviting if omitted)
 *   --url     public base URL the link should point at (default: $SITE_URL or http://localhost:5196)
 *   --remove  delete the account instead (asks nothing; use with care)
 *
 * Re-running for the same email issues a NEW link and kills the old one. It never touches an existing
 * password until the new link is used. Uses DATA_DIR like the app, so run it ON THE SERVER where the
 * real database lives (e.g. `railway ssh`), not on your laptop — a local account doesn't deploy.
 */
import crypto from 'node:crypto';
import { db } from '../server/db.js';

const INVITE_DAYS = 7;
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
};
const fail = (msg) => { console.error(`\n✗ ${msg}\n`); process.exit(1); };

const email = (arg('email') || '').toLowerCase().trim();
const name = (arg('name') || '').trim();
const baseUrl = (arg('url') || process.env.SITE_URL || 'http://localhost:5196').replace(/\/+$/, '');

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Pass a valid --email.');

if (process.argv.includes('--remove')) {
  const r = db.prepare('DELETE FROM users WHERE email = ?').run(email);
  console.log(r.changes ? `\n✓ Removed ${email}\n` : `\n(no account for ${email})\n`);
  process.exit(0);
}

const token = crypto.randomBytes(32).toString('hex');
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
const expires = Date.now() + INVITE_DAYS * 864e5;

const existing = db.prepare('SELECT id, name FROM users WHERE email = ?').get(email);
if (existing) {
  db.prepare('UPDATE users SET name = ?, invite_token_hash = ?, invite_expires_at = ? WHERE id = ?')
    .run(name || existing.name, tokenHash, expires, existing.id);
} else {
  db.prepare('INSERT INTO users (email, name, invite_token_hash, invite_expires_at) VALUES (?, ?, ?, ?)')
    .run(email, name, tokenHash, expires);
}

console.log(`
✓ ${existing ? 'Re-invited' : 'Created'} admin: ${email}${name ? ` (${name})` : ''}

  Activation link (single use, expires ${new Date(expires).toLocaleDateString()}):
  ${baseUrl}/admin/activar?token=${token}

  Send this privately. Opening it lets the person choose their password.
  Running this command again replaces the link.
`);
