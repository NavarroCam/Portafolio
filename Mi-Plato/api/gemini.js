/* ==========================================================
   /api/gemini — Función serverless de Vercel
   Hace de intermediaria entre la app y la API de Gemini.
   La clave queda en la variable de entorno GEMINI_API_KEY
   (nunca en el código ni en el navegador).

   Acciones (campo "accion" del body):
   - analizar-plato: foto y/o descripción de un plato → veredicto
   - chat: conversación sobre recetas e ingredientes
   - leer-pautas: PDF de la nutricionista → lista de reglas
   ========================================================== */

// Se prueba el primer modelo; si Google dice que no existe o no está
// disponible para la clave, se pasa al siguiente y se recuerda el que anduvo.
const MODELOS = [...new Set([
  (process.env.GEMINI_MODEL || '').trim(),
  'gemini-flash-latest',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite'
].filter(Boolean))];
let modeloOk = null;
const URL_API = m => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;

const dormir = ms => new Promise(r => setTimeout(r, ms));

/** Segundos que Google pide esperar ante un 429 (RetryInfo), o 5 por defecto */
function segundosDeEspera(json) {
  const det = (json.error && json.error.details) || [];
  const info = det.find(d => d && d.retryDelay);
  const m = info && /([\d.]+)s/.exec(info.retryDelay);
  return m ? Math.ceil(Number(m[1])) : 5;
}

/** Lee la clave y le saca espacios o comillas pegadas por error */
function leerClave() {
  return String(process.env.GEMINI_API_KEY || '').trim().replace(/^["']|["']$/g, '').trim();
}
const MAX_BASE64 = 4 * 1024 * 1024; // ~3 MB de archivo

/* ---------- Contexto del usuario ---------- */
function contextoUsuario(b) {
  const reglas = Array.isArray(b.reglas) ? b.reglas.slice(0, 80).map(String) : [];
  const cond = Array.isArray(b.condiciones) ? b.condiciones.slice(0, 15).map(String) : [];
  return [
    reglas.length
      ? 'PAUTAS DE SU NUTRICIONISTA (respetalas siempre):\n- ' + reglas.join('\n- ')
      : 'Todavía no cargó pautas de su nutricionista: usá criterios generales de alimentación saludable (plato con ½ vegetales, ¼ proteína magra, ¼ cereal integral o legumbre, evitar frituras y ultraprocesados).',
    cond.length ? 'Condiciones de salud que indicó: ' + cond.join(', ') + '.' : '',
    b.alergias ? 'Alergias o alimentos que no puede comer: ' + String(b.alergias).slice(0, 300) + '.' : '',
    b.objetivo ? 'Su objetivo: ' + String(b.objetivo).slice(0, 200) + '.' : '',
    b.apodo ? 'Se llama "' + String(b.apodo).slice(0, 24).replace(/["\n]/g, '') + '": si la/lo nombrás, usá ese nombre (sin abusar).' : ''
  ].filter(Boolean).join('\n');
}

const BASE = `Sos el asistente de "Mi Plato", una app que ayuda a una persona a seguir el plan de alimentación que le dio su nutricionista.
Hablás en español rioplatense (vos), con tono cálido, claro y breve.
No das diagnósticos ni cambiás indicaciones médicas. No inventes restricciones que no estén en las pautas.
Si algo depende de una condición de salud o no está cubierto por las pautas, decí que conviene consultarlo con su nutricionista.`;

/* ---------- Esquemas de respuesta ---------- */
const ESQUEMA_PLATO = {
  type: 'OBJECT',
  properties: {
    veredicto: { type: 'STRING', enum: ['ok', 'ajustar'] },
    titulo: { type: 'STRING', description: 'Frase corta y positiva, máx. 6 palabras' },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          nombre: { type: 'STRING' },
          ok: { type: 'BOOLEAN' },
          nota: { type: 'STRING' }
        },
        required: ['nombre', 'ok']
      }
    },
    distribucion: {
      type: 'OBJECT',
      description: 'Porcentaje aproximado del plato (suma 100)',
      properties: {
        vegetales: { type: 'NUMBER' },
        proteina: { type: 'NUMBER' },
        carbohidratos: { type: 'NUMBER' },
        otros: { type: 'NUMBER' }
      },
      required: ['vegetales', 'proteina', 'carbohidratos', 'otros']
    },
    problemas: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { titulo: { type: 'STRING' }, detalle: { type: 'STRING' } },
        required: ['titulo', 'detalle']
      }
    },
    sugerencia: { type: 'STRING', description: 'Cómo mejorar el plato. Vacío si está todo bien.' },
    consejo: { type: 'STRING', description: 'Un tip corto (agua, condimentos, masticar despacio...)' },
    conteos: {
      type: 'OBJECT',
      properties: {
        frutas: { type: 'INTEGER' },
        huevos: { type: 'INTEGER' },
        tuberculos: { type: 'INTEGER', description: 'Porciones de papa, batata, choclo, mandioca o boniato' }
      },
      required: ['frutas', 'huevos', 'tuberculos']
    },
    es_comida: { type: 'BOOLEAN', description: 'false si la imagen no muestra comida' }
  },
  required: ['veredicto', 'titulo', 'items', 'distribucion', 'problemas', 'sugerencia', 'consejo', 'conteos', 'es_comida']
};

