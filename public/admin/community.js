// Admin tabs for the F1 Girlies page: watch parties + reservations, quiniela, photo wall moderation.
import { api, uploadImage, esc, toast } from '/js/cms-kit.js';

const TZ = 'America/Puerto_Rico';
const fmtWhen = new Intl.DateTimeFormat('es-PR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ });
const when = (iso) => fmtWhen.format(new Date(iso)).replace(/\./g, '');
// UTC ISO → "YYYY-MM-DDTHH:MM" in Puerto Rico time (UTC−4, no daylight saving) for <input type="datetime-local">.
const toLocalInput = (iso) => new Date(Date.parse(iso) - 4 * 36e5).toISOString().slice(0, 16);
const STATUS = { confirmed: 'Confirmada', waitlist: 'En espera', cancelled: 'Cancelada' };

function errorBox(root) {
  const el = root.querySelector('.a-error');
  return (msg) => { el.textContent = msg || ''; el.hidden = !msg; };
}

/* ---------- watch parties ---------- */

export async function eventsTab(root) {
  const { events, races } = await api('/api/admin/events');
  const now = Date.now();
  const upcoming = events.filter((e) => Date.parse(e.startsAt) > now - 2 * 36e5).reverse();
  const past = events.filter((e) => Date.parse(e.startsAt) <= now - 2 * 36e5);
  const nextRace = races.find((r) => Date.parse(r.raceAt) > now);

  root.innerHTML = `
    <details class="a-card" id="ev-new"${events.length ? '' : ' open'}>
      <summary>＋ Nuevo watch party</summary>
      ${eventForm(races, null, nextRace)}
    </details>
    <h2 class="a-h2">Próximos</h2>
    ${upcoming.length ? upcoming.map((e) => eventCard(e, races)).join('') : '<p class="a-muted">No hay watch parties próximos. Crea uno arriba.</p>'}
    ${past.length ? `<h2 class="a-h2">Pasados</h2>${past.map((e) => eventCard(e, races)).join('')}` : ''}`;

  root.querySelectorAll('form.a-ev-form').forEach((form) => wireEventForm(form, root, races));

  // Assigned (not addEventListener) so re-rendering the tab never stacks duplicate handlers.
  root.onclick = async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const { act, id } = btn.dataset;
    try {
      if (act === 'delete-event') {
        if (!confirm('¿Eliminar este watch party y todas sus reservas? No se puede deshacer.')) return;
        await api(`/api/admin/events/${id}`, { method: 'DELETE' });
        toast('Eliminado');
      } else if (act === 'rsvp') {
        await api(`/api/admin/rsvps/${id}`, { method: 'PUT', body: { status: btn.dataset.status } });
        toast('Reserva actualizada');
      } else return;
      eventsTab(root);
    } catch (err) {
      toast(err.message, 'error');
    }
  };
}

