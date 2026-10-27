// Admin panel: sign in, forgot/reset password, invite activation, and the full list of editable content.
import { api, uploadImage, esc, toast } from '/js/cms-kit.js';
import { eventsTab, quinielaTab, photosTab } from '/admin/community.js';

const app = document.getElementById('app');
const topNav = document.getElementById('top-nav');
const params = new URLSearchParams(location.search);
const go = (path) => { location.href = path; };

document.getElementById('logout').addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' }).catch(() => {});
  go('/admin');
});

// Wires a form: collects named fields, calls `submit`, shows errors inline.
function bindForm(form, submit) {
  const errorEl = form.querySelector('.a-error');
  const button = form.querySelector('[type="submit"]');
  const label = button.textContent;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    button.disabled = true;
    button.textContent = 'Un momento…';
    try {
      await submit(Object.fromEntries(new FormData(form)));
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  });
}

const passwordFields = `
  <label class="a-field"><span>Nueva contraseña</span>
    <input type="password" name="password" autocomplete="new-password" minlength="10" required>
    <small>Al menos 10 caracteres. Una frase fácil de recordar funciona bien, p. ej. «parrilla de salida 2026».</small>
  </label>
  <label class="a-field"><span>Repite la contraseña</span>
    <input type="password" name="confirm" autocomplete="new-password" minlength="10" required>
  </label>`;

/* ---------- views ---------- */

function loginView(emailReady) {
  app.innerHTML = `
    <form class="a-card a-narrow" novalidate>
      <h1>Entrar al panel</h1>
      <label class="a-field"><span>Correo</span><input type="email" name="email" autocomplete="username" required autofocus></label>
      <label class="a-field"><span>Contraseña</span><input type="password" name="password" autocomplete="current-password" required></label>
      <p class="a-error" role="alert" hidden></p>
      <button class="a-btn" type="submit">Entrar</button>
      ${emailReady ? '<a class="a-link" href="/admin/olvide">¿Olvidaste tu contraseña?</a>' : ''}
    </form>`;
  bindForm(app.querySelector('form'), async (body) => {
    await api('/api/login', { method: 'POST', body });
    go('/admin');
  });
}

function forgotView() {
  app.innerHTML = `
    <form class="a-card a-narrow">
      <h1>¿Olvidaste tu contraseña?</h1>
      <p class="a-muted">Escribe el correo de tu cuenta y te enviamos un enlace para elegir una nueva.</p>
      <label class="a-field"><span>Correo</span><input type="email" name="email" autocomplete="username" required autofocus></label>
      <p class="a-error" role="alert" hidden></p>
      <button class="a-btn" type="submit">Enviarme el enlace</button>
      <a class="a-link" href="/admin">← Volver</a>
    </form>`;
  bindForm(app.querySelector('form'), async (body) => {
    await api('/api/forgot', { method: 'POST', body });
    app.innerHTML = `
      <div class="a-card a-narrow">
        <h1>Revisa tu correo</h1>
        <p>Si <strong>${esc(body.email)}</strong> tiene una cuenta, te llegará un enlace en unos minutos. Vence en 60 minutos y funciona una sola vez.</p>
        <p class="a-muted">¿No llega? Mira en «Spam» o «Promociones».</p>
        <a class="a-link" href="/admin">← Volver a entrar</a>
      </div>`;
  });
}

// Shared by the "forgot password" link (/admin/restablecer) and the invite link (/admin/activar).
async function choosePasswordView({ check, submitPath, title, intro }) {
  const token = params.get('token') || '';
  let info;
  try {
    info = await api(`${check}?token=${encodeURIComponent(token)}`);
  } catch (err) {
    app.innerHTML = `
      <div class="a-card a-narrow">
        <h1>Enlace no válido</h1>
        <p>${esc(err.message)}</p>
        <a class="a-btn" href="/admin/olvide">Pedir un enlace nuevo</a>
      </div>`;
    return;
  }
  app.innerHTML = `
    <form class="a-card a-narrow">
      <h1>${esc(title(info))}</h1>
      <p class="a-muted">${esc(intro(info))}</p>
      <input type="email" name="username" value="${esc(info.email)}" autocomplete="username" hidden>
      ${passwordFields}
      <p class="a-error" role="alert" hidden></p>
      <button class="a-btn" type="submit">Guardar y entrar</button>
    </form>`;
  bindForm(app.querySelector('form'), async ({ password, confirm }) => {
    await api(submitPath, { method: 'POST', body: { token, password, confirm } });
    go('/admin?bienvenida=1');
  });
}

