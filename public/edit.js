// On-page editor. The server only includes this file for a signed-in admin.
// Edit mode on → every spot marked data-k (text/photo) or data-k-href (link) becomes click-to-edit.
import { api, uploadImage, esc, toast } from '/js/cms-kit.js';

const MODE_KEY = 'pl-edit-mode';
let data = null; // { fields, values, overridden }

const readMode = () => { try { return localStorage.getItem(MODE_KEY) !== 'off'; } catch { return true; } };
const writeMode = (on) => { try { localStorage.setItem(MODE_KEY, on ? 'on' : 'off'); } catch { /* private mode */ } };

/* ---------- toolbar ---------- */

const bar = document.createElement('div');
bar.className = 'pl-bar';
bar.innerHTML = `
  <span class="pl-bar__dot" aria-hidden="true"></span>
  <label class="pl-bar__switch"><input type="checkbox" id="pl-mode"> <span>Modo edición</span></label>
  <span class="pl-bar__hint">Toca cualquier texto o foto marcada para cambiarla</span>
  <a class="pl-bar__btn" href="/admin">Panel</a>
  <button class="pl-bar__btn" type="button" id="pl-logout">Salir</button>`;
document.body.append(bar);
const modeInput = bar.querySelector('#pl-mode');

function setMode(on) {
  document.body.classList.toggle('pl-editing', on);
  modeInput.checked = on;
  writeMode(on);
}
modeInput.addEventListener('change', () => setMode(modeInput.checked));
bar.querySelector('#pl-logout').addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' }).catch(() => {});
  location.reload();
});

/* ---------- applying values to the page ---------- */

function applyValue(key, value, html) {
  data.values[key] = value;
  document.querySelectorAll(`[data-k="${CSS.escape(key)}"]`).forEach((el) => {
    if (el.tagName === 'IMG') el.src = value;
    else el.innerHTML = html;
  });
  document.querySelectorAll(`[data-k-href="${CSS.escape(key)}"]`).forEach((el) => {
    el.href = data.fields[key].type === 'email' ? `mailto:${value}` : value;
  });
  if (key.endsWith('.alt')) {
    document.querySelectorAll(`img[data-k="${CSS.escape(key.slice(0, -4))}"]`).forEach((el) => { el.alt = value; });
  }
}

/* ---------- modal ---------- */

const modal = document.createElement('dialog');
modal.className = 'pl-modal';
document.body.append(modal);

function fieldHtml(key, { autofocus } = {}) {
  const f = data.fields[key];
  const v = data.values[key];
  const restore = data.overridden.includes(key)
    ? `<button type="button" class="pl-link" data-restore="${esc(key)}">↺ Restaurar original</button>` : '';
  const help = f.help ? `<small class="pl-help">${esc(f.help)}</small>` : '';
  const af = autofocus ? ' autofocus' : '';
  if (f.type === 'image') {
    const alt = `${key}.alt`;
    return `
      <div class="pl-field" data-key="${esc(key)}">
        <span class="pl-label">${esc(f.label)}</span>
        <img class="pl-preview" src="${esc(v)}" alt="">
        <label class="pl-upload">
          <input type="file" accept="image/*" data-upload="${esc(key)}" hidden>
          <span>📷 Subir foto nueva</span>
        </label>
        <input type="hidden" name="${esc(key)}" value="${esc(v)}">
        ${help}${restore}
      </div>
      <label class="pl-field">
        <span class="pl-label">Descripción de la foto <em>(para personas con discapacidad visual y Google)</em></span>
        <input type="text" name="${esc(alt)}" value="${esc(data.values[alt])}" maxlength="200">
      </label>`;
  }
  const input = f.type === 'textarea'
    ? `<textarea name="${esc(key)}" rows="4" maxlength="1200"${af}>${esc(v)}</textarea>`
    : `<input type="${f.type === 'email' ? 'email' : f.type === 'url' ? 'url' : 'text'}" name="${esc(key)}" value="${esc(v)}" maxlength="500"${af}>`;
  return `<label class="pl-field" data-key="${esc(key)}"><span class="pl-label">${esc(f.label)}</span>${input}${help}${restore}</label>`;
}