function eventForm(races, ev, defaultRace) {
  const race = ev ? ev.raceRound : defaultRace?.round;
  const start = ev ? toLocalInput(ev.startsAt) : defaultRace ? toLocalInput(defaultRace.raceAt) : '';
  return `
    <form class="a-ev-form" data-id="${ev ? ev.id : ''}">
      <div class="a-grid2">
        <label class="a-field"><span>Carrera (opcional)</span>
          <select name="raceRound"><option value="">— Ninguna —</option>
            ${races.map((r) => `<option value="${r.round}"${r.round === race ? ' selected' : ''}>R${r.round} · ${esc(r.name)}</option>`).join('')}
          </select>
          <small>Si eliges una carrera, el título y la hora se pueden llenar solos.</small>
        </label>
        <label class="a-field"><span>Título (opcional)</span><input type="text" name="title" maxlength="80" value="${esc(ev?.rawTitle || '')}" placeholder="Watch party · GP de …"></label>
        <label class="a-field"><span>Fecha y hora (hora de PR)</span><input type="datetime-local" name="startsLocal" required value="${start}"></label>
        <label class="a-field"><span>Asientos</span><input type="number" name="capacity" min="0" max="5000" value="${ev ? ev.capacity : 30}"><small>0 = sin límite. Cuenta a las invitadas.</small></label>
        <label class="a-field"><span>Lugar</span><input type="text" name="venue" maxlength="80" required value="${esc(ev?.venue || '')}" placeholder="Nombre del restaurante o bar"></label>
        <label class="a-field"><span>Dirección (opcional)</span><input type="text" name="address" maxlength="140" value="${esc(ev?.address || '')}"></label>
        <label class="a-field"><span>Enlace de Google Maps (opcional)</span><input type="url" name="mapUrl" maxlength="500" value="${esc(ev?.mapUrl || '')}" placeholder="https://maps.app.goo.gl/…"></label>
        <label class="a-field"><span>Notas (opcional)</span><input type="text" name="notes" maxlength="400" value="${esc(ev?.notes || '')}" placeholder="Ej.: ven con tu merch favorita"></label>
      </div>
      <label class="a-check"><input type="checkbox" name="published"${!ev || ev.published ? ' checked' : ''}> Visible en la página</label>
      <p class="a-error" role="alert" hidden></p>
      <div class="a-row-actions">
        <button class="a-btn" type="submit">${ev ? 'Guardar cambios' : 'Crear watch party'}</button>
      </div>
    </form>`;
}

function wireEventForm(form, root, races) {
  const fail = errorBox(form);
  // On a new event, picking a race pre-fills the time with the race start (until the owner edits the time herself).
  form.raceRound.addEventListener('change', () => {
    const race = races.find((r) => String(r.round) === form.raceRound.value);
    if (race && !form.dataset.id && !form.startsLocal.dataset.touched) form.startsLocal.value = toLocalInput(race.raceAt);
  });
  form.startsLocal.addEventListener('input', () => { form.startsLocal.dataset.touched = '1'; });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    fail('');
    const body = {
      raceRound: form.raceRound.value || null,
      title: form.title.value,
      startsLocal: form.startsLocal.value,
      capacity: form.capacity.value,
      venue: form.venue.value,
      address: form.address.value,
      mapUrl: form.mapUrl.value,
      notes: form.notes.value,
      published: form.published.checked,
    };
    try {
      if (form.dataset.id) await api(`/api/admin/events/${form.dataset.id}`, { method: 'PUT', body });
      else await api('/api/admin/events', { method: 'POST', body });
      toast('Guardado ✓');
      eventsTab(root);
    } catch (err) {
      fail(err.message);
    }
  });
}

