# phanielopez.com

Website for Stephanie "Phanie" López, an F1 content creator from Puerto Rico. Stephanie owns the site and is not a programmer, so she changes every text and photo herself by clicking on the page. No code or redeploys are involved.

- **Stack:** Node 22 + Express + SQLite (Node's built-in `node:sqlite`, so there's nothing native to compile). The front end is plain HTML/CSS/JS.
- **Runs on:** port **5196** locally (`npm run dev`).

---

## Run it locally

```bash
npm install
npm run dev          # http://localhost:5196  (restarts on file changes)
```

> The page is now a **template** the server fills in. If you open `views/index.html` directly, or serve the folder with `python -m http.server`, you'll see raw `{{t:…}}` placeholders. Always use `npm run dev`.

The first run creates `data/phanie.db` and `data/uploads/`. Both are git-ignored.

## How the content system works

| Piece | File |
|---|---|
| Every editable text/photo, with its Spanish label and default | `server/content-schema.js` |
| Page template (`{{t:key}}` = text, `{{a:key}}` = attribute, `data-k` = clickable in edit mode) | `views/index.html` |
| Reading/saving content + rendering the template | `server/content.js` |
| On-page editor (only sent to signed-in admins) | `public/edit.js`, `public/edit.css` |
| Admin panel: sign-in, forgot password, invite activation, full field list, change password | `public/admin/` |
| Accounts, sessions, invites, reset links | `server/auth.js` |
| Email via Resend | `server/email.js` |

- **Overrides only:** the database stores only the fields Stephanie has changed. A field with no row shows its default. "↺ Restaurar original" deletes the row.
- **Photos:** they're shrunk in the browser to 1800px max and re-encoded as JPEG (quality 0.82) before upload. That strips GPS/camera data and keeps files small. They're saved to `DATA_DIR/uploads/`.
- **Adding a new editable spot:**
  1. Add a field to `content-schema.js`.
  2. Put `{{t:your.key}}` and `data-k="your.key"` in the template. Links use `href="{{a:your.key}}" data-k-href="your.key"`.

  The server leaves unknown keys visible, so a typo shows up on the page.
- **Not editable on purpose:** the F1 calendar. It reads `public/f1-2026.js` and refreshes winners and session times from the Jolpica F1 API when the page loads.
- **Calendar gestures** (`public/main.js`, search "Swipe / drag"):
  - Finger or mouse drag: the cards follow, then a swipe of 40 px or more (or any quick flick) moves at least one card, and fast flicks carry on for up to 4 more. Tune it with `SWIPE_MIN`, `FLICK_SPEED`, `MOMENTUM` and `MAX_EXTRA`.
  - Two-finger trackpad swipe: one card per swipe.
  - Vertical scrolling over the calendar is left to the page.

## F1 Girlies page (`/f1-girlies`, also `/comunidad`)

A community page for F1 Girlies PR. **Visitors never create an account.**

| Part | How it works without accounts | Owner side (`/admin` tabs) |
|---|---|---|
| **Join** | "Únete en Instagram" button. While `girlies.igLink` is `#` it shows "Muy pronto en Instagram" and does nothing. | Paste the IG community link in *Contenido → F1 Girlies · Portada e Instagram*, or click the button in edit mode. |
| **Watch parties** | RSVP = name + Instagram **or** phone + up to 3 guests. One RSVP per person per event. Full events go to a waitlist, and a cancellation moves people up automatically. The visitor gets a private cancel link (`/f1-girlies?cancelar=<token>`), and their device remembers the reservation. | **Watch parties** tab: create/edit/hide/delete events (optionally tied to a race, which pre-fills the time), see reservations, cancel or confirm people, download the list (CSV for Excel/Sheets). |
| **Quiniela** | Pick the podium before qualifying starts with a nickname + Instagram handle. A random httpOnly device cookie (`pl_q`) lets the same device edit its pick, and another device can't take over that handle for that race. Scoring is automatic from the Jolpica results API: 3 points for the exact position, 1 for on the podium in another position, +2 for a perfect podium. | **Quiniela** tab: season table, every pick per race, hide an entry (spam or rude nickname) so it stops counting. |
| **Photo wall** | Visitors can send a photo (resized in the browser, consent checkbox). It's stored in `DATA_DIR/pending/`, **never public until approved.** | **Fotos** tab (with a badge for pending photos): approve, reject (deletes the file), edit captions, upload her own photos (published right away). |
| **Texts** | Hero, "qué hacemos", section titles, rules, testimonials (*placeholders marked "Ejemplo ·" — replace with real quotes*), FAQ, closing CTA. | All editable on the page or in *Contenido → F1 Girlies · …*. |