const ESQUEMA_PAUTAS = {
  type: 'OBJECT',
  properties: {
    reglas: {
      type: 'ARRAY',
      description: 'Reglas cortas y accionables, máx. 12 palabras cada una',
      items: { type: 'STRING' }
    }
  },
  required: ['reglas']
};

/* ---------- Llamada a Gemini ---------- */
// Pensamiento "bajo": responde mucho más rápido y alcanza para estas tareas.
// Si el modelo configurado no acepta ese parámetro, se reintenta sin él.
let usarThinking = true;

async function gemini(key, { system, contents, esquema, temperatura = 0.4 }) {
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: { temperature: temperatura }
  };
  if (esquema) {
    body.generationConfig.responseMimeType = 'application/json';
    body.generationConfig.responseSchema = esquema;
  }

  const pedir = async (modelo, conThinking) => {
    const b = JSON.parse(JSON.stringify(body));
    if (conThinking) b.generationConfig.thinkingConfig = { thinkingLevel: 'low' };
    const r = await fetch(URL_API(modelo), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(b)
    });
    const json = await r.json().catch(() => ({}));
    return { r, json };
  };

  const modelos = modeloOk ? [modeloOk, ...MODELOS.filter(m => m !== modeloOk)] : MODELOS;
  let r, json;
  buscar:
  for (const modelo of modelos) {
    for (let intento = 0; intento < 2; intento++) {
      ({ r, json } = await pedir(modelo, usarThinking));
      if (!r.ok && usarThinking && r.status === 400 && /think/i.test(JSON.stringify(json))) {
        usarThinking = false;
        ({ r, json } = await pedir(modelo, false));
      }
      if (r.ok) { modeloOk = modelo; break buscar; }
      const msg = JSON.stringify(json.error || {});
      const sinCuota = r.status === 429 && /limit: 0/i.test(msg);
      const saturado = r.status === 503 || r.status === 500 || /overloaded|high demand|UNAVAILABLE/i.test(msg);
      // Límite por minuto: si Google pide esperar poco, esperamos y reintentamos
      if (r.status === 429 && !sinCuota && intento === 0) {
        const espera = segundosDeEspera(json);
        if (espera <= 15) { await dormir(espera * 1000 + 300); continue; }
      }
      // Modelo saturado: un reintento corto y, si sigue, pasamos a otro modelo
      if (saturado && intento === 0) { await dormir(1500); continue; }
      const probarOtro = r.status === 404 || r.status === 429 || saturado ||
        (r.status === 400 && /not (found|supported)|is not available/i.test(msg));
      if (!probarOtro) break buscar; // otro tipo de error: no tiene sentido probar otro modelo
      break; // siguiente modelo (cada modelo tiene su propio límite)
    }
  }
  if (!r.ok) {
    const err = new Error((json.error && json.error.message) || ('Gemini respondió ' + r.status));
    err.status = r.status;
    err.codigo = json.error && json.error.status;
    throw err;
  }
  const cand = json.candidates && json.candidates[0];
  const texto = cand && cand.content && cand.content.parts
    ? cand.content.parts.filter(p => !p.thought).map(p => p.text || '').join('')
    : '';
  if (!texto) throw new Error('Gemini no devolvió respuesta (puede haber sido bloqueada por seguridad).');
  return esquema ? JSON.parse(texto) : texto;
}

function archivoValido(a, tipos) {
  return a && typeof a.data === 'string' && typeof a.mime === 'string' &&
    tipos.includes(a.mime) && a.data.length <= MAX_BASE64;
}