function openEditor(keys) {
  modal.innerHTML = `
    <form method="dialog" class="pl-form">
      <h2 class="pl-title">Editar</h2>
      ${keys.map((k, i) => fieldHtml(k, { autofocus: i === 0 })).join('')}
      <p class="pl-error" role="alert" hidden></p>
      <div class="pl-actions">
        <button type="button" class="pl-btn pl-btn--ghost" value="cancel">Cancelar</button>
        <button type="submit" class="pl-btn">Guardar</button>
      </div>
    </form>`;
  const form = modal.querySelector('form');
  const errorEl = form.querySelector('.pl-error');
  const showError = (msg) => { errorEl.textContent = msg; errorEl.hidden = !msg; };

  form.querySelector('[value="cancel"]').addEventListener('click', () => modal.close());

  form.querySelectorAll('[data-upload]').forEach((input) => {
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      const field = input.closest('.pl-field');
      field.classList.add('is-busy');
      showError('');
      try {
        const url = await uploadImage(file);
        field.querySelector('.pl-preview').src = url;
        form.elements[input.dataset.upload].value = url;
      } catch (err) {
        showError(err.message);
      } finally {
        field.classList.remove('is-busy');
        input.value = '';
      }
    });
  });

  form.querySelectorAll('[data-restore]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const key = btn.dataset.restore;
      try {
        const r = await api(`/api/content/${encodeURIComponent(key)}`, { method: 'DELETE' });
        applyValue(key, r.value, r.html);
        data.overridden = data.overridden.filter((k) => k !== key);
        toast('Restaurado');
        modal.close();
      } catch (err) {
        showError(err.message);
      }
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showError('');
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    submit.textContent = 'Guardando…';
    try {
      const names = [...new Set([...form.elements].map((el) => el.name).filter(Boolean))];
      for (const key of names) {
        const value = form.elements[key].value;
        if (value === data.values[key]) continue;
        const r = await api(`/api/content/${encodeURIComponent(key)}`, { method: 'PUT', body: { value } });
        applyValue(key, r.value, r.html);
        if (r.value === data.fields[key].default) data.overridden = data.overridden.filter((k) => k !== key);
        else if (!data.overridden.includes(key)) data.overridden.push(key);
      }
      toast('Guardado ✓');
      modal.close();
    } catch (err) {
      showError(err.message);
      submit.disabled = false;
      submit.textContent = 'Guardar';
    }
  });

  modal.showModal();
}

/* ---------- click to edit ---------- */

// Capture phase so links don't navigate and page scripts (carousel, menu) don't react while editing.
document.addEventListener('click', (e) => {
  if (!document.body.classList.contains('pl-editing') || !data) return;
  if (e.target.closest('.pl-bar, .pl-modal')) return;
  const textEl = e.target.closest('[data-k]');
  const linkEl = e.target.closest('[data-k-href]');
  if (!textEl && !linkEl) {
    if (e.target.closest('a')) e.preventDefault(); // don't leave the page by accident
    return;
  }
  e.preventDefault();
  e.stopPropagation();
  const keys = [];
  if (textEl) keys.push(textEl.dataset.k);
  if (linkEl && !keys.includes(linkEl.dataset.kHref)) keys.push(linkEl.dataset.kHref);
  openEditor(keys.filter((k) => data.fields[k]));
}, true);

/* ---------- start ---------- */

api('/api/content')
  .then((payload) => {
    data = payload;
    setMode(readMode());
  })
  .catch(() => {
    bar.querySelector('.pl-bar__hint').textContent = 'Tu sesión venció. Entra otra vez desde el Panel.';
  });
