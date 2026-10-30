/* ==========================================================
   fotos.js — fotos de los platos
   Las fotos (miniaturas) van aparte de los demás datos, así
   cada cambio no vuelve a subir todas las fotos:
   - en este dispositivo: IndexedDB (aguanta mucho más que localStorage)
   - en la nube: tabla "fotos" de Supabase
   Si abrís la app en otro dispositivo, las fotos se bajan solas
   cuando hace falta mostrarlas.
   ========================================================== */

const Fotos = (() => {
  const memoria = new Map();      // id -> dataURL
  const pidiendo = new Map();     // id -> Promise
  const PEND_KEY = 'miplato:fotos-pendientes';
  let refrescoTimer = null;

  /* ---------- IndexedDB mínima ---------- */
  let dbPromise = null;
  function idb() {
    if (!('indexedDB' in window)) return Promise.resolve(null);
    if (!dbPromise) {
      dbPromise = new Promise(resolve => {
        const req = indexedDB.open('miplato', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('fotos');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      });
    }
    return dbPromise;
  }
  async function idbGet(id) {
    const db = await idb();
    if (!db) return null;
    return new Promise(resolve => {
      const r = db.transaction('fotos').objectStore('fotos').get(id);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => resolve(null);
    });
  }
  async function idbPut(id, data) {
    const db = await idb();
    if (!db) return;
    return new Promise(resolve => {
      const tx = db.transaction('fotos', 'readwrite');
      tx.objectStore('fotos').put(data, id);
      tx.oncomplete = tx.onerror = () => resolve();
    });
  }
  async function idbClear() {
    const db = await idb();
    if (!db) return;
    return new Promise(resolve => {
      const tx = db.transaction('fotos', 'readwrite');
      tx.objectStore('fotos').clear();
      tx.oncomplete = tx.onerror = () => resolve();
    });
  }

  /* ---------- Fotos que falta subir ---------- */
  const pendientes = () => { try { return JSON.parse(localStorage.getItem(PEND_KEY)) || []; } catch (e) { return []; } };
  const setPendientes = l => { try { localStorage.setItem(PEND_KEY, JSON.stringify(l)); } catch (e) { /* nada */ } };

  /** Vuelve a dibujar la pantalla actual cuando llegan fotos (una vez, no por cada foto) */
  function refrescar() {
    clearTimeout(refrescoTimer);
    refrescoTimer = setTimeout(() => {
      const s = Screens[UI.actual];
      if (s && s.render && ['hoy', 'semana'].includes(UI.actual)) s.render();
    }, 150);
  }

  async function cargar(id) {
    if (memoria.has(id)) return memoria.get(id);
    if (pidiendo.has(id)) return pidiendo.get(id);
    const p = (async () => {
      let data = await idbGet(id);
      if (!data && typeof Nube !== 'undefined') {
        const desdeNube = await Nube.bajarFotos([id]);
        data = desdeNube[id] || null;
        if (data) idbPut(id, data);
      }
      if (data) memoria.set(id, data);
      pidiendo.delete(id);
      return data;
    })();
    pidiendo.set(id, p);
    return p;
  }

  return {
    /** Guarda una foto nueva y devuelve su id */
    async guardar(dataURL) {
      const id = 'f_' + UI.uid();
      memoria.set(id, dataURL);
      await idbPut(id, dataURL);
      setPendientes([...pendientes(), id]);
      if (typeof Nube !== 'undefined') Nube.programarSubida(300);
      return id;
    },

    /** dataURL de la foto si ya está a mano; si no, la busca y avisa para redibujar */
    url(id) {
      if (!id) return null;
      if (memoria.has(id)) return memoria.get(id);
      cargar(id).then(d => { if (d) refrescar(); });
      return null;
    },

    /** Espera a tener todas estas fotos (para el PDF) */
    async asegurar(ids) {
      const faltan = ids.filter(id => id && !memoria.has(id));
      if (!faltan.length) return;
      // Primero lo que haya en el dispositivo, después el resto de la nube en un solo pedido
      await Promise.all(faltan.map(async id => { const d = await idbGet(id); if (d) memoria.set(id, d); }));
      const deNube = faltan.filter(id => !memoria.has(id));
      if (deNube.length && typeof Nube !== 'undefined') {
        const r = await Nube.bajarFotos(deNube);
        for (const [id, data] of Object.entries(r)) { memoria.set(id, data); idbPut(id, data); }
      }
    },

    /** Sube las fotos pendientes (lo llama Nube cuando hay sesión) */
    async subirPendientes(subir) {
      const lista = pendientes();
      if (!lista.length) return;
      const filas = [];
      for (const id of lista) {
        const data = memoria.get(id) || await idbGet(id);
        if (data) filas.push({ id, data });
      }
      if (filas.length) await subir(filas);
      const enviados = new Set(lista);
      setPendientes(pendientes().filter(id => !enviados.has(id)));
    },

    /** Al cerrar sesión: borra las fotos de este dispositivo */
    async limpiar() {
      memoria.clear();
      setPendientes([]);
      await idbClear();
    }
  };
})();

/** Foto de una comida: la nueva (fotoId) o la vieja guardada adentro (foto) */
function fotoDe(c) {
  return c.foto || Fotos.url(c.fotoId);
}