/* ---------- Acciones ---------- */
async function analizarPlato(key, b) {
  const tieneFoto = archivoValido(b.imagen, ['image/jpeg', 'image/png', 'image/webp']);
  const desc = String(b.descripcion || '').slice(0, 500);
  if (!tieneFoto && desc.length < 3) {
    return { status: 400, json: { error: 'Mandá una foto o una descripción del plato.' } };
  }
  const tipo = ['desayuno', 'almuerzo', 'merienda', 'cena'].includes(b.tipo) ? b.tipo : 'comida';
  const momento = b.momento === 'despues' ? 'ya lo comió' : 'lo va a comer';

  const parts = [];
  if (tieneFoto) parts.push({ inlineData: { mimeType: b.imagen.mime, data: b.imagen.data } });
  parts.push({
    text: `Analizá este plato. Es su ${tipo} y ${momento}.` +
      (desc ? `\nAclaración del usuario: "${desc}"` : '') +
      `\n\nIdentificá cada alimento, estimá la distribución del plato y decidí:
- "ok" si respeta sus pautas (o tiene un detalle menor).
- "ajustar" si incumple alguna pauta importante (frituras, ultraprocesados, porciones, faltan vegetales, etc.).
En "problemas" poné solo lo que no cumple, citando la pauta en palabras simples.
Si ${momento === 'lo va a comer' ? 'todavía no lo comió, la sugerencia tiene que ser un cambio concreto para hacer ahora' : 'ya lo comió, la sugerencia es para la próxima vez'}.
Para desayuno y merienda evaluá la estructura (infusión + hidrato + proteína + fibra) si está en las pautas, no la del plato de almuerzo.
Si la imagen no muestra comida, poné es_comida=false y explicalo en el título.`
  });

  const a = await gemini(key, {
    system: BASE + '\n\n' + contextoUsuario(b),
    contents: [{ role: 'user', parts }],
    esquema: ESQUEMA_PLATO,
    temperatura: 0.2
  });
  if (a.es_comida === false) {
    return { status: 422, json: { error: 'No veo comida en la foto. Probá con otra, desde arriba y con buena luz.' } };
  }
  return { status: 200, json: a };
}

async function chat(key, b) {
  const msgs = Array.isArray(b.mensajes) ? b.mensajes.slice(-12) : [];
  const contents = msgs
    .filter(m => m && typeof m.text === 'string' && !m.error)
    .map(m => ({ role: m.role === 'model' ? 'model' : 'user', parts: [{ text: m.text.slice(0, 2000) }] }));
  if (!contents.length || contents[contents.length - 1].role !== 'user') {
    return { status: 400, json: { error: 'Falta el mensaje.' } };
  }
  const texto = await gemini(key, {
    system: BASE + `
Ayudás con recetas, ideas de comidas, reemplazos y dudas sobre ingredientes.
Cuando des una receta, armala según sus pautas (por ejemplo la distribución del plato) y usá ingredientes fáciles de conseguir en Argentina.
Respondé en texto plano, con listas cortas usando "-" si hace falta. Máximo ~150 palabras salvo que pida una receta completa.
Si la pregunta no tiene que ver con alimentación, respondé amablemente que solo podés ayudar con comidas.

` + contextoUsuario(b),
    contents,
    temperatura: 0.7
  });
  return { status: 200, json: { texto } };
}

async function leerPautas(key, b) {
  // La app manda el texto del PDF (extraído en el celular) o, si es
  // escaneado, fotos de las primeras páginas. También acepta el PDF entero.
  const nombre = String(b.nombre || 'pautas').slice(0, 100);
  const parts = [];
  if (typeof b.texto === 'string' && b.texto.trim().length > 20) {
    parts.push({ text: 'CONTENIDO DEL DOCUMENTO "' + nombre + '":\n\n' + b.texto.slice(0, 60000) });
  } else if (Array.isArray(b.imagenes) && b.imagenes.length) {
    const imgs = b.imagenes.slice(0, 4).filter(i => archivoValido(i, ['image/jpeg', 'image/png']));
    const total = imgs.reduce((n, i) => n + i.data.length, 0);
    if (!imgs.length || total > MAX_BASE64) {
      return { status: 400, json: { error: 'Las páginas del PDF son demasiado pesadas.' } };
    }
    imgs.forEach(i => parts.push({ inlineData: { mimeType: i.mime, data: i.data } }));
  } else if (archivoValido(b.pdf, ['application/pdf'])) {
    parts.push({ inlineData: { mimeType: 'application/pdf', data: b.pdf.data } });
  } else {
    return { status: 400, json: { error: 'No se pudo leer el contenido del PDF.' } };
  }
  parts.push({
    text: `Del documento "${nombre}", devolvé las pautas de alimentación como reglas cortas y concretas, por ejemplo: "Papa, choclo o batata: máximo 2 por semana", "Evitar frituras", "Huevo: máximo 1 por día", "Tomar 2 litros de agua por día".
Incluí cantidades y frecuencias cuando aparezcan. No agregues nada que no esté en el documento. Si el documento no tiene pautas de alimentación, devolvé una lista vacía. Máximo 25 reglas.`
  });

  const r = await gemini(key, {
    system: 'Extraés pautas de alimentación de documentos de nutricionistas. Respondés en español rioplatense.',
    contents: [{ role: 'user', parts }],
    esquema: ESQUEMA_PAUTAS,
    temperatura: 0.1
  });
  const reglas = (r.reglas || []).map(x => String(x).trim()).filter(Boolean).slice(0, 25);
  return { status: 200, json: { reglas } };
}