function fieldRow(key, data) {
  const f = data.fields[key];
  const v = data.values[key];
  const changed = data.overridden.includes(key);
  const help = f.help ? `<small>${esc(f.help)}</small>` : '';
  let control;
  if (f.type === 'image') {
    const alt = `${key}.alt`;
    control = `
      <div class="a-img">
        <img src="${esc(v)}" alt="">
        <div class="a-img__side">
          <label class="pl-upload"><input type="file" accept="image/*" hidden><span>📷 Cambiar foto</span></label>
          <label class="a-field a-field--sm"><span>Descripción de la foto</span>
            <input type="text" data-alt="${esc(alt)}" value="${esc(data.values[alt])}" maxlength="200">
          </label>
        </div>
      </div>`;
  } else if (f.type === 'textarea') {
    control = `<textarea rows="3" maxlength="1200">${esc(v)}</textarea>`;
  } else {
    control = `<input type="${f.type === 'url' ? 'url' : f.type === 'email' ? 'email' : 'text'}" value="${esc(v)}" maxlength="500">`;
  }
  return `
    <div class="a-row${changed ? ' is-changed' : ''}" data-key="${esc(key)}">
      <div class="a-row__label">
        <span>${esc(f.label)}</span>
        ${changed ? '<button type="button" class="a-link a-restore">↺ Original</button>' : ''}
      </div>
      <div class="a-row__control">${control}${help}<p class="a-error" role="alert" hidden></p></div>
    </div>`;
}