function eventCard(e, races) {
  const confirmed = e.rsvps.filter((r) => r.status === 'confirmed');
  const waiting = e.rsvps.filter((r) => r.status === 'waitlist');
  const people = confirmed.reduce((n, r) => n + 1 + r.guests, 0);
  const rows = e.rsvps.map((r) => `
    <tr class="is-${r.status}">
      <td>${esc(r.name)}</td><td>${esc(r.contact)}</td><td>${r.guests ? `+${r.guests}` : '—'}</td><td>${STATUS[r.status]}</td>
      <td class="a-nowrap">
        ${r.status !== 'cancelled' ? `<button class="a-link" data-act="rsvp" data-status="cancelled" data-id="${r.id}">Cancelar</button>` : ''}
        ${r.status !== 'confirmed' ? `<button class="a-link" data-act="rsvp" data-status="confirmed" data-id="${r.id}">Confirmar</button>` : ''}
      </td>
    </tr>`).join('');
  return `
    <article class="a-card a-ev">
      <div class="a-ev__head">
        <div>
          <h3>${esc(e.title)}${e.published ? '' : ' <span class="a-pill">Oculto</span>'}</h3>
          <p class="a-muted">${esc(when(e.startsAt))} · ${esc(e.venue)}</p>
          <p><strong>${people}</strong>${e.capacity ? ` de ${e.capacity}` : ''} personas confirmadas${waiting.length ? ` · ${waiting.length} en espera` : ''}</p>
        </div>
        <div class="a-ev__actions">
          <a class="a-small-btn" href="/api/admin/events/${e.id}/csv">⬇ Lista (Excel)</a>
          <button class="a-small-btn a-danger" data-act="delete-event" data-id="${e.id}">Eliminar</button>
        </div>
      </div>
      <details><summary>Reservas (${e.rsvps.length})</summary>
        ${e.rsvps.length ? `<div class="a-table-wrap"><table class="a-table"><thead><tr><th>Nombre</th><th>Contacto</th><th>Invitadas</th><th>Estado</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="a-muted">Nadie ha reservado todavía.</p>'}
      </details>
      <details><summary>Editar</summary>${eventForm(races, e)}</details>
    </article>`;
}

/* ---------- quiniela ---------- */

export async function quinielaTab(root) {
  const q = await api('/api/admin/quiniela');
  const c = q.current;
  root.innerHTML = `
    <div class="a-card">
      <h3>${c ? `R${c.round} · ${esc(c.name)}` : 'Temporada terminada'}</h3>
      ${c ? `<p>${c.open ? `✅ Abierta: cierra ${esc(when(c.lockAt))} (cuando empieza la clasificación).` : '🔒 Cerrada: esperando los resultados oficiales.'}</p>` : ''}
      <p class="a-muted">Los puntos se calculan solos con los resultados oficiales (${q.score.exact} por posición exacta, ${q.score.onPodium} si está en el podio en otra posición, +${q.score.perfectBonus} por podio perfecto). Si un apodo es ofensivo o es spam, ocúltalo y deja de contar.</p>
    </div>
    <h2 class="a-h2">Tabla de la temporada</h2>
    <div class="a-card">${q.leaderboard.length ? `<div class="a-table-wrap"><table class="a-table"><thead><tr><th>#</th><th>Apodo</th><th>Puntos</th><th>Exactos</th><th>Carreras</th></tr></thead><tbody>
      ${q.leaderboard.map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.nickname)}</td><td><strong>${p.pts}</strong></td><td>${p.exact}</td><td>${p.races}</td></tr>`).join('')}
    </tbody></table></div>` : '<p class="a-muted">Todavía no hay carreras puntuadas.</p>'}</div>
    <h2 class="a-h2">Predicciones por carrera</h2>
    ${q.rounds.length ? q.rounds.map((r) => `
      <details class="a-card"${c && r.round === c.round ? ' open' : ''}>
        <summary>R${r.round} · ${esc(r.name)} — ${r.entries.length} ${r.entries.length === 1 ? 'predicción' : 'predicciones'}</summary>
        ${r.podium ? `<p class="a-muted">Podio oficial: ${r.podium.map(esc).join(' · ')}</p>` : '<p class="a-muted">Sin resultados todavía.</p>'}
        <div class="a-table-wrap"><table class="a-table"><thead><tr><th>Apodo</th><th>Instagram</th><th>Podio elegido</th><th>Pts</th><th></th></tr></thead><tbody>
          ${r.entries.map((x) => `<tr class="${x.hidden ? 'is-cancelled' : ''}"><td>${esc(x.nickname)}</td><td>@${esc(x.handle)}</td><td>${x.picks.map(esc).join(' · ')}</td><td>${x.pts ?? '—'}</td>
            <td><button class="a-link" data-hide="${x.id}" data-hidden="${x.hidden ? 0 : 1}">${x.hidden ? 'Mostrar' : 'Ocultar'}</button></td></tr>`).join('')}
        </tbody></table></div>
      </details>`).join('') : '<p class="a-muted">Nadie ha jugado todavía.</p>'}`;

  root.querySelectorAll('[data-hide]').forEach((b) => b.addEventListener('click', async () => {
    try {
      await api(`/api/admin/predictions/${b.dataset.hide}`, { method: 'PUT', body: { hidden: b.dataset.hidden === '1' } });
      toast('Listo');
      quinielaTab(root);
    } catch (err) { toast(err.message, 'error'); }
  }));
}

