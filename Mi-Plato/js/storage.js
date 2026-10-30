/* ==========================================================
   storage.js — datos del usuario
   La copia "oficial" vive en la nube (Supabase, ver nube.js).
   Acá guardamos una copia local en el navegador para que la
   app abra al instante y funcione aunque no haya internet.
   Cada cambio se guarda local y se sube solo a la nube.
   ========================================================== */

const Store = (() => {
  const KEY = 'miplato:v2';

  function leer() {
    try {
      const raw = localStorage.getItem(KEY);
      const x = raw ? JSON.parse(raw) : null;
      if (x && typeof x === 'object') return x;
    } catch (e) { /* datos corruptos: empezamos de cero */ }
    return { theme: 'auto', cache: null };
  }

  let db = leer();
  // Tema elegido en la versión anterior de la app
  if (!localStorage.getItem(KEY)) {
    try { db.theme = (JSON.parse(localStorage.getItem('miplato:v1')) || {}).theme || 'auto'; } catch (e) { /* nada */ }
  }

  function guardar() {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
      return true;
    } catch (e) {
      UI.toast('No hay más espacio en este navegador. Igual se guarda en la nube si hay conexión.');
      return false;
    }
  }

  return {
    get theme() { return db.theme || 'auto'; },
    set theme(v) { db.theme = v; guardar(); },

    /** Datos del usuario logueado (o null) */
    get u() { return db.cache ? db.cache.datos : null; },
    get email() { return db.cache ? db.cache.email : null; },
    get userId() { return db.cache ? db.cache.userId : null; },
    /** Copia local completa: { userId, email, datos, actualizado, sucio } */
    get cache() { return db.cache; },

    /** Abre los datos de un usuario (vienen de la nube o de la copia local) */
    abrir(userId, email, datos, actualizado, sucio = false) {
      db.cache = { userId, email, datos, actualizado: actualizado || new Date().toISOString(), sucio };
      guardar();
    },

    /** Marca la copia local como subida a la nube */
    marcarSubido(actualizado) {
      if (db.cache && db.cache.actualizado === actualizado) { db.cache.sucio = false; guardar(); }
    },

    /** Al cerrar sesión borramos la copia local (por si es una compu compartida) */
    cerrar() { db.cache = null; guardar(); },

    /** Modifica los datos, los guarda local y programa la subida a la nube */
    update(fn) {
      if (!db.cache) return false;
      fn(db.cache.datos);
      db.cache.actualizado = new Date().toISOString();
      db.cache.sucio = true;
      const ok = guardar();
      if (typeof Nube !== 'undefined') Nube.programarSubida();
      return ok;
    }
  };
})();

/** Datos iniciales de un usuario nuevo */
function usuarioVacio(perfil = {}) {
  return {
    creado: new Date().toISOString(),
    perfil: {
      nombre: perfil.nombre || '', apellido: perfil.apellido || '', apodo: perfil.apodo || '',
      nacimiento: perfil.nacimiento || '', altura: perfil.altura || ''
    },
    onboarding: false,
    salud: { condiciones: [], otra: '', alergias: '' },
    nutri: { tiene: true, nombre: '', telefono: '', email: '', proximo: '', frecuencia: 'Cada 15 días', objetivo: '' },
    pautas: { archivos: [], reglas: [] },
    comidas: [],      // { id, fecha, tipo, momento, fotoId, descripcion, analisis }
    agua: {},         // { 'AAAA-MM-DD': ml }
    actividad: {},    // { 'AAAA-MM-DD': cantidad }
    medidas: [],      // { fecha, peso, cintura, cadera }
    metas: [],        // { id, tipo, valor, fecha, texto }
    notas: '',
    chat: [],         // { role: 'user' | 'model', text }
    comidasPlan: null,  // se arma con los PDFs de pautas (ver plan.js); null = comidas de ejemplo
    limites: [],        // { id, nombre, min, max, periodo }
    planEditado: false,
    recordatorios: { cada2: false, comidas: true, atrasada: false }
  };
}

/* ---------- Cuentas de la versión anterior (solo en este dispositivo) ----------
   Antes la cuenta vivía solo en el navegador. Cuando la persona ingresa con
   el mismo email y contraseña, se crea su cuenta en la nube con esos datos. */
const Legado = (() => {
  const KEY = 'miplato:v1';
  const leer = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { users: {} }; } catch (e) { return { users: {} }; } };
  return {
    hay() { return Object.keys(leer().users || {}).length > 0; },
    usuario(email) { return (leer().users || {})[email] || null; },
    async verificar(email, pass) {
      const u = this.usuario(email);
      return !!u && u.passHash === await hashPass(email, pass);
    },
    /** Datos listos para la nube (sin la contraseña local) */
    datos(email) {
      const u = this.usuario(email);
      if (!u) return null;
      const copia = JSON.parse(JSON.stringify(u));
      delete copia.passHash;
      const base = usuarioVacio(copia.perfil);
      // Sin plan propio: así Plan.migrar() le arma las comidas y límites que ya veía
      delete base.comidasPlan; delete base.limites; delete base.planEditado;
      return { ...base, ...copia };
    },
    borrar(email) {
      const db = leer();
      if (db.users) delete db.users[email];
      if (db.session === email) db.session = null;
      try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* nada */ }
    }
  };
})();

async function hashPass(email, pass) {
  const datos = new TextEncoder().encode(email.toLowerCase() + '::' + pass);
  const buf = await crypto.subtle.digest('SHA-256', datos);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Cómo le habla la app al usuario: el apodo si lo cargó, si no el nombre */
function nombreCorto() {
  const p = Store.u ? Store.u.perfil : null;
  if (!p) return '';
  return (p.apodo || p.nombre || '').trim();
}

/* ---------- Fechas ---------- */
const Fechas = {
  /** 'AAAA-MM-DD' en hora local */
  clave(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },
  desdeClave(k) {
    const [y, m, d] = k.split('-').map(Number);
    return new Date(y, m - 1, d);
  },
  /** Lunes de la semana de la fecha d */
  lunes(d = new Date()) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dia = (x.getDay() + 6) % 7; // 0 = lunes
    x.setDate(x.getDate() - dia);
    return x;
  },
  sumarDias(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  },
  diasSemana(lunes) {
    return Array.from({ length: 7 }, (_, i) => Fechas.sumarDias(lunes, i));
  },
  largo(d) {
    const t = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
    return t.charAt(0).toUpperCase() + t.slice(1);
  },
  corto(d) {
    return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', '');
  },
  rango(lunes) {
    return `${Fechas.corto(lunes)} – ${Fechas.corto(Fechas.sumarDias(lunes, 6))}`;
  },
  hora(iso) {
    return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  }
};