async function dashboardView(user, emailReady) {
  topNav.hidden = false;
  const data = await api('/api/content');
  const welcome = params.has('bienvenida')
    ? `<div class="a-card a-welcome"><strong>¡Listo, ya tienes tu contraseña!</strong> Guárdala en un lugar seguro. Desde aquí puedes cambiar todo el contenido del sitio.</div>` : '';
  app.innerHTML = `
    ${welcome}
    <section class="a-card a-hello">
      <div>
        <h1>Hola${user.name ? `, ${esc(user.name.split(' ')[0])}` : ''} 👋</h1>
        <p class="a-muted">Hay dos formas de cambiar el sitio. La más fácil: <strong>edítalo directamente en la página</strong>.</p>
      </div>
      <a class="a-btn a-btn--big" href="/">✎ Editar el sitio en la página</a>
    </section>

    <nav class="a-tabs" role="tablist" aria-label="Secciones del panel">
      <button type="button" role="tab" data-tab="contenido">Contenido</button>
      <button type="button" role="tab" data-tab="watch-parties">Watch parties</button>
      <button type="button" role="tab" data-tab="quiniela">Quiniela</button>
      <button type="button" role="tab" data-tab="fotos">Fotos <span class="a-badge" id="photo-badge" hidden></span></button>
    </nav>
    <div class="a-tab" role="tabpanel" id="tab-watch-parties" hidden></div>
    <div class="a-tab" role="tabpanel" id="tab-quiniela" hidden></div>
    <div class="a-tab" role="tabpanel" id="tab-fotos" hidden></div>

    <div class="a-tab" role="tabpanel" id="tab-contenido">
    <details class="a-card a-help">
      <summary>¿Cómo funciona? (léelo una vez)</summary>
      <ol>
        <li>Pulsa <strong>«Editar el sitio en la página»</strong>. Verás una barra negra abajo con <strong>«Modo edición»</strong> encendido.</li>
        <li>Todo lo que tenga un <strong>borde punteado morado</strong> se puede cambiar: tócalo, escribe y pulsa <strong>Guardar</strong>. Los botones también te dejan cambiar a dónde llevan.</li>
        <li>Para una foto: tócala → <strong>«Subir foto nueva»</strong> → elige la foto de tu teléfono o computadora → <strong>Guardar</strong>. La foto se ajusta sola de tamaño.</li>
        <li>¿Te equivocaste? Abre ese mismo texto o foto y pulsa <strong>«↺ Restaurar original»</strong>.</li>
        <li>Apaga «Modo edición» para ver el sitio como lo ven tus visitantes. Los cambios se ven al instante para todo el mundo.</li>
        <li>Algunas cosas no están en la página (el título de la pestaña, la descripción para Google, los enlaces de redes). Esas están en la lista de abajo.</li>
        <li>La página <strong>F1 Girlies</strong> (<a href="/f1-girlies">/f1-girlies</a>) se edita igual. Los watch parties, la quiniela y las fotos que envían las visitantes se manejan en las pestañas de arriba.</li>
        <li>Cuando la comunidad de Instagram exista, pega su enlace en <strong>«F1 Girlies · Portada e Instagram» → «Enlace de la comunidad en Instagram»</strong>. Mientras tanto el botón dice «Muy pronto».</li>
      </ol>
      <p class="a-muted">El calendario de F1 se actualiza solo con los resultados oficiales; no hay que tocarlo.</p>
    </details>

    <h2 class="a-h2">Todo el contenido</h2>
    <p class="a-muted">Cada cambio se guarda solo al salir del campo (o al elegir una foto).</p>
    ${data.sections.map((s) => `
      <details class="a-card a-section"${s.id === 'meta' ? ' open' : ''}>
        <summary>${esc(s.label)}</summary>
        ${s.fields.map((f) => fieldRow(f.key, data)).join('')}
      </details>`).join('')}

    <h2 class="a-h2">Tu cuenta</h2>
    <form class="a-card a-narrow" id="pw-form">
      <h3>Cambiar contraseña</h3>
      <p class="a-muted">Cuenta: ${esc(user.email)}</p>
      <input type="email" name="username" value="${esc(user.email)}" autocomplete="username" hidden>
      <label class="a-field"><span>Contraseña actual</span><input type="password" name="current" autocomplete="current-password" required></label>
      ${passwordFields}
      <p class="a-error" role="alert" hidden></p>
      <button class="a-btn" type="submit">Cambiar contraseña</button>
      ${emailReady ? '' : '<p class="a-muted a-small">Nota: el correo de «¿Olvidaste tu contraseña?» aún no está activado en este servidor.</p>'}
    </form>
    </div>`;

  bindForm(document.getElementById('pw-form'), async (body) => {
    await api('/api/password', { method: 'POST', body });
    document.getElementById('pw-form').reset();
    toast('Contraseña cambiada ✓');
  });

  app.querySelectorAll('.a-row').forEach((row) => wireRow(row, data));
  setupTabs();
}

// Tabs: the open tab lives in the URL hash (#quiniela …) so a reload or a shared link keeps it.
const TABS = {
  'watch-parties': (el) => eventsTab(el),
  quiniela: (el) => quinielaTab(el),
  fotos: (el) => photosTab(el, setPhotoBadge),
};
function setPhotoBadge(n) {
  const b = document.getElementById('photo-badge');
  b.textContent = n;
  b.hidden = !n;
}
function setupTabs() {
  const buttons = [...app.querySelectorAll('[data-tab]')];
  const show = async (name) => {
    if (!buttons.some((b) => b.dataset.tab === name)) name = 'contenido';
    buttons.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    app.querySelectorAll('.a-tab').forEach((t) => { t.hidden = t.id !== `tab-${name}`; });
    const panel = document.getElementById(`tab-${name}`);
    if (TABS[name]) {
      panel.innerHTML = '<p class="a-muted">Cargando…</p>';
      try { await TABS[name](panel); } catch (err) { panel.innerHTML = `<p class="a-error">${esc(err.message)}</p>`; }
    }
  };
  buttons.forEach((b) => b.addEventListener('click', () => {
    history.replaceState(null, '', b.dataset.tab === 'contenido' ? location.pathname : `#${b.dataset.tab}`);
    show(b.dataset.tab);
  }));
  show(location.hash.slice(1));
  // Pending-photo count on the tab, so new visitor photos get noticed.
  api('/api/admin/photos').then((r) => setPhotoBadge(r.pending.length)).catch(() => {});
}