/* ---------- photos ---------- */

export async function photosTab(root, onCount) {
  const { pending, approved } = await api('/api/admin/photos');
  onCount?.(pending.length);
  const card = (p, isPending) => `
    <figure class="a-photo" data-id="${p.id}">
      <img src="${esc(p.url)}" alt="" loading="lazy">
      <figcaption>
        <input type="text" data-f="caption" value="${esc(p.caption)}" maxlength="140" placeholder="Descripción">
        <input type="text" data-f="credit" value="${esc(p.credit)}" maxlength="40" placeholder="Crédito (@usuario)">
        <div class="a-row-actions">
          ${isPending ? '<button class="a-small-btn a-ok" data-photo="approve">Aprobar</button>' : '<button class="a-small-btn" data-photo="save">Guardar texto</button>'}
          <button class="a-small-btn a-danger" data-photo="delete">${isPending ? 'Rechazar' : 'Quitar'}</button>
        </div>
        ${p.source === 'member' ? '<small class="a-muted">Enviada por una visitante</small>' : ''}
      </figcaption>
    </figure>`;
  root.innerHTML = `
    <div class="a-card">
      <h3>Subir fotos tuyas</h3>
      <p class="a-muted">Se publican de inmediato en el muro de fotos.</p>
      <div class="a-grid2">
        <label class="a-field"><span>Descripción (opcional)</span><input type="text" id="own-caption" maxlength="140"></label>
        <label class="a-field"><span>Crédito (opcional)</span><input type="text" id="own-credit" maxlength="40" placeholder="@usuario"></label>
      </div>
      <label class="pl-upload"><input type="file" accept="image/*" id="own-file" multiple hidden><span>📷 Elegir fotos</span></label>
      <p class="a-error" role="alert" hidden></p>
    </div>
    <h2 class="a-h2">Por revisar (${pending.length})</h2>
    ${pending.length ? `<div class="a-photos">${pending.map((p) => card(p, true)).join('')}</div>` : '<p class="a-muted">No hay fotos esperando revisión.</p>'}
    <h2 class="a-h2">Publicadas (${approved.length})</h2>
    ${approved.length ? `<div class="a-photos">${approved.map((p) => card(p, false)).join('')}</div>` : '<p class="a-muted">Todavía no hay fotos publicadas.</p>'}`;

  const fail = errorBox(root.querySelector('.a-card'));
  root.querySelector('#own-file').addEventListener('change', async (e) => {
    const files = [...e.target.files];
    if (!files.length) return;
    fail('');
    try {
      for (const f of files) {
        const url = await uploadImage(f);
        await api('/api/admin/photos', { method: 'POST', body: { url, caption: root.querySelector('#own-caption').value, credit: root.querySelector('#own-credit').value } });
      }
      toast(files.length === 1 ? 'Foto publicada ✓' : `${files.length} fotos publicadas ✓`);
      photosTab(root, onCount);
    } catch (err) {
      fail(err.message);
    }
  });

  root.querySelectorAll('[data-photo]').forEach((b) => b.addEventListener('click', async () => {
    const fig = b.closest('.a-photo');
    const id = fig.dataset.id;
    const caption = fig.querySelector('[data-f="caption"]').value;
    const credit = fig.querySelector('[data-f="credit"]').value;
    try {
      if (b.dataset.photo === 'delete') {
        if (!confirm('¿Quitar esta foto? Si la envió una visitante, se borra el archivo.')) return;
        await api(`/api/admin/photos/${id}`, { method: 'DELETE' });
      } else {
        await api(`/api/admin/photos/${id}`, { method: 'PUT', body: { caption, credit, approve: b.dataset.photo === 'approve' } });
      }
      toast('Listo ✓');
      photosTab(root, onCount);
    } catch (err) { toast(err.message, 'error'); }
  }));
}
