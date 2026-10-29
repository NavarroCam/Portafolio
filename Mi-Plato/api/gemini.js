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

const MODELO = process.env.GEMINI_MODEL || 'gemini-flash-latest';
const URL_API = m => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;
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
    b.objetivo ? 'Su objetivo: ' + String(b.objetivo).slice(0, 200) + '.' : ''
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
  const r = await fetch(URL_API(MODELO), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body)
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (json.error && json.error.message) || ('Gemini respondió ' + r.status);
    const err = new Error(msg);
    err.status = r.status;
    throw err;
  }
  const cand = json.candidates && json.candidates[0];
  const texto = cand && cand.content && cand.content.parts
    ? cand.content.parts.map(p => p.text || '').join('')
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
  if (!archivoValido(b.pdf, ['application/pdf'])) {
    return { status: 400, json: { error: 'El PDF no es válido o pesa más de 3 MB.' } };
  }
  const r = await gemini(key, {
    system: 'Extraés pautas de alimentación de documentos de nutricionistas. Respondés en español rioplatense.',
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: 'application/pdf', data: b.pdf.data } },
        { text: `Leé este documento ("${String(b.nombre || 'pautas').slice(0, 100)}") y devolvé las pautas como reglas cortas y concretas, por ejemplo: "Papa, choclo o batata: máximo 2 por semana", "Evitar frituras", "Huevo: máximo 1 por día", "Tomar 2 litros de agua por día".
Incluí cantidades y frecuencias cuando aparezcan. No agregues nada que no esté en el documento. Máximo 25 reglas.` }
      ]
    }],
    esquema: ESQUEMA_PAUTAS,
    temperatura: 0.1
  });
  const reglas = (r.reglas || []).map(x => String(x).trim()).filter(Boolean).slice(0, 25);
  return { status: 200, json: { reglas } };
}

/* ---------- Handler ---------- */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }
  const key = process.env.GEMINI_API_KEY;
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
    else r = { status: 400, json: { error: 'Acción desconocida.' } };
    res.status(r.status).json(r.json);
  } catch (err) {
    const limite = err.status === 429;
    res.status(limite ? 429 : 502).json({
      error: limite
        ? 'Se alcanzó el límite de uso de Gemini. Probá de nuevo en un minuto.'
        : 'No se pudo hablar con Gemini. Probá de nuevo.',
      detalle: String(err.message || err)
    });
  }
};

