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
      objetivo: u.nutri.objetivo,
      apodo: nombreCorto()
    };
  }

  async function llamar(accion, datos) {
    let res;
    try {
      const token = await Nube.token();
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: JSON.stringify({ accion, ...contexto(), ...datos })
      });
    } catch (e) {
      throw new Error('No hay conexión. Revisá tu internet e intentá de nuevo.');
    }
    let json = null;
    try { json = await res.json(); } catch (e) { /* respuesta no JSON */ }
    if (!res.ok || !json) {
      if (res.status === 401 && json && json.sesion) {
        throw new Error('Tu sesión venció. Cerrá sesión y volvé a ingresar.');
      }
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

  /* ---------- PDFs: se leen en el celular, no se suben enteros ----------
     Con pdf.js sacamos el texto en el navegador y mandamos solo eso
     (pocos KB, aunque el PDF pese 20 MB). Si el PDF es escaneado o
     casi sin texto, mandamos fotos chicas de las primeras páginas. */
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  let pdfjsCargando = null;

  function cargarPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (!pdfjsCargando) {
      pdfjsCargando = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = PDFJS + 'pdf.min.js';
        s.onload = () => {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
          resolve(window.pdfjsLib);
        };
        const fallar = () => { pdfjsCargando = null; s.remove(); reject(new Error('No se pudo cargar el lector de PDF. Revisá tu conexión y reintentá.')); };
        s.onerror = fallar;
        setTimeout(() => { if (!window.pdfjsLib) fallar(); }, 20000);
        document.head.appendChild(s);
      });
    }
    return pdfjsCargando;
  }

  const MAX_PAGINAS_TEXTO = 40;
  const MAX_PAGINAS_IMAGEN = 4;
  const MAX_CARACTERES = 60000;

  async function prepararPDF(file) {
    const pdfjs = await cargarPdfJs();
    let doc;
    try {
      doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    } catch (e) {
      throw new Error(e && e.name === 'PasswordException' ? 'El PDF tiene contraseña.' : 'El archivo no es un PDF válido.');
    }

    // 1) Texto
    let texto = '';
    const paginas = Math.min(doc.numPages, MAX_PAGINAS_TEXTO);
    for (let i = 1; i <= paginas && texto.length < MAX_CARACTERES; i++) {
      const page = await doc.getPage(i);
      const c = await page.getTextContent();
      let linea = '';
      let ultimoY = null;
      for (const it of c.items) {
        const y = it.transform ? Math.round(it.transform[5]) : null;
        if (ultimoY !== null && y !== null && Math.abs(y - ultimoY) > 2) { texto += linea.trim() + '\n'; linea = ''; }
        linea += it.str + (it.hasEOL ? '\n' : ' ');
        ultimoY = y;
      }
      texto += linea.trim() + '\n\n';
    }
    texto = texto.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_CARACTERES);
    if (texto.replace(/\s/g, '').length >= 150) {
      doc.destroy();
      return { texto };
    }

    // 2) Poco texto: fotos de las primeras páginas
    const imagenes = [];
    for (let i = 1; i <= Math.min(doc.numPages, MAX_PAGINAS_IMAGEN); i++) {
      const page = await doc.getPage(i);
      const v1 = page.getViewport({ scale: 1 });
      const escala = Math.min(2, 1200 / Math.max(v1.width, v1.height));
      const vp = page.getViewport({ scale: escala });
      const c = document.createElement('canvas');
      c.width = Math.round(vp.width);
      c.height = Math.round(vp.height);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      imagenes.push(partes(c.toDataURL('image/jpeg', 0.7)));
    }
    doc.destroy();
    return { imagenes };
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
    /** Saca el texto (o fotos) de un PDF en el navegador */
    prepararPDF,
    /** Manda varios PDFs ya preparados en un solo pedido → { documentos: [{ id, reglas }] } */
    leerPautasLote(documentos) {
      return llamar('leer-pautas-lote', { documentos });
    },
    leerComoDataURL, comprimirImagen, miniatura
  };
})();