/* Varios PDFs en un solo pedido: evita pasar el límite por minuto */
const ESQUEMA_LOTE = {
  type: 'OBJECT',
  properties: {
    documentos: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          reglas: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Reglas cortas, máx. 12 palabras cada una' }
        },
        required: ['id', 'reglas']
      }
    }
  },
  required: ['documentos']
};

async function leerPautasLote(key, b) {
  const docs = Array.isArray(b.documentos) ? b.documentos.slice(0, 12) : [];
  if (!docs.length) return { status: 400, json: { error: 'No llegaron documentos.' } };
  const parts = [];
  let pesoImgs = 0;
  const ids = [];
  for (const d of docs) {
    const id = String(d.id || '').slice(0, 40);
    const nombre = String(d.nombre || 'documento').slice(0, 100);
    if (!id) continue;
    ids.push(id);
    parts.push({ text: `\n=== DOCUMENTO id="${id}" nombre="${nombre}" ===` });
    if (typeof d.texto === 'string' && d.texto.trim()) {
      parts.push({ text: d.texto.slice(0, 40000) });
    } else if (Array.isArray(d.imagenes)) {
      d.imagenes.slice(0, 4).filter(i => archivoValido(i, ['image/jpeg', 'image/png'])).forEach(i => {
        pesoImgs += i.data.length;
        parts.push({ inlineData: { mimeType: i.mime, data: i.data } });
      });
    }
  }
  if (pesoImgs > MAX_BASE64) return { status: 413, json: { error: 'Los documentos escaneados son demasiado pesados para leerlos juntos.' } };
  parts.push({
    text: `Para CADA documento de arriba (usá su id), devolvé sus pautas de alimentación como reglas cortas y concretas, por ejemplo: "Papa, choclo o batata: máximo 2 por semana", "Evitar frituras", "Huevo: máximo 1 por día", "Tomar 2 litros de agua por día".
Incluí cantidades y frecuencias cuando aparezcan. No agregues nada que no esté en el documento. No repitas en un documento una regla que ya pusiste en otro. Si un documento no tiene pautas, devolvé su lista vacía. Máximo 25 reglas por documento.`
  });
  const r = await gemini(key, {
    system: 'Extraés pautas de alimentación de documentos de nutricionistas. Respondés en español rioplatense.',
    contents: [{ role: 'user', parts }],
    esquema: ESQUEMA_LOTE,
    temperatura: 0.1
  });
  const porId = {};
  (r.documentos || []).forEach(d => {
    porId[String(d.id)] = (d.reglas || []).map(x => String(x).trim()).filter(Boolean).slice(0, 25);
  });
  return { status: 200, json: { documentos: ids.map(id => ({ id, reglas: porId[id] || [] })) } };
}