- **Server:** `server/community.js` (tables `events`, `rsvps`, `predictions`, `photos`, `kv`). The race calendar comes from `public/f1-2026.js` (read on the server too), so session and lock times have a single source. The 2026 grid refreshes from the standings API every 12 h, with `server/f1-grid-2026.json` as the offline fallback. Podiums are cached for 30 min.
- **Abuse protection:** per-IP rate limits (RSVP 12/h, picks 30/h, photos 6/h), a hidden honeypot field on forms, max 100 photos waiting for review, input length limits, `<`/`>` stripped from names, everything escaped on render, and CSV cells protected against spreadsheet-formula injection.
- **Privacy:** the public API never returns names or contacts of people who reserved (only seat counts). The quiniela table shows nicknames, not Instagram handles.
- **Shared nav/footer:** `views/partials/` (`{{> nav}}`, `{{> footer}}`, `{{> sprite}}`); the mobile menu script is `public/nav.js`. Nav links are absolute (`/#calendario`), so they work from any page.

## Layout rule: the top bar always stays on top

`<main>` is its own stacking layer (`isolation: isolate` in `public/styles.css`). So **no `z-index` inside any section can rise above the sticky nav**, whatever value it uses. The calendar cards, for example, use up to 100. The site-wide layer order lives in one place, the `--z-*` tokens at the top of `styles.css`: nav 100, owner's edit bar 1000, toasts 1100.

- **New section or decoration:** z-index it freely inside `<main>`; it stays below the nav automatically.
- **Something that must float above the nav** (a new popup, for example): put it outside `<main>` and give it one of the `--z-*` tokens, or a `<dialog>`, which always renders on top.

## Page weight and caching

A first visit is **about 270 KB** in total (HTML, CSS and JS gzipped, plus fonts and the photos). Before this pass it was about 770 KB. A repeat visit downloads only the ~4 KB HTML.

- **Fonts are self-hosted** in `public/fonts/` (latin subset, OFL license). "Phanie Display" is Roboto Serif **pinned to one style** (opsz 144 · wdth 50 · wght 800): 28 KB instead of the 379 KB variable file. To change the heading look, download a different pinned instance from Google Fonts (`family=Roboto+Serif:opsz,wdth,wght@144,50,800`). Don't add axes back. Manrope (variable 400–800) and Space Mono 700 are the other two. There are no Google requests at all, which also keeps visitors' IPs away from Google.
- **Asset links are versioned:** the template writes `{{v:/styles.css}}` → `/styles.css?v=<hash>`, so CSS/JS cache for a year and a deploy changes the URL. Fonts and `/img` cache for 30 days. Uploaded photos cache for a year (they get a new random name when replaced). HTML and the admin files revalidate on every load.
- **gzip** comes from the `compression` middleware. Scripts load with `defer`; the hero photo has `fetchpriority="high"`; images below the fold are lazy.

## Accounts — Stephanie's admin account

Accounts are created **without a password**. You run one command, and it prints a one-time link. Stephanie opens the link and picks her own password, so nobody else ever knows it. The link lasts 7 days and dies on first use. Running the command again replaces the link.

```bash
npm run admin:invite -- --email HER_EMAIL --name "Stephanie López" --url https://phanielopez.com
```

> ⚠️ **Run it where the real database lives.** An account made on your laptop exists only in your laptop's `data/phanie.db`. It doesn't deploy (the same trap as Josué's and Kovalent's sites). On Railway: `railway ssh` → `npm run admin:invite -- …`.

Make one for yourself too if you want a way in: `--email suarezangel.se@gmail.com --name "Angel"`. To delete an account: `npm run admin:invite -- --email X --remove`.

Once she's in, Stephanie can change her password in the panel ("Tu cuenta"). If she forgets it, "¿Olvidaste tu contraseña?" on the sign-in page emails her a link.

