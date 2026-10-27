// Shared by the on-page editor (edit.js) and the admin panel (admin/admin.js).

// JSON API call. Throws an Error carrying the server's Spanish message.
export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: { 'x-requested-with': 'phanie', ...(body !== undefined && { 'Content-Type': 'application/json' }) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Algo salió mal. Inténtalo otra vez.'), { status: res.status });
  return data;
}

// Shrinks a photo in the browser before upload (max 1800px, JPEG q0.82). Re-encoding also drops camera
// metadata like GPS location, and turns huge phone photos into ~300–600 KB files.
export async function resizeImage(file, max = 1800) {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type) && !/\.(jpe?g|png|webp|heic)$/i.test(file.name)) {
    throw new Error('Elige una foto (JPG, PNG o WEBP).');
  }
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('No pude abrir esa foto. Prueba con otra (JPG o PNG).');
  }
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  if (!blob) throw new Error('No pude preparar la foto. Prueba con otra.');
  return blob;
}

export async function uploadImage(file) {
  const blob = await resizeImage(file);
  const res = await fetch('/api/uploads', {
    method: 'POST',
    headers: { 'x-requested-with': 'phanie', 'Content-Type': 'image/jpeg' },
    body: blob,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'No se pudo subir la foto.');
  return data.url;
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Small toast at the bottom of the screen.
export function toast(message, kind = 'ok') {
  let el = document.querySelector('.pl-toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'pl-toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = message;
  el.dataset.kind = kind;
  el.classList.add('is-on');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('is-on'), 2600);
}