function wireRow(row, data) {
  const key = row.dataset.key;
  const errorEl = row.querySelector('.a-error');
  const fail = (msg) => { errorEl.textContent = msg; errorEl.hidden = !msg; };

  async function save(k, value) {
    if (value === data.values[k]) return;
    fail('');
    try {
      const r = await api(`/api/content/${encodeURIComponent(k)}`, { method: 'PUT', body: { value } });
      data.values[k] = r.value;
      if (r.value !== data.fields[k].default && !data.overridden.includes(k)) data.overridden.push(k);
      if (k === key) refresh();
      toast('Guardado ✓');
    } catch (err) {
      fail(err.message);
    }
  }

  // Re-render this row (shows/hides "↺ Original").
  function refresh() {
    const fresh = document.createElement('div');
    fresh.innerHTML = fieldRow(key, data);
    const next = fresh.firstElementChild;
    row.replaceWith(next);
    wireRow(next, data);
  }

  const input = row.querySelector('.a-row__control > input, .a-row__control > textarea');
  if (input) input.addEventListener('change', () => save(key, input.value));

  const file = row.querySelector('input[type="file"]');
  if (file) {
    file.addEventListener('change', async () => {
      if (!file.files[0]) return;
      row.classList.add('is-busy');
      fail('');
      try {
        const url = await uploadImage(file.files[0]);
        await save(key, url);
      } catch (err) {
        fail(err.message);
      } finally {
        row.classList.remove('is-busy');
      }
    });
  }
  const alt = row.querySelector('[data-alt]');
  if (alt) alt.addEventListener('change', () => save(alt.dataset.alt, alt.value));

  const restore = row.querySelector('.a-restore');
  if (restore) {
    restore.addEventListener('click', async () => {
      try {
        const r = await api(`/api/content/${encodeURIComponent(key)}`, { method: 'DELETE' });
        data.values[key] = r.value;
        data.overridden = data.overridden.filter((k) => k !== key);
        refresh();
        toast('Restaurado');
      } catch (err) {
        fail(err.message);
      }
    });
  }
}

/* ---------- router ---------- */

async function start() {
  const { user, emailReady } = await api('/api/me');
  const path = location.pathname.replace(/\/+$/, '');
  if (path === '/admin/olvide') return forgotView();
  if (path === '/admin/restablecer') {
    return choosePasswordView({
      check: '/api/reset', submitPath: '/api/reset',
      title: () => 'Elige una contraseña nueva',
      intro: (i) => `Para la cuenta ${i.email}. Al guardar, se cerrará la sesión en tus otros dispositivos.`,
    });
  }
  if (path === '/admin/activar') {
    return choosePasswordView({
      check: '/api/invite', submitPath: '/api/invite',
      title: (i) => `¡Bienvenida${i.name ? `, ${i.name.split(' ')[0]}` : ''}!`,
      intro: (i) => `Elige la contraseña para tu panel (${i.email}). Solo tú la vas a saber.`,
    });
  }
  if (!user) return loginView(emailReady);
  return dashboardView(user, emailReady);
}

start().catch((err) => {
  app.innerHTML = `<div class="a-card a-narrow"><h1>Ups</h1><p>${esc(err.message)}</p><a class="a-link" href="/admin">Reintentar</a></div>`;
});
