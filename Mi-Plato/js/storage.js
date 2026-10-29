/* ==========================================================
   storage.js — datos guardados en localStorage
   Cada usuario tiene su propio objeto. La sesión guarda el
   email del usuario logueado.
   ========================================================== */

const Store = (() => {
  const KEY = 'miplato:v1';

  function leer() {
    try {
      const raw = localStorage.getItem(KEY);
      const db = raw ? JSON.parse(raw) : null;
      if (db && db.users) return db;
    } catch (e) { /* datos corruptos: empezamos de cero */ }
    return { users: {}, session: null, theme: 'auto' };
  }

  let db = leer();

  function guardar() {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
      return true;
    } catch (e) {
      // Casi siempre es porque se llenó el almacenamiento (fotos)
      UI.toast('No hay más espacio en el dispositivo. Borrá comidas viejas o exportalas.');
      return false;
    }
  }

  function usuarioVacio(datos) {
    return {
      creado: new Date().toISOString(),
      passHash: datos.passHash,
      perfil: { nombre: datos.nombre, apellido: datos.apellido, nacimiento: datos.nacimiento || '', altura: datos.altura || '' },
      onboarding: false,
      salud: { condiciones: [], otra: '', alergias: '' },
      nutri: { tiene: true, nombre: '', telefono: '', email: '', proximo: '', frecuencia: 'Cada 15 días', objetivo: '' },
      pautas: { archivos: [], reglas: [] },
      comidas: [],      // { id, fecha, tipo, momento, foto, descripcion, analisis }
      agua: {},         // { 'AAAA-MM-DD': ml }
      actividad: {},    // { 'AAAA-MM-DD': cantidad }
      medidas: [],      // { fecha, peso, cintura, cadera }
      metas: [],        // { id, tipo, valor, fecha, texto }
      notas: '',
      chat: [],         // { role: 'user' | 'model', text }
      recordatorios: { cada2: false, comidas: true, atrasada: false }
    };
  }

  return {
    get theme() { return db.theme || 'auto'; },
    set theme(v) { db.theme = v; guardar(); },

    existe(email) { return !!db.users[email]; },
    crear(email, datos) { db.users[email] = usuarioVacio(datos); db.session = email; guardar(); },
    hash(email) { return db.users[email] && db.users[email].passHash; },

    login(email) { db.session = email; guardar(); },
    logout() { db.session = null; guardar(); },
    get email() { return db.session; },

    /** Usuario logueado (o null) */
    get u() { return db.session ? db.users[db.session] || null : null; },

    /** Modifica el usuario y guarda */
    update(fn) {
      const u = this.u;
      if (!u) return false;
      fn(u);
      return guardar();
    }
  };
})();

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
