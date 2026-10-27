// Everything Stephanie can edit, grouped the way the page reads top to bottom.
// The template (views/index.html) uses these keys as {{t:key}} (text) and {{a:key}} (attribute) placeholders.
// The defaults below are what the site shows until she changes something; "Restaurar original" goes back to them.
//
// Field types
//   text      one line
//   textarea  several lines (line breaks are kept)
//   url       a link: https://…, mailto:…, or an in-page anchor like #comunidad
//   email     an email address (used for the "Hablemos" button)
//   image     a photo: a default file in /img or an upload in /uploads
//
// To add an editable spot: add a field here, then use {{t:key}} / {{a:key}} + data-k="key" in the template.

export const SECTIONS = [
  {
    id: 'meta',
    label: 'Pestaña del navegador y Google',
    fields: [
      { key: 'meta.title', label: 'Título de la pestaña', type: 'text', default: 'Phanie López · F1 Storyteller Boricua' },
      { key: 'meta.description', label: 'Descripción para Google', type: 'textarea', default: 'Te explico la Fórmula 1 fácil, compartimos la emoción y creamos comunidad desde Puerto Rico.', help: 'Lo que aparece debajo del título en los resultados de Google. Unas 150 letras.' },
      { key: 'brand.tagline', label: 'Frase de la cinta negra', type: 'text', default: 'Aprendemos · Compartimos · Vivimos la F1', help: 'Aparece al final de la cinta que corre con la próxima carrera.' },
    ],
  },
  {
    id: 'hero',
    label: 'Portada',
    fields: [
      { key: 'hero.eyebrow', label: 'Texto pequeño arriba del título', type: 'text', default: 'F1 Storyteller Boricua' },
      { key: 'hero.title', label: 'Título (parte negra)', type: 'text', default: 'La F1 se vive en' },
      { key: 'hero.titleAccent', label: 'Título (parte morada)', type: 'text', default: 'comunidad.' },
      { key: 'hero.lede', label: 'Párrafo', type: 'textarea', default: 'Te explico la Fórmula 1 fácil, compartimos la emoción y creamos comunidad desde Puerto Rico.' },
      { key: 'hero.cta', label: 'Botón verde', type: 'text', default: 'Explora Phanie F101' },
      { key: 'hero.ctaLink', label: 'Enlace del botón verde', type: 'url', default: '#f101' },
      { key: 'hero.link', label: 'Enlace subrayado', type: 'text', default: 'Conoce la comunidad' },
      { key: 'hero.linkHref', label: 'A dónde lleva el enlace subrayado', type: 'url', default: '#comunidad' },
      { key: 'hero.tag', label: 'Etiqueta morada', type: 'textarea', default: 'Pasión por la F1.\nAcento boricua.', help: 'Dos líneas cortas.' },
      { key: 'hero.image', label: 'Foto de portada', type: 'image', default: '/img/phanie-hero-554.jpg', help: 'Horizontal. Se ve mejor si lo importante está a la derecha.' },
    ],
  },
  {
    id: 'f101',
    label: 'Phanie F101',
    fields: [
      { key: 'f101.eyebrow', label: 'Texto pequeño', type: 'text', default: 'Phanie F101' },
      { key: 'f101.title', label: 'Título (parte negra)', type: 'text', default: 'Entiende la F1,' },
      { key: 'f101.titleAccent', label: 'Título (parte morada)', type: 'text', default: 'sin complicarte.' },
      { key: 'f101.blurb', label: 'Párrafo', type: 'textarea', default: 'Análisis, explicaciones y contenido para que disfrutes la Fórmula 1 con más conocimiento y más emoción.' },
      { key: 'card1.title', label: 'Video 1 · título', type: 'text', default: '¿Qué son los track limits?' },
      { key: 'card1.link', label: 'Video 1 · enlace', type: 'url', default: '#', help: 'Pega el enlace del video (TikTok, Instagram, YouTube…).' },
      { key: 'card1.image', label: 'Video 1 · foto', type: 'image', default: '/img/card-track.jpg', alt: 'Piano rojo y blanco al borde de la pista' },
      { key: 'card2.title', label: 'Video 2 · título', type: 'text', default: 'Las banderas, explicadas' },
      { key: 'card2.link', label: 'Video 2 · enlace', type: 'url', default: '#' },
      { key: 'card2.image', label: 'Video 2 · foto', type: 'image', default: '/img/card-flags.jpg', alt: 'Banderas de carrera: a cuadros, amarilla, roja, verde y azul' },
      { key: 'card3.title', label: 'Video 3 · título', type: 'text', default: 'Estrategia para principiantes' },
      { key: 'card3.link', label: 'Video 3 · enlace', type: 'url', default: '#' },
      { key: 'card3.image', label: 'Video 3 · foto', type: 'image', default: '/img/card-tire.jpg', alt: 'Neumático de un monoplaza de F1' },
      { key: 'cards.more', label: 'Texto del enlace de cada video', type: 'text', default: 'Ver contenido' },
    ],
  },
  {
    id: 'calendar',
    label: 'Calendario',
    fields: [
      { key: 'calendar.eyebrow', label: 'Texto pequeño', type: 'text', default: 'Calendario F1 2026' },
      { key: 'calendar.title', label: 'Título (parte blanca)', type: 'text', default: 'Toda la temporada,' },
      { key: 'calendar.titleAccent', label: 'Título (parte verde)', type: 'text', default: 'carrera a carrera.' },
      { key: 'calendar.blurb', label: 'Párrafo', type: 'textarea', default: '23 Grandes Premios. Gira el carrusel y toca una carrera para ver prácticas, clasificación, carrera y el último ganador del circuito. Horarios en hora de Puerto Rico.' },
    ],
  },
  {
    id: 'community',
    label: 'Comunidad',
    fields: [
      { key: 'community.eyebrow', label: 'Texto pequeño', type: 'text', default: 'F1 Girlies PR' },
      { key: 'community.title', label: 'Título', type: 'text', default: 'Tu lugar en la parrilla.' },
      { key: 'community.lede', label: 'Párrafo', type: 'textarea', default: 'Un espacio para aprender, compartir y disfrutar la F1 juntas.' },
      { key: 'community.cta', label: 'Botón', type: 'text', default: 'Conoce F1 Girlies PR' },
      { key: 'community.ctaLink', label: 'Enlace del botón', type: 'url', default: '/f1-girlies' },
      { key: 'community.image', label: 'Foto', type: 'image', default: '/img/community.jpg', alt: 'Mujeres celebrando frente a una pantalla durante una watch party de F1, con la bandera de Puerto Rico al fondo' },
      { key: 'community.chip', label: 'Etiqueta sobre la foto', type: 'text', default: 'Encuentros · Watch parties · Comunidad' },
    ],
  },
  {
    id: 'about',
    label: 'Sobre mí y BoxTalkPR',
    fields: [
      { key: 'about.eyebrow', label: 'Texto pequeño', type: 'text', default: 'Sobre mí' },
      { key: 'about.title', label: 'Título', type: 'text', default: 'Hola, soy Phanie.' },
      { key: 'about.body', label: 'Párrafo', type: 'textarea', default: 'Creadora de contenido, fanática de la F1 y boricua. Me encanta hacer este deporte más cercano y conectar con quienes lo disfrutan tanto como yo.' },
      { key: 'about.note', label: 'Nota debajo de la línea', type: 'text', default: 'También me escuchas en BoxTalkPR.' },
      { key: 'podcast.brand', label: 'Podcast · nombre', type: 'text', default: 'BoxTalkPR' },
      { key: 'podcast.title', label: 'Podcast · título', type: 'text', default: 'La conversación continúa.' },
      { key: 'podcast.body', label: 'Podcast · texto', type: 'text', default: 'Debates, análisis y mucha F1.' },
      { key: 'podcast.link', label: 'Podcast · enlace', type: 'url', default: '#' },
      { key: 'podcast.image', label: 'Podcast · foto', type: 'image', default: '/img/mic.jpg', alt: 'Micrófono de podcast' },
    ],
  },
  {
    id: 'cta',
    label: 'Colaboraciones',
    fields: [
      { key: 'cta.title', label: 'Título', type: 'text', default: '¿Creamos algo juntas?' },
      { key: 'cta.lede', label: 'Párrafo', type: 'textarea', default: 'Contenido, experiencias y colaboraciones que conectan con la comunidad de la F1.' },
      { key: 'cta.button', label: 'Botón', type: 'text', default: 'Hablemos de tu marca' },
      { key: 'cta.email', label: 'Correo que abre el botón', type: 'email', default: 'info@phanielopez.com' },
      { key: 'cta.image', label: 'Foto de fondo', type: 'image', default: '/img/flag.jpg', alt: '' },
    ],
  },
  // ---------- F1 Girlies page (/f1-girlies) ----------
  {
    id: 'girlies-top',
    label: 'F1 Girlies · Portada e Instagram',
    fields: [
      { key: 'girlies.meta.title', label: 'Título de la pestaña', type: 'text', default: 'F1 Girlies PR · La comunidad de Phanie López' },
      { key: 'girlies.meta.description', label: 'Descripción para Google', type: 'textarea', default: 'La comunidad boricua de chicas que aman la Fórmula 1: watch parties, quiniela de cada carrera y mucha emoción.' },
      { key: 'girlies.eyebrow', label: 'Texto pequeño', type: 'text', default: 'F1 Girlies PR' },
      { key: 'girlies.title', label: 'Título (parte blanca)', type: 'text', default: 'Tu lugar en' },
      { key: 'girlies.titleAccent', label: 'Título (parte verde)', type: 'text', default: 'la parrilla.' },
      { key: 'girlies.lede', label: 'Párrafo', type: 'textarea', default: 'Una comunidad de chicas boricuas que viven la Fórmula 1: vemos las carreras juntas, aprendemos sin miedo a preguntar y celebramos cada vuelta.' },
      { key: 'girlies.image', label: 'Foto de portada', type: 'image', default: '/img/community.jpg', alt: 'Chicas celebrando durante una watch party de F1' },
      { key: 'girlies.igLink', label: 'Enlace de la comunidad en Instagram', type: 'url', default: '#', help: 'Déjalo en # mientras la comunidad no exista: el botón dirá «Muy pronto en Instagram».' },
      { key: 'girlies.igCta', label: 'Botón de Instagram', type: 'text', default: 'Únete en Instagram' },
      { key: 'girlies.igSoon', label: 'Botón de Instagram (sin enlace todavía)', type: 'text', default: 'Muy pronto en Instagram' },
    ],
  },
  {
    id: 'girlies-what',
    label: 'F1 Girlies · Qué hacemos',
    fields: [
      { key: 'girlies.what.eyebrow', label: 'Texto pequeño', type: 'text', default: 'Qué hacemos' },
      { key: 'girlies.what.title', label: 'Título', type: 'text', default: 'Aquí nadie te pregunta si sabes de F1.' },
      { key: 'girlies.what1.title', label: 'Punto 1 · título', type: 'text', default: 'Watch parties' },
      { key: 'girlies.what1.text', label: 'Punto 1 · texto', type: 'textarea', default: 'Vemos las carreras juntas en un lugar con buena pantalla, buena comida y mejor ambiente.' },
      { key: 'girlies.what2.title', label: 'Punto 2 · título', type: 'text', default: 'Aprendemos juntas' },
      { key: 'girlies.what2.text', label: 'Punto 2 · texto', type: 'textarea', default: 'Banderas, estrategias, neumáticos: todas las preguntas valen y nadie se queda atrás.' },
      { key: 'girlies.what3.title', label: 'Punto 3 · título', type: 'text', default: 'Encuentros' },
      { key: 'girlies.what3.text', label: 'Punto 3 · texto', type: 'textarea', default: 'Planes fuera de la carrera: brunch, karting, merch y amistades que llegan para quedarse.' },
    ],
  },
  {
    id: 'girlies-sections',
    label: 'F1 Girlies · Watch parties, quiniela y fotos',
    fields: [
      { key: 'girlies.events.eyebrow', label: 'Watch parties · texto pequeño', type: 'text', default: 'Próximos watch parties' },
      { key: 'girlies.events.title', label: 'Watch parties · título', type: 'text', default: 'Separa tu asiento.' },
      { key: 'girlies.events.blurb', label: 'Watch parties · párrafo', type: 'textarea', default: 'Reserva con tu nombre y tu Instagram o teléfono. Sin cuentas ni contraseñas.' },
      { key: 'girlies.events.empty', label: 'Watch parties · cuando no hay ninguno', type: 'textarea', default: 'Pronto anunciamos el próximo watch party. ¡Mantente pendiente a nuestro Instagram!' },
      { key: 'girlies.quiniela.eyebrow', label: 'Quiniela · texto pequeño', type: 'text', default: 'Quiniela F1 Girlies' },
      { key: 'girlies.quiniela.title', label: 'Quiniela · título', type: 'text', default: '¿Quién sube al podio?' },
      { key: 'girlies.quiniela.rules', label: 'Quiniela · reglas', type: 'textarea', default: 'Escoge el podio antes de que empiece la clasificación. Piloto en su posición exacta: 3 puntos. En el podio pero en otra posición: 1 punto. ¡Podio perfecto: 2 puntos extra! Puedes cambiar tu predicción hasta que empiece la clasificación, desde el mismo teléfono o computadora.' },
      { key: 'girlies.photos.eyebrow', label: 'Fotos · texto pequeño', type: 'text', default: 'Muro de fotos' },
      { key: 'girlies.photos.title', label: 'Fotos · título', type: 'text', default: 'Así se vive en la parrilla.' },
      { key: 'girlies.photos.blurb', label: 'Fotos · párrafo', type: 'textarea', default: '¿Estuviste en un watch party? Comparte tu foto: la revisamos antes de publicarla.' },
      { key: 'girlies.photos.empty', label: 'Fotos · cuando no hay ninguna', type: 'text', default: 'Las primeras fotos llegan con el primer watch party.' },
    ],
  },
  {
    id: 'girlies-voices',
    label: 'F1 Girlies · Testimonios y preguntas',
    fields: [
      { key: 'girlies.quote1.text', label: 'Testimonio 1 · frase', type: 'textarea', default: 'Llegué sin saber qué era un undercut y salí con amigas y equipo favorito.', help: 'Reemplaza estos ejemplos con frases reales de la comunidad.' },
      { key: 'girlies.quote1.name', label: 'Testimonio 1 · nombre', type: 'text', default: 'Ejemplo · Andrea, San Juan' },
      { key: 'girlies.quote2.text', label: 'Testimonio 2 · frase', type: 'textarea', default: 'Por fin un lugar donde gritar en la salida sin que nadie me mire raro.' },
      { key: 'girlies.quote2.name', label: 'Testimonio 2 · nombre', type: 'text', default: 'Ejemplo · Gabriela, Bayamón' },
      { key: 'girlies.quote3.text', label: 'Testimonio 3 · frase', type: 'textarea', default: 'La quiniela me tiene viendo la clasificación como si fuera la carrera.' },
      { key: 'girlies.quote3.name', label: 'Testimonio 3 · nombre', type: 'text', default: 'Ejemplo · Natalia, Ponce' },
      { key: 'girlies.faq1.q', label: 'Pregunta 1', type: 'text', default: '¿Tengo que saber de F1 para unirme?' },
      { key: 'girlies.faq1.a', label: 'Respuesta 1', type: 'textarea', default: '¡Para nada! La comunidad es para aprender juntas. Si estás empezando, estás en el lugar correcto.' },
      { key: 'girlies.faq2.q', label: 'Pregunta 2', type: 'text', default: '¿Cuánto cuesta?' },
      { key: 'girlies.faq2.a', label: 'Respuesta 2', type: 'textarea', default: 'Unirte es gratis. En los watch parties cada una paga lo que consume en el lugar.' },
      { key: 'girlies.faq3.q', label: 'Pregunta 3', type: 'text', default: '¿Puedo llevar a una amiga?' },
      { key: 'girlies.faq3.a', label: 'Respuesta 3', type: 'textarea', default: 'Sí. Al reservar puedes añadir hasta 3 invitadas.' },
      { key: 'girlies.faq4.q', label: 'Pregunta 4', type: 'text', default: '¿Necesito crear una cuenta?' },
      { key: 'girlies.faq4.a', label: 'Respuesta 4', type: 'textarea', default: 'No. Para reservar o jugar la quiniela solo usas tu nombre o apodo y tu Instagram.' },
      { key: 'girlies.final.title', label: 'Cierre · título', type: 'text', default: 'Nos vemos en la próxima carrera.' },
      { key: 'girlies.final.lede', label: 'Cierre · párrafo', type: 'textarea', default: 'Síguenos para enterarte de cada watch party, encuentro y resultado de la quiniela.' },
    ],
  },
  {
    id: 'social',
    label: 'Redes sociales (pie de página)',
    fields: [
      { key: 'social.instagram', label: 'Instagram', type: 'url', default: 'https://www.instagram.com/phanielopez/' },
      { key: 'social.threads', label: 'Threads', type: 'url', default: 'https://www.threads.com/@phanielopez' },
      { key: 'social.tiktok', label: 'TikTok', type: 'url', default: 'https://www.tiktok.com/@phanie.lopez' },
      { key: 'social.youtube', label: 'YouTube', type: 'url', default: 'https://www.youtube.com/@phanielopez' },
      { key: 'social.facebook', label: 'Facebook', type: 'url', default: 'https://www.facebook.com/phanielopezf1' },
      { key: 'social.x', label: 'X (Twitter)', type: 'url', default: '#', help: 'Déjalo en # para esconder el ícono.' },
      { key: 'social.handle', label: 'Usuario que se muestra', type: 'text', default: '@phanielopez' },
    ],
  },
];

