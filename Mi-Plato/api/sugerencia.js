/* ==========================================================
   /api/sugerencia — Función serverless de Vercel
   Recibe una sugerencia de mejora, la guarda en Supabase (tabla
   "sugerencias") y te la manda por mail con Resend.
   Variables de entorno (Vercel › Settings › Environment Variables):
     RESEND_API_KEY     clave de resend.com (empieza con "re_")
     MAIL_SUGERENCIAS   el mail donde te llegan (el de tu cuenta de Resend)
     MAIL_REMITENTE     opcional: "Mi Plato <hola@tudominio.com>" si verificaste un dominio
   ========================================================== */

const TIPOS = { nuevo: 'Algo nuevo', error: 'Algo que no anda', diseno: 'Diseño', otra: 'Otra' };
const recortar = (t, n) => String(t == null ? '' : t).trim().slice(0, n);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Si viene el token de la sesión, devuelve el usuario de Supabase */
async function usuario(req, url, key) {
  const auth = req.headers.authorization || '';
  if (!url || !key || !/^Bearer\s+\S+/.test(auth)) return null;
  try {
    const r = await fetch(url + '/auth/v1/user', { headers: { apikey: key, Authorization: auth } });
    return r.ok ? await r.json() : null;
  } catch (e) { return null; }
}

async function guardar(fila, req, url, key, user) {
  if (!url || !key) return false;
  const r = await fetch(url + '/rest/v1/sugerencias', {
    method: 'POST',
    headers: {
      apikey: key,
      // Sin sesión va solo la clave pública (rol "anon")
      ...(user ? { Authorization: req.headers.authorization } : {}),
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify(fila)
  });
  if (!r.ok) console.warn('[sugerencia] supabase', r.status, await r.text().catch(() => ''));
  return r.ok;
}

async function mandarMail(f) {
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  const para = (process.env.MAIL_SUGERENCIAS || '').trim();
  if (!apiKey || !para) return false;
  const de = (process.env.MAIL_REMITENTE || '').trim() || 'Mi Plato <onboarding@resend.dev>';
  const c = f.contexto || {};
  const quien = [f.nombre, f.email && `(${f.email})`].filter(Boolean).join(' ') || 'Sin cuenta, sin email';
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #DDE3DA;border-radius:14px;overflow:hidden">
    <div style="background:#2F6B4F;color:#fff;padding:16px 20px;font-size:18px;font-weight:bold">Nueva sugerencia para Mi Plato</div>
    <div style="padding:20px;color:#17231C">
      <p style="margin:0 0 8px"><span style="background:#E3EFE7;color:#1F4A36;font-size:12px;font-weight:bold;padding:4px 8px;border-radius:8px">${esc(TIPOS[f.tipo])}</span></p>
      <h2 style="margin:8px 0;font-size:20px">${esc(f.titulo)}</h2>
      ${f.detalle ? `<p style="white-space:pre-wrap;line-height:1.5;color:#33413A">${esc(f.detalle)}</p>` : ''}
      <hr style="border:none;border-top:1px solid #DDE3DA;margin:16px 0">
      <p style="font-size:13px;color:#4F5E55;line-height:1.6;margin:0">
        <b>Quién:</b> ${esc(quien)}${f.avisar ? ' · quiere aviso cuando esté lista' : ''}<br>
        <b>Desde:</b> ${esc([c.demo ? 'la demo' : '', c.dispositivo, c.paleta && 'tema ' + c.paleta].filter(Boolean).join(' · ') || '—')}
      </p>
    </div>
  </div>`;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: de, to: [para],
      subject: `Nueva sugerencia: ${f.titulo}`,
      html,
      ...(f.email ? { reply_to: f.email } : {})
    })
  });
  if (!r.ok) console.warn('[sugerencia] resend', r.status, await r.text().catch(() => ''));
  return r.ok;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  if (!b || typeof b !== 'object') { res.status(400).json({ error: 'Pedido inválido.' }); return; }

  const titulo = recortar(b.titulo, 80);
  if (titulo.length < 3) { res.status(400).json({ error: 'Contanos tu idea en pocas palabras.' }); return; }
  let email = recortar(b.email, 200);
  if (email && !/^\S+@\S+\.\S+$/.test(email)) email = '';

  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
  const key = (process.env.SUPABASE_ANON_KEY || '').trim();
  const user = await usuario(req, url, key);
  const ctx = b.contexto && typeof b.contexto === 'object' ? b.contexto : {};

  const fila = {
    user_id: user ? user.id : null,
    email: (user && user.email) || email || null,
    nombre: recortar(b.nombre, 60) || null,
    tipo: TIPOS[b.tipo] ? b.tipo : 'otra',
    titulo,
    detalle: recortar(b.detalle, 1500) || null,
    avisar: !!b.avisar,
    contexto: { dispositivo: recortar(ctx.dispositivo, 20), paleta: recortar(ctx.paleta, 20), demo: !!ctx.demo }
  };

  let guardada = false, mail = false;
  try { guardada = await guardar(fila, req, url, key, user); } catch (e) { console.warn('[sugerencia]', e.message); }
  try { mail = await mandarMail(fila); } catch (e) { console.warn('[sugerencia]', e.message); }

  if (!guardada && !mail) {
    res.status(500).json({ error: 'No se pudo enviar la sugerencia. Probá de nuevo en un rato.' });
    return;
  }
  res.status(200).json({ ok: true, guardada, mail });
};