## Forgot password (same design as Josué's platform)

- **The link:** a random token. Only its SHA-256 is stored. It lasts **60 minutes**, works **once**, and requesting a new one kills the old one.
- **Using it** sets the new password, signs the account out everywhere else, and signs her in.
- **The answer** is the same whether or not the email has an account, so nobody can probe who's registered.
- **Rate limits:** 10 requests per IP per 15 min, and 3 per email per hour. Login has its own limit: 10 tries per 15 min per IP and per email.
- **Email delivery:** Resend, called with plain `fetch` and no SDK.
  - **Local dev without keys:** the email is **printed in the terminal**, so you can click the link from there.
  - **Production without keys:** the "¿Olvidaste…?" link is hidden and the endpoint answers 503.

### Turning email on (Resend)

1. Create a Resend account and add the domain `phanielopez.com`.
2. Add the DNS records Resend shows at the domain registrar (TXT `resend._domainkey`, the `send` records, and optionally `_dmarc`). Wait until Resend says *Verified*.
3. Create an API key, then set these on the server:
   - `RESEND_API_KEY=re_…`
   - `EMAIL_FROM="Phanie López <no-reply@phanielopez.com>"`
4. Restart. Test from `/admin/olvide`.

## Deploying (Railway, like the other sites)

The site needs a persistent disk because the database and photos live on the server. **Don't use a serverless host.**

1. New Railway project from the GitHub repo. Railway detects Node and runs `npm start`.
2. **Add a volume** mounted at `/data`.
3. Variables:
   - `NODE_ENV=production`
   - `DATA_DIR=/data`
   - `SITE_URL=https://phanielopez.com`
   - The two Resend variables above
4. Railway injects `PORT` (usually 8080). Point the generated or custom domain at that port.
5. Custom domain: on Railway, add `phanielopez.com` (+ `www`), then add the ALIAS/CNAME + TXT records it shows at the registrar.
6. `railway ssh` → run the invite command above → send Stephanie the link privately.

**Security already in place:**
- A strict CSP: everything is `'self'` (no inline scripts or styles, no third-party fonts). The only outside connection is `api.jolpi.ca` for live F1 results. `object-src 'none'`, `frame-ancestors 'none'`, and `upgrade-insecure-requests` in production.
- Other headers: `nosniff`, `X-Frame-Options: DENY`, COOP/CORP same-origin, `Origin-Agent-Cluster`, a strict Referrer-Policy and a Permissions-Policy; HSTS in production.
- **Reset links are built only from `SITE_URL` in production.** Forgot-password stays off until it's set, so a forged `Host` header can't point a victim's reset link at another site.
- **Live F1 data is treated as untrusted:** names from the API are trimmed and stripped of `<`/`>` on the way in and HTML-escaped when rendered, and session times must be real ISO timestamps. Tested by planting an `<img onerror>` "winner" in the cache: it showed as text and never ran.
- `robots.txt` keeps `/admin` and `/api/` out of search engines (the admin page also sends `noindex`).
- `npm audit`: 0 vulnerabilities (compression ≥ 1.8.2, body-parser ≥ 1.20.9 — run `npm audit` before each deploy).
- CSRF guard: API writes need the `x-requested-with: phanie` header.
- Cookies are httpOnly and `secure` in production.
- Sessions are stored as SHA-256 hashes.
- Uploads are checked by their file signature (JPEG/PNG/WEBP only, 8 MB max).
- Links are whitelisted (`https://`, `mailto:`, `#section`, `/path`), so a `javascript:` link can't be saved.

**Backups:** none are automatic yet. The whole site state is `DATA_DIR`: `phanie.db` (content, accounts, events, reservations, quiniela) plus `uploads/` and `pending/` (photos). Copy that folder to back it up.

## File map

```
server/            Express app, DB, auth, email, content schema + renderer
scripts/           admin-invite.js
views/index.html   home page template
views/girlies.html F1 Girlies page template
views/partials/    nav, footer, icon sprite (shared)
public/            static files: styles.css, main.js (calendar, crawl, carousel), f1-2026.js, img/, edit.*, admin/, js/cms-kit.js
data/              (git-ignored) phanie.db + uploads/
```