/* ---------- Errores en palabras simples ---------- */
function explicar(err) {
  const m = String(err.message || '');
  const st = err.status || 502;
  if (/API key not valid|API_KEY_INVALID|invalid api key/i.test(m)) {
    return { status: 401, error: 'La clave de Gemini no es válida. Revisá GEMINI_API_KEY en Vercel (sin espacios ni comillas) y hacé Redeploy.' };
  }
  if (/expired/i.test(m)) {
    return { status: 401, error: 'La clave de Gemini venció. Creá una nueva en aistudio.google.com/apikey y actualizala en Vercel.' };
  }
  if (/location is not supported|User location/i.test(m)) {
    return { status: 403, error: 'Gemini no está disponible desde la región del servidor. En Vercel: Settings › Functions › Region, elegí Washington (iad1) y hacé Redeploy.' };
  }
  if (st === 403 || /PERMISSION_DENIED|SERVICE_DISABLED/i.test(m + err.codigo)) {
    return { status: 403, error: 'La clave no tiene permiso para usar la API de Gemini. Creá una clave nueva desde aistudio.google.com/apikey.' };
  }
  if (st === 404) {
    return { status: 502, error: 'El modelo de Gemini configurado no existe. Borrá la variable GEMINI_MODEL en Vercel (o corregila) y hacé Redeploy.' };
  }
  if (st === 429) {
    return /limit: 0/i.test(m)
      ? { status: 429, error: 'Tu clave no tiene cuota para este modelo en el plan gratuito. Probá poniendo GEMINI_MODEL = gemini-2.5-flash en Vercel.' }
      : { status: 429, error: 'Gemini está recibiendo muchos pedidos (límite del plan gratuito). Esperá un minuto y tocá Reintentar.' };
  }
  if (st === 503 || st === 500 || /overloaded|high demand|UNAVAILABLE/i.test(m)) {
    return { status: 503, error: 'Gemini está saturado en este momento (le pasa a todos los usuarios, no a tu cuenta). Esperá un par de minutos y tocá Reintentar.' };
  }
  if (err instanceof SyntaxError) {
    return { status: 502, error: 'Gemini devolvió una respuesta incompleta. Probá de nuevo.' };
  }
  return { status: 502, error: 'Gemini respondió con un error: ' + m.slice(0, 200) };
}

/* ---------- Diagnóstico: abrí /api/gemini en el navegador ---------- */
async function diagnostico(res) {
  const key = leerClave();
  const info = {
    clave_configurada: !!key,
    clave_formato_ok: /^AIza[0-9A-Za-z_\-]{30,}$/.test(key),
    modelos_que_prueba: MODELOS,
    supabase_configurado: !!((process.env.SUPABASE_URL || '').trim() && (process.env.SUPABASE_ANON_KEY || '').trim()),
    prueba: null
  };
  if (key) {
    try {
      const t = await gemini(key, { system: 'Respondé solo con la palabra OK.', contents: [{ role: 'user', parts: [{ text: 'Probando' }] }], temperatura: 0 });
      info.prueba = 'OK: Gemini respondió "' + String(t).trim().slice(0, 20) + '"';
      info.modelo_usado = modeloOk;
    } catch (err) {
      info.prueba = 'ERROR: ' + explicar(err).error;
      info.detalle_google = String(err.message || err).slice(0, 300);
    }
  } else {
    info.prueba = 'ERROR: falta GEMINI_API_KEY. Cargala en Vercel › Settings › Environment Variables y hacé Redeploy.';
  }
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(info);
}

/* ---------- Solo usuarios logueados ----------
   Si Supabase está configurado, el pedido tiene que traer el token de la
   sesión. Así nadie que no tenga cuenta puede gastar tu cuota de Gemini. */
async function usuarioValido(req) {
  const url = (process.env.SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_ANON_KEY || '').trim();
  if (!url || !key) return true; // sin Supabase configurado no se puede verificar
  const auth = req.headers.authorization || req.headers.Authorization || '';
  if (!/^Bearer\s+\S+/.test(auth)) return false;
  try {
    const r = await fetch(url.replace(/\/$/, '') + '/auth/v1/user', { headers: { apikey: key, Authorization: auth } });
    return r.ok;
  } catch (e) {
    return false;
  }
}

/* ---------- Handler ---------- */
module.exports = async function handler(req, res) {
  if (req.method === 'GET') { await diagnostico(res); return; }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }
  if (!(await usuarioValido(req))) {
    res.status(401).json({ error: 'Tenés que iniciar sesión para usar el asistente.', sesion: true });
    return;
  }
  const key = leerClave();
  if (!key) {
    res.status(500).json({ error: 'Falta configurar la variable de entorno GEMINI_API_KEY en Vercel.' });
    return;
  }

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  if (!b || typeof b !== 'object') {
    res.status(400).json({ error: 'Pedido inválido.' });
    return;
  }

  try {
    let r;
    if (b.accion === 'analizar-plato') r = await analizarPlato(key, b);
    else if (b.accion === 'chat') r = await chat(key, b);
    else if (b.accion === 'leer-pautas') r = await leerPautas(key, b);
    else if (b.accion === 'leer-pautas-lote') r = await leerPautasLote(key, b);
    else r = { status: 400, json: { error: 'Acción desconocida.' } };
    res.status(r.status).json(r.json);
  } catch (err) {
    const e = explicar(err);
    console.error('[gemini]', b.accion, err.status, err.message);
    res.status(e.status).json({ error: e.error, detalle: String(err.message || err).slice(0, 300) });
  }
};

