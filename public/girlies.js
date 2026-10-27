// F1 Girlies page: watch parties (RSVP), quiniela, photo wall. No accounts anywhere:
// reservations and quiniela picks are remembered on this device (localStorage + a server cookie).
import { resizeImage } from '/js/cms-kit.js';

const TZ = 'America/Puerto_Rico';
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clean = (s) => s.replace(/\./g, '');
const fmtDay = new Intl.DateTimeFormat('es', { day: 'numeric', timeZone: TZ });
const fmtMonth = new Intl.DateTimeFormat('es', { month: 'short', timeZone: TZ });
const fmtWhen = new Intl.DateTimeFormat('es-PR', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ });
const fmtShort = new Intl.DateTimeFormat('es-PR', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ });

const store = {
  get(k, fallback) { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'x-requested-with': 'phanie', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Algo salió mal. Inténtalo otra vez.');
  return data;
}

// Honeypot: invisible to people, bots fill it in and get silently ignored by the server.
const honeypot = '<label class="g-hp" aria-hidden="true">No llenar <input type="text" name="website" tabindex="-1" autocomplete="off"></label>';

/* ---------- Instagram button: "Muy pronto" until the link exists ---------- */

document.querySelectorAll('.js-ig').forEach((a) => {
  if (a.getAttribute('href') !== '#') return;
  a.classList.add('is-soon');
  a.removeAttribute('target');
  a.setAttribute('aria-disabled', 'true');
  const label = a.querySelector('[data-k]');
  if (label && a.dataset.soon) label.textContent = a.dataset.soon;
  a.addEventListener('click', (e) => { if (!document.body.classList.contains('pl-editing')) e.preventDefault(); });
});

/* ---------- watch parties ---------- */

const eventsEl = $('#events');
const reservations = () => store.get('pl-rsvps', {}); // eventId → { token, status, name }

function seatsHtml(ev) {
  if (ev.capacity === 0) return ev.going ? `<p class="g-seats">${ev.going} ${ev.going === 1 ? 'persona va' : 'personas van'}</p>` : '';
  const pct = Math.min(100, Math.round(((ev.capacity - ev.seatsLeft) / ev.capacity) * 100));
  const text = ev.seatsLeft > 0 ? `Quedan <strong>${ev.seatsLeft}</strong> de ${ev.capacity} asientos` : '<strong>¡Lleno!</strong> Puedes entrar a la lista de espera';
  return `<div class="g-seats"><span class="g-seats__bar"><span data-pct="${pct}"></span></span><p>${text}</p></div>`;
}

function eventCard(ev) {
  const d = new Date(ev.startsAt);
  const mine = reservations()[ev.id];
  const action = mine
    ? `<div class="g-mine">
        <p>${mine.status === 'confirmed' ? '✅ <strong>Tienes asiento reservado.</strong>' : '⏳ <strong>Estás en la lista de espera.</strong> Te movemos si se libera un asiento.'}</p>
        <button type="button" class="g-textbtn" data-cancel="${ev.id}">Cancelar mi reserva</button>
      </div>`
    : `<details class="g-rsvp">
        <summary class="btn btn--lime">${ev.seatsLeft === 0 ? 'Entrar a la lista de espera' : 'Reservar mi asiento'}</summary>
        <form class="g-form" data-event="${ev.id}" novalidate>
          <label class="g-field"><span>Tu nombre</span><input type="text" name="name" maxlength="60" autocomplete="given-name" required></label>
          <label class="g-field"><span>Tu Instagram o teléfono</span><input type="text" name="contact" maxlength="40" placeholder="@tuusuario o 787-555-1234" autocapitalize="off" required></label>
          <label class="g-field"><span>¿Traes invitadas?</span>
            <select name="guests"><option value="0">No, voy sola</option><option value="1">+1</option><option value="2">+2</option><option value="3">+3</option></select>
          </label>
          ${honeypot}
          <p class="g-error" role="alert" hidden></p>
          <button class="btn btn--dark" type="submit">Confirmar reserva</button>
        </form>
      </details>`;
  return `
    <article class="g-event" data-id="${ev.id}">
      <div class="g-event__date" aria-hidden="true"><span>${clean(fmtMonth.format(d))}</span><strong>${fmtDay.format(d)}</strong></div>
      <div class="g-event__body">
        ${ev.raceName ? `<p class="g-event__race">🏁 ${esc(ev.raceName)}</p>` : ''}
        <h3>${esc(ev.title)}</h3>
        <p class="g-event__when">${esc(fmtWhen.format(d))} <span class="g-muted">(hora PR)</span></p>
        <p class="g-event__where"><strong>${esc(ev.venue)}</strong>${ev.address ? ` · ${esc(ev.address)}` : ''}
          ${ev.mapUrl ? ` · <a href="${esc(ev.mapUrl)}" target="_blank" rel="noopener">Cómo llegar ↗</a>` : ''}</p>
        ${ev.notes ? `<p class="g-event__notes">${esc(ev.notes)}</p>` : ''}
        ${seatsHtml(ev)}
        ${action}
      </div>
    </article>`;
}

function renderEvents(events) {
  $('#events-empty').hidden = events.length > 0;
  eventsEl.innerHTML = events.map(eventCard).join('');
  // Seats bar width via CSSOM: the strict CSP blocks inline style="" attributes but allows this.
  eventsEl.querySelectorAll('[data-pct]').forEach((s) => { s.style.width = `${Number(s.dataset.pct) || 0}%`; });
}

eventsEl.addEventListener('submit', async (e) => {
  const form = e.target.closest('form[data-event]');
  if (!form) return;
  e.preventDefault();
  const err = $('.g-error', form);
  const btn = $('[type="submit"]', form);
  err.hidden = true;
  btn.disabled = true;
  const f = Object.fromEntries(new FormData(form));
  try {
    const r = await post('/api/girlies/rsvp', { eventId: Number(form.dataset.event), ...f });
    const all = reservations();
    all[form.dataset.event] = { token: r.token, status: r.status, name: f.name };
    store.set('pl-rsvps', all);
    // Refresh the seat count on this card with the server's fresh numbers.
    const card = form.closest('.g-event');
    const seats = card.querySelector('.g-seats');
    if (seats && r.event) {
      seats.outerHTML = seatsHtml(r.event);
      card.querySelectorAll('[data-pct]').forEach((el) => { el.style.width = `${Number(el.dataset.pct) || 0}%`; });
    }
    const link = `${location.origin}/f1-girlies?cancelar=${r.token}`;
    form.closest('.g-rsvp').outerHTML = `
      <div class="g-mine g-mine--new">
        <p>${r.status === 'confirmed' ? '🎉 <strong>¡Estás dentro!</strong> Te esperamos.' : '⏳ <strong>Estás en la lista de espera.</strong> Si se libera un asiento, pasas automáticamente.'}</p>
        <p class="g-muted">Este teléfono o computadora recuerda tu reserva. Si necesitas cancelar desde otro lugar, guarda este enlace:</p>
        <p class="g-cancel-link"><code>${esc(link)}</code> <button type="button" class="g-textbtn" data-copy="${esc(link)}">Copiar</button></p>
        <button type="button" class="g-textbtn" data-cancel="${form.dataset.event}">Cancelar mi reserva</button>
      </div>`;
  } catch (ex) {
    err.textContent = ex.message;
    err.hidden = false;
    btn.disabled = false;
  }
});

async function cancelReservation(token, eventId) {
  if (!confirm('¿Seguro que quieres cancelar tu reserva?')) return;
  try {
    await post('/api/girlies/rsvp/cancel', { token });
    const all = reservations();
    if (eventId) delete all[eventId];
    else for (const [k, v] of Object.entries(all)) if (v.token === token) delete all[k];
    store.set('pl-rsvps', all);
    alert('Listo, tu reserva quedó cancelada.');
    loadAll();
  } catch (ex) {
    alert(ex.message);
  }
}

eventsEl.addEventListener('click', (e) => {
  const cancel = e.target.closest('[data-cancel]');
  if (cancel) {
    const id = cancel.dataset.cancel;
    const mine = reservations()[id];
    if (mine) cancelReservation(mine.token, id);
  }
  const copy = e.target.closest('[data-copy]');
  if (copy) {
    navigator.clipboard?.writeText(copy.dataset.copy).then(() => { copy.textContent = 'Copiado ✓'; }, () => {});
  }
});

/* ---------- quiniela ---------- */

const qEl = $('#quiniela-app');
let qData = null;

function countdown(iso) {
  const ms = Date.parse(iso) - Date.now();
  if (ms <= 0) return null;
  const d = Math.floor(ms / 864e5);
  const h = Math.floor((ms % 864e5) / 36e5);
  const m = Math.floor((ms % 36e5) / 6e4);
  return d > 0 ? `${d} ${d === 1 ? 'día' : 'días'} y ${h} h` : h > 0 ? `${h} h y ${m} min` : `${m} min`;
}

function driverOptions(drivers, selected) {
  return `<option value="">Elige piloto…</option>${drivers.map((d) => `<option value="${esc(d.id)}"${d.id === selected ? ' selected' : ''}>${esc(d.name)} · ${esc(d.team)}</option>`).join('')}`;
}

function leaderboardHtml(q) {
  if (!q.leaderboard.length) return '<p class="g-muted">La tabla aparece cuando termine la primera carrera con predicciones.</p>';
  return `
    <table class="g-table">
      <thead><tr><th scope="col">#</th><th scope="col">Apodo</th><th scope="col">Puntos</th><th scope="col" class="g-hide-sm">Exactos</th><th scope="col" class="g-hide-sm">Carreras</th></tr></thead>
      <tbody>${q.leaderboard.map((p, i) => `<tr${i < 3 ? ' class="is-top"' : ''}><td>${i + 1}</td><td>${esc(p.nickname)}</td><td><strong>${p.pts}</strong></td><td class="g-hide-sm">${p.exact}</td><td class="g-hide-sm">${p.races}</td></tr>`).join('')}</tbody>
    </table>`;
}

function renderQuiniela(q) {
  qData = q;
  const names = Object.fromEntries(q.drivers.map((d) => [d.id, d.name]));
  const remembered = store.get('pl-player', {});
  const c = q.current;
  let main;
  if (!c) {
    main = '<div class="g-q__card"><h3>La temporada terminó 🏁</h3><p>Gracias por jugar. ¡Nos vemos en 2027!</p></div>';
  } else {
    const head = `<p class="g-q__race">R${c.round} · ${esc(c.name)}</p>`;
    const mine = q.mine ? `<div class="g-q__mine"><p class="g-q__label">Tu podio${q.mine.nickname ? ` · ${esc(q.mine.nickname)}` : ''}</p><ol>${[q.mine.p1, q.mine.p2, q.mine.p3].map((id) => `<li>${esc(names[id] || id)}</li>`).join('')}</ol></div>` : '';
    if (c.open) {
      const left = countdown(c.lockAt);
      main = `
        <div class="g-q__card">
          ${head}
          <p class="g-q__lock">Cierra en <strong class="js-q-count">${left || '—'}</strong> · ${esc(clean(fmtShort.format(new Date(c.lockAt))))} (clasificación, hora PR)</p>
          <p class="g-muted">${c.entries} ${c.entries === 1 ? 'predicción' : 'predicciones'} hasta ahora</p>
          ${mine}
          <form class="g-form g-q__form" id="q-form" novalidate>
            <div class="g-q__row">
              <label class="g-field"><span>Apodo</span><input type="text" name="nickname" maxlength="24" required value="${esc(q.mine?.nickname || remembered.nickname || '')}"></label>
              <label class="g-field"><span>Instagram</span><input type="text" name="handle" maxlength="31" required placeholder="@tuusuario" autocapitalize="off" value="${esc(q.mine ? `@${q.mine.handle}` : remembered.handle || '')}"></label>
            </div>
            <div class="g-q__podium">
              <label class="g-field g-pos g-pos--1"><span>🥇 Primero</span><select name="p1" required>${driverOptions(q.drivers, q.mine?.p1)}</select></label>
              <label class="g-field g-pos g-pos--2"><span>🥈 Segundo</span><select name="p2" required>${driverOptions(q.drivers, q.mine?.p2)}</select></label>
              <label class="g-field g-pos g-pos--3"><span>🥉 Tercero</span><select name="p3" required>${driverOptions(q.drivers, q.mine?.p3)}</select></label>
            </div>
            ${honeypot}
            <p class="g-error" role="alert" hidden></p>
            <button class="btn btn--lime" type="submit">${q.mine ? 'Actualizar mi podio' : 'Guardar mi podio'}</button>
          </form>
        </div>`;
    } else {
      main = `<div class="g-q__card">${head}<p><strong>Predicciones cerradas:</strong> ya empezó la clasificación. Los puntos se suman cuando salgan los resultados oficiales.</p>${mine}</div>`;
    }
  }
  const last = q.last ? `
    <div class="g-q__card g-q__last">
      <p class="g-q__label">Última carrera · ${esc(q.last.name)}</p>
      <ol class="g-q__podium-result">${q.last.podium.map((n) => `<li>${esc(n)}</li>`).join('')}</ol>
      ${q.last.top.length ? `<p class="g-muted">Mejores predicciones: ${q.last.top.map((t) => `${esc(t.nickname)} (${t.pts})`).join(', ')}</p>` : '<p class="g-muted">Nadie jugó esa carrera.</p>'}
    </div>` : '';
  qEl.innerHTML = `
    <div class="g-q__main">${main}</div>
    <div class="g-q__side">
      <div class="g-q__card"><p class="g-q__label">Tabla de la temporada</p>${leaderboardHtml(q)}</div>
      ${last}
    </div>`;
}

qEl.addEventListener('submit', async (e) => {
  if (e.target.id !== 'q-form') return;
  e.preventDefault();
  const form = e.target;
  const err = $('.g-error', form);
  const btn = $('[type="submit"]', form);
  err.hidden = true;
  btn.disabled = true;
  const f = Object.fromEntries(new FormData(form));
  try {
    const r = await post('/api/girlies/quiniela', f);
    store.set('pl-player', { nickname: f.nickname, handle: f.handle });
    if (r.quiniela) renderQuiniela(r.quiniela);
    const note = document.createElement('p');
    note.className = 'g-success';
    note.textContent = r.updated ? '✓ Podio actualizado.' : '✓ ¡Podio guardado! Suerte.';
    $('.g-q__main .g-q__card', qEl)?.prepend(note);
  } catch (ex) {
    err.textContent = ex.message;
    err.hidden = false;
    btn.disabled = false;
  }
});

setInterval(() => {
  const el = $('.js-q-count', qEl);
  if (!el || !qData?.current) return;
  const left = countdown(qData.current.lockAt);
  if (left) el.textContent = left;
  else loadAll(); // picks just closed
}, 30e3);

/* ---------- photo wall ---------- */

const grid = $('#photo-grid');
const lightbox = $('#lightbox');

function renderPhotos(photos) {
  $('#photos-empty').hidden = photos.length > 0;
  grid.innerHTML = photos.map((p, i) => `
    <button type="button" class="g-photo" data-i="${i}" aria-label="Ver foto${p.caption ? `: ${esc(p.caption)}` : ''}">
      <img src="${esc(p.url)}" alt="${esc(p.caption)}" loading="lazy" decoding="async">
    </button>`).join('');
  grid.onclick = (e) => {
    const b = e.target.closest('.g-photo');
    if (!b) return;
    const p = photos[Number(b.dataset.i)];
    $('img', lightbox).src = p.url;
    $('img', lightbox).alt = p.caption;
    $('.g-lightbox__caption', lightbox).textContent = [p.caption, p.credit && `📷 ${p.credit}`].filter(Boolean).join(' · ');
    lightbox.showModal();
  };
}
$('.g-lightbox__close', lightbox).addEventListener('click', () => lightbox.close());
lightbox.addEventListener('click', (e) => { if (e.target === lightbox) lightbox.close(); });

$('#photo-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const err = $('.g-error', form);
  const btn = $('[type="submit"]', form);
  const show = (m) => { err.textContent = m; err.hidden = !m; };
  show('');
  const file = form.photo.files[0];
  if (!file) return show('Elige una foto.');
  if (!form.consent.checked) return show('Confirma que tienes permiso para compartirla.');
  btn.disabled = true;
  btn.textContent = 'Enviando…';
  try {
    const blob = await resizeImage(file, 1600);
    const res = await fetch('/api/girlies/photos', {
      method: 'POST',
      headers: {
        'x-requested-with': 'phanie',
        'Content-Type': 'image/jpeg',
        'x-consent': 'yes',
        'x-caption': encodeURIComponent(form.caption.value.slice(0, 140)),
        'x-credit': encodeURIComponent(form.credit.value.slice(0, 40)),
      },
      body: blob,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'No se pudo enviar la foto.');
    form.outerHTML = '<p class="g-success">¡Gracias! 💜 Stephanie revisará tu foto antes de publicarla.</p>';
  } catch (ex) {
    show(ex.message);
    btn.disabled = false;
    btn.textContent = 'Enviar foto';
  }
});

/* ---------- load everything (one request) ---------- */

async function loadAll() {
  try {
    const res = await fetch('/api/girlies', { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error();
    const data = await res.json();
    // Drop remembered reservations for events that are gone.
    const all = reservations();
    const ids = new Set(data.events.map((e) => String(e.id)));
    for (const k of Object.keys(all)) if (!ids.has(k)) delete all[k];
    store.set('pl-rsvps', all);
    renderEvents(data.events);
    renderQuiniela(data.quiniela);
    renderPhotos(data.photos);
  } catch {
    eventsEl.innerHTML = '<p class="g-muted">No pudimos cargar los eventos. Recarga la página en un momento.</p>';
    qEl.innerHTML = '';
  }
}

// Cancel link from another device: /f1-girlies?cancelar=<token>
const cancelToken = new URLSearchParams(location.search).get('cancelar');
if (cancelToken && /^[a-f0-9]{48}$/.test(cancelToken)) {
  history.replaceState(null, '', location.pathname + location.hash);
  cancelReservation(cancelToken);
}

loadAll();
