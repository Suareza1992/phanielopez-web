// Reads/writes site content and renders the page template with it.
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { db, ROOT } from './db.js';
import { FIELDS, SECTIONS, validate } from './content-schema.js';

const VIEWS = path.join(ROOT, 'views');
const isProd = process.env.NODE_ENV === 'production';
const templates = new Map();

// Reads views/<name>.html and inlines {{> partial}} blocks from views/partials/ (cached in production).
function loadTemplate(name) {
  if (isProd && templates.has(name)) return templates.get(name);
  const html = fs.readFileSync(path.join(VIEWS, `${name}.html`), 'utf8')
    .replace(/\{\{> ([\w-]+)\}\}\n?/g, (whole, p) => {
      const file = path.join(VIEWS, 'partials', `${p}.html`);
      return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : whole; // unknown partial stays visible, never crashes
    });
  templates.set(name, html);
  return html;
}

// Current value of every field: the saved override, or the default.
export function allContent() {
  const values = {};
  for (const [key, f] of FIELDS) values[key] = f.default;
  for (const row of db.prepare('SELECT key, value FROM content').all()) {
    if (FIELDS.has(row.key)) values[row.key] = row.value;
  }
  return values;
}

export function overriddenKeys() {
  return db.prepare('SELECT key FROM content').all().map((r) => r.key).filter((k) => FIELDS.has(k));
}

export function saveContent(key, raw, who) {
  const value = validate(key, raw);
  if (value === FIELDS.get(key).default) {
    db.prepare('DELETE FROM content WHERE key = ?').run(key); // same as the default → no override needed
  } else {
    db.prepare(`INSERT INTO content (key, value, updated_by) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP, updated_by = excluded.updated_by`)
      .run(key, value, who);
  }
  return value;
}

export function resetContent(key) {
  if (!FIELDS.has(key)) throw new Error('Ese campo no existe.');
  db.prepare('DELETE FROM content WHERE key = ?').run(key);
  return FIELDS.get(key).default;
}

// What the editor needs: sections/fields (labels, types, defaults) + current values.
export function editorPayload() {
  return {
    sections: SECTIONS.map((s) => ({ id: s.id, label: s.label, fields: s.fields.map(({ key, label, type, help }) => ({ key, label, type, help })) })),
    fields: Object.fromEntries([...FIELDS].map(([k, f]) => [k, { label: f.label, type: f.type, default: f.default, help: f.help }])),
    values: allContent(),
    overridden: overriddenKeys(),
  };
}

/* ---------- rendering ---------- */

// {{v:/file.css}} → /file.css?v=<content hash>. A changed file gets a new URL, so browsers can cache
// assets for a year and still pick up every deploy immediately.
const versions = new Map();
export function assetUrl(p) {
  if (!isProd || !versions.has(p)) {
    const file = path.join(ROOT, 'public', p);
    versions.set(p, fs.existsSync(file) ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 10) : 'missing');
  }
  return `${p}?v=${versions.get(p)}`;
}

const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Text placeholders keep line breaks (textarea fields) as <br>.
export const renderText = (s) => escHtml(s).replace(/\n/g, '<br>');

// {{t:key}} → escaped text, {{a:key}} → escaped attribute value. Unknown keys are left visible so typos get noticed.
export function renderPage(view, { editing }) {
  const values = allContent();
  let html = loadTemplate(view)
    .replace(/\{\{v:(\/[\w./-]+)\}\}/g, (_, p) => assetUrl(p))
    .replace(/\{\{([ta]):([\w.]+)\}\}/g, (whole, kind, key) => {
      if (!(key in values)) return whole;
      return kind === 't' ? renderText(values[key]) : escHtml(values[key]);
    });
  if (editing) {
    // Only signed-in admins get the editor; visitors never download it.
    html = html.replace('</head>', `  <link rel="stylesheet" href="${assetUrl('/edit.css')}">\n</head>`)
      .replace('</body>', `  <script type="module" src="${assetUrl('/edit.js')}"></script>\n</body>`);
  }
  return html;
}
