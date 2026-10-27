// Transactional email via Resend (https://resend.com), plain fetch — no SDK. Same setup as Josué's platform.
// OFF until both env vars exist:
//   RESEND_API_KEY  re_…   (Resend → API Keys)
//   EMAIL_FROM      "Phanie López <no-reply@phanielopez.com>"  (the domain must be verified in Resend)
// In development without them, emails are printed to the server console so the flows can be tested locally.

const isProd = process.env.NODE_ENV === 'production';

export const emailEnabled = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
// Can the site deliver an email right now (or fake it in dev)?
export const canSendEmail = () => emailEnabled() || !isProd;

// Sends one email. Returns false (and logs) on failure — never throws.
export async function sendEmail({ to, subject, text, html }) {
  if (!emailEnabled()) {
    if (!isProd) {
      console.info(`\n[email:dev] To: ${to}\nSubject: ${subject}\n\n${text}\n`);
      return true;
    }
    console.error('[email] RESEND_API_KEY / EMAIL_FROM not set — email not sent.');
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text, html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error(`[email] Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[email] send failed:', err);
    return false;
  }
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function resetEmail({ name, link, minutes }) {
  const hello = name ? `Hola ${name.split(' ')[0]},` : 'Hola,';
  return {
    subject: 'Restablece tu contraseña — phanielopez.com',
    text: [
      hello, '',
      'Alguien (esperamos que tú) pidió cambiar la contraseña de tu panel en phanielopez.com.',
      `Para elegir una nueva, abre este enlace. Vence en ${minutes} minutos y funciona una sola vez:`, '',
      link, '',
      'Si no fuiste tú, ignora este correo: tu contraseña no cambia.',
    ].join('\n'),
    html: `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#111">
<p>${esc(hello)}</p>
<p>Alguien (esperamos que tú) pidió cambiar la contraseña de tu panel en <strong>phanielopez.com</strong>.</p>
<p><a href="${esc(link)}" style="display:inline-block;background:#C8F000;color:#111;padding:12px 22px;border-radius:4px;text-decoration:none;font-weight:700">Elegir nueva contraseña</a></p>
<p style="font-size:13px;color:#555">El enlace vence en ${minutes} minutos y funciona una sola vez. Si no fuiste tú, ignora este correo: tu contraseña no cambia.</p>
</div>`,
  };
}
