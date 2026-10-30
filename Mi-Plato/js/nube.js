/* ==========================================================
   nube.js — cuenta y datos en Supabase
   - Login con email y contraseña (Supabase Auth)
   - Tabla "perfiles": un documento JSON por usuario con todos sus datos
   - Tabla "fotos": las miniaturas de los platos
   Cada usuario solo puede leer y escribir lo suyo (Row Level Security,
   ver supabase.sql). La clave pública de Supabase la da /api/config.
   ========================================================== */

const Nube = {
  client: null,
  user: null,
  estado: 'iniciando',   // 'sin-config' | 'sincronizado' | 'guardando' | 'sin-conexion' | 'error'
  ultimoSync: null,
  subiendo: false,
  otraVez: false,
  timer: null,

  /* ---------- Arranque ---------- */
  async init() {
    let cfg = {};
    try { cfg = await (await fetch('/api/config', { cache: 'no-store' })).json(); } catch (e) { /* sin servidor */ }
    if (!cfg.supabaseUrl || !cfg.supabaseKey || !window.supabase) {
      this.estado = 'sin-config';
      return false;
    }
    this.client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    this.client.auth.onAuthStateChange(evento => {
      // Llegó desde el mail de "Me olvidé la contraseña"
      if (evento === 'PASSWORD_RECOVERY') setTimeout(() => Clave.pedirNueva(), 300);
    });
    window.addEventListener('online', () => this.subir());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.subir();
      else this.traerCambios();
    });
    // Mientras la app está abierta, cada minuto mira si hubo cambios desde otro dispositivo
    setInterval(() => { if (!document.hidden) this.traerCambios(); }, 60 * 1000);
    return true;
  },

  /** Si ya había sesión abierta en este navegador, carga los datos */
  async restaurar() {
    const { data } = await this.client.auth.getSession();
    const session = data && data.session;
    if (!session) {
      if (Store.cache) Store.cerrar();
      return false;
    }
    await this.abrirSesion(session.user);
    return true;
  },

  /* ---------- Cargar los datos del usuario ---------- */
  async abrirSesion(user, extra = {}) {
    this.user = user;
    const email = (user.email || '').toLowerCase();
    const cache = Store.cache && Store.cache.userId === user.id ? Store.cache : null;
    if (Store.cache && !cache) Store.cerrar(); // había otro usuario en este navegador

    let remoto = null;
    try {
      remoto = await this.leerRemoto(user.id);
    } catch (e) {
      // Sin conexión: si hay copia local seguimos con esa
      if (!cache) throw new Error('No se pudieron traer tus datos. Revisá tu conexión.');
      this.setEstado('sin-conexion');
    }

    if (remoto) {
      const localMasNuevo = cache && cache.sucio && cache.actualizado > remoto.actualizado;
      if (!localMasNuevo) Store.abrir(user.id, email, remoto.datos, remoto.actualizado, false);
    } else if (!cache) {
      // Primera vez en la nube: datos de la versión anterior de la app, del registro o vacíos
      const perfil = (user.user_metadata && user.user_metadata.perfil) || {};
      const datos = extra.datos || Legado.datos(email) || usuarioVacio(perfil);
      Store.abrir(user.id, email, datos, new Date().toISOString(), true);
    }

    await this.migrarFotosViejas();
    Plan.migrar();
    await this.subir();
  },

  /** Las fotos de la versión anterior estaban adentro de cada comida: las pasamos a la tabla de fotos */
  async migrarFotosViejas() {
    const viejas = (Store.u.comidas || []).filter(c => c.foto && !c.fotoId);
    if (!viejas.length) return;
    const ids = {};
    for (const c of viejas) ids[c.id] = await Fotos.guardar(c.foto);
    Store.update(u => {
      u.comidas.forEach(c => { if (ids[c.id]) { c.fotoId = ids[c.id]; delete c.foto; } });
    });
  },

  async leerRemoto(userId) {
    const { data, error } = await this.client.from('perfiles').select('datos, actualizado').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data;
  },

  /* ---------- Subir cambios ---------- */
  programarSubida(ms = 1200) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.subir(), ms);
  },

  async subir() {
    if (!this.client || !this.user || !Store.cache) return;
    if (this.subiendo) { this.otraVez = true; return; }
    if (!navigator.onLine) { this.setEstado('sin-conexion'); return; }
    this.subiendo = true;
    try {
      await Fotos.subirPendientes(async filas => {
        const { error } = await this.client.from('fotos')
          .upsert(filas.map(f => ({ user_id: this.user.id, id: f.id, data: f.data })), { onConflict: 'user_id,id' });
        if (error) throw error;
      });
      if (Store.cache.sucio) {
        this.setEstado('guardando');
        const marca = Store.cache.actualizado;
        const { error } = await this.client.from('perfiles')
          .upsert({ user_id: this.user.id, datos: Store.u, actualizado: marca }, { onConflict: 'user_id' });
        if (error) throw error;
        Store.marcarSubido(marca);
        if (Legado.usuario(Store.email)) Legado.borrar(Store.email); // ya está en la nube
      }
      this.ultimoSync = new Date();
      this.setEstado('sincronizado');
    } catch (e) {
      this.setEstado(navigator.onLine ? 'error' : 'sin-conexion');
      console.warn('[nube]', e && e.message);
      this.programarSubida(15000); // reintenta en un rato
    } finally {
      this.subiendo = false;
      if (this.otraVez) { this.otraVez = false; this.programarSubida(300); }
    }
  },

  /** Trae cambios hechos desde otro dispositivo (si acá no hay nada sin subir) */
  async traerCambios() {
    if (!this.user || !Store.cache || Store.cache.sucio || this.subiendo) return;
    // Si está escribiendo algo, no le cambiamos la pantalla de golpe
    const foco = document.activeElement;
    if (foco && /^(INPUT|TEXTAREA|SELECT)$/.test(foco.tagName)) return;
    try {
      const remoto = await this.leerRemoto(this.user.id);
      if (remoto && remoto.actualizado > Store.cache.actualizado) {
        Store.abrir(this.user.id, Store.email, remoto.datos, remoto.actualizado, false);
        // No interrumpimos si está escribiendo o en medio de cargar una comida
        if (!['cargar', 'resultado'].includes(UI.actual) && !document.querySelector('.modal:not([hidden])')) UI.route();
      }
    } catch (e) { /* sin conexión: se reintenta después */ }
  },

  async bajarFotos(ids) {
    if (!this.client || !this.user || !ids.length) return {};
    try {
      const { data, error } = await this.client.from('fotos').select('id, data').in('id', ids);
      if (error) throw error;
      return Object.fromEntries((data || []).map(f => [f.id, f.data]));
    } catch (e) { return {}; }
  },

  setEstado(e) {
    this.estado = e;
    const el = document.getElementById('perfil-sync');
    if (el) el.textContent = this.textoEstado();
  },

  textoEstado() {
    switch (this.estado) {
      case 'sincronizado': return 'Tus datos están guardados en la nube.';
      case 'guardando': return 'Guardando en la nube…';
      case 'sin-conexion': return 'Sin conexión: los cambios se suben cuando vuelva internet.';
      case 'error': return 'No se pudo guardar en la nube. Se reintenta solo.';
      default: return '';
    }
  },

  /* ---------- Cuenta ---------- */
  async ingresar(email, pass) {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password: pass });
    if (!error) { await this.abrirSesion(data.user); return { ok: true }; }

    // ¿Es una cuenta de la versión anterior (solo en este dispositivo)? La pasamos a la nube
    if (/invalid login credentials/i.test(error.message) && await Legado.verificar(email, pass)) {
      const r = await this.client.auth.signUp({ email, password: pass, options: { emailRedirectTo: location.origin } });
      if (r.error) return { ok: false, error: this.traducir(r.error) };
      if (r.data.session) { await this.abrirSesion(r.data.user); return { ok: true, migrado: true }; }
      return { ok: false, aviso: true, error: `Pasamos tu cuenta a la nube. Te mandamos un mail a ${email} para confirmarla: abrilo y después volvé a ingresar acá (tus datos siguen guardados en este celular).` };
    }
    return { ok: false, error: this.traducir(error) };
  },

  async registrar(email, pass, perfil) {
    const { data, error } = await this.client.auth.signUp({
      email, password: pass,
      options: { data: { perfil }, emailRedirectTo: location.origin }
    });
    if (error) return { ok: false, error: this.traducir(error) };
    // Supabase no avisa si el email ya existe: lo detectamos porque no trae identidades
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return { ok: false, error: 'Ya existe una cuenta con ese email. Ingresá.' };
    }
    if (data.session) { await this.abrirSesion(data.user, { datos: usuarioVacio(perfil) }); return { ok: true }; }
    return { ok: false, aviso: true, error: `Te mandamos un mail a ${email} para confirmar la cuenta. Abrilo y después ingresá.` };
  },

  async salir() {
    await this.subir();
    try { await this.client.auth.signOut(); } catch (e) { /* igual cerramos local */ }
    this.user = null;
    Store.cerrar();
    await Fotos.limpiar();
  },

  async recuperar(email) {
    const { error } = await this.client.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (error) throw new Error(this.traducir(error));
  },

  async cambiarClave(pass) {
    const { error } = await this.client.auth.updateUser({ password: pass });
    if (error) throw new Error(this.traducir(error));
  },

  async token() {
    if (!this.client) return null;
    const { data } = await this.client.auth.getSession();
    return data && data.session ? data.session.access_token : null;
  },

  traducir(error) {
    const m = String((error && error.message) || error || '');
    if (/invalid login credentials/i.test(m)) return 'Email o contraseña incorrectos.';
    if (/email not confirmed/i.test(m)) return 'Todavía no confirmaste tu email. Revisá tu correo (también en spam).';
    if (/already registered|already been registered/i.test(m)) return 'Ya existe una cuenta con ese email. Ingresá.';
    if (/password should be|at least \d+ characters/i.test(m)) return 'La contraseña es muy corta (mínimo 8 caracteres).';
    if (/weak|pwned/i.test(m)) return 'Esa contraseña es muy fácil de adivinar. Probá con otra.';
    if (/rate limit|too many/i.test(m)) return 'Demasiados intentos. Esperá unos minutos y probá de nuevo.';
    if (/failed to fetch|network/i.test(m)) return 'No hay conexión. Revisá tu internet.';
    if (/same.*password|different from the old/i.test(m)) return 'La contraseña nueva tiene que ser distinta a la anterior.';
    return m || 'Algo salió mal. Probá de nuevo.';
  }
};

/* ---------- Nueva contraseña (al volver del mail de recuperación) ---------- */
const Clave = {
  init() {
    document.getElementById('form-clave').addEventListener('submit', async e => {
      e.preventDefault();
      const p1 = document.getElementById('clave-nueva').value;
      const p2 = document.getElementById('clave-nueva2').value;
      const err = document.getElementById('clave-error');
      err.textContent = '';
      if (p1.length < 8) { err.textContent = 'Mínimo 8 caracteres.'; return; }
      if (p1 !== p2) { err.textContent = 'Las contraseñas no coinciden.'; return; }
      try {
        await Nube.cambiarClave(p1);
        Modal.cerrar();
        UI.toast('Contraseña actualizada');
        const { data } = await Nube.client.auth.getSession();
        if (data.session) { await Nube.abrirSesion(data.session.user); UI.ir('hoy'); }
      } catch (er) { err.textContent = er.message; }
    });
  },
  pedirNueva() { Modal.abrir('dlg-clave', 'clave-nueva'); }
};