export const FIELDS = new Map(SECTIONS.flatMap((s) => s.fields.map((f) => [f.key, f])));

// Image fields also carry an editable description (alt text) under `<key>.alt`.
for (const f of [...FIELDS.values()]) {
  if (f.type === 'image') {
    FIELDS.set(`${f.key}.alt`, { key: `${f.key}.alt`, label: `${f.label} · descripción`, type: 'text', default: f.alt ?? '', hidden: true });
  }
}

const MAX = { text: 200, textarea: 1200, url: 500, email: 200, image: 200 };
const IMAGE_PATH = /^\/(img\/[\w-]+\.(jpg|jpeg|png|webp|svg)|uploads\/[A-Za-z0-9_-]{8,64}\.(jpg|png|webp))$/;

// Returns the cleaned value, or throws an Error with a Spanish message for the editor to show.
export function validate(key, raw) {
  const field = FIELDS.get(key);
  if (!field) throw new Error('Ese campo no existe.');
  let value = String(raw ?? '').replace(/\r\n?/g, '\n');
  value = field.type === 'textarea' ? value.trim() : value.replace(/\s*\n\s*/g, ' ').trim();
  if (value.length > MAX[field.type]) throw new Error(`Máximo ${MAX[field.type]} caracteres.`);
  if (field.type === 'url') {
    if (!value) value = '#';
    if (!/^(https?:\/\/[^\s]+|mailto:[^\s]+|#[\w-]*|\/[^\s]*)$/i.test(value)) {
      throw new Error('El enlace debe empezar con https:// (o ser una sección como #comunidad).');
    }
  }
  if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error('Escribe un correo válido.');
  if (field.type === 'image' && !IMAGE_PATH.test(value)) throw new Error('Foto no válida.');
  if (!value && field.type !== 'text' && !key.endsWith('.alt')) throw new Error('Este campo no puede quedar vacío.');
  return value;
}
