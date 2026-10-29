/* ==========================================================
   api.js — conexión con la función /api/gemini (Vercel)
   La clave de Gemini NUNCA está en el navegador: vive en la
   variable de entorno GEMINI_API_KEY del servidor.
   ========================================================== */

const Api = (() => {
  const ENDPOINT = '/api/gemini';

  /** Contexto del usuario que necesita el modelo para responder */
  function contexto() {
    const u = Store.u;
    if (!u) return {};
    const cond = [...u.salud.condiciones];
    if (u.salud.otra) cond.push(u.salud.otra);
    return {
      reglas: u.pautas.reglas,
      condiciones: cond,
      alergias: u.salud.alergias,
      objetivo: u.nutri.objetivo
    };
  }

  async function llamar(accion, datos) {
    let res;
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, ...contexto(), ...datos })
      });
    } catch (e) {
      throw new Error('No hay conexión. Revisá tu internet e intentá de nuevo.');
    }
    let json = null;
    try { json = await res.json(); } catch (e) { /* respuesta no JSON */ }
    if (!res.ok || !json) {
      if (res.status === 404) {
        throw new Error('No se encontró el servidor de la app (/api/gemini). Si la abriste como archivo local, usá "vercel dev" o la versión publicada.');
      }
      throw new Error((json && json.error) || 'El asistente no respondió. Probá de nuevo en un rato.');
    }
    return json;
  }

  /* ---------- Archivos ---------- */
  function leerComoDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error('No se pudo leer el archivo.'));
      r.readAsDataURL(file);
    });
  }

  /** Achica una imagen a `max` px de lado y la devuelve como dataURL JPEG */
  function comprimirImagen(file, max = 1024, calidad = 0.8) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const escala = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * escala);
        c.height = Math.round(img.height * escala);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', calidad));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo abrir la imagen.')); };
      img.src = url;
    });
  }

  /** Versión chica de una dataURL (para guardar en el dispositivo) */
  function miniatura(dataURL, max = 360) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const escala = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * escala);
        c.height = Math.round(img.height * escala);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => resolve(null);
      img.src = dataURL;
    });
  }

  function partes(dataURL) {
    const m = /^data:([^;]+);base64,(.*)$/.exec(dataURL || '');
    return m ? { mime: m[1], data: m[2] } : null;
  }

  return {
    /** Analiza la foto (o descripción) de un plato */
    analizarPlato({ foto, descripcion, tipo, momento }) {
      return llamar('analizar-plato', { imagen: partes(foto), descripcion, tipo, momento });
    },
    /** Chat de recetas / ingredientes */
    chat(mensajes) {
      return llamar('chat', { mensajes });
    },
    /** Lee un PDF de pautas y devuelve reglas */
    leerPautas(pdfDataURL, nombre) {
      return llamar('leer-pautas', { pdf: partes(pdfDataURL), nombre });
    },
    leerComoDataURL, comprimirImagen, miniatura
  };
})();
