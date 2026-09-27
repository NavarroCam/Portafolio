/* ==========================================================
   auth.js — Login simulado
   Los usuarios se guardan en el navegador (localStorage).
   Es ilustrativo: NO es seguro para una app real.
   ========================================================== */
window.CineApp = window.CineApp || {};

(function (C) {
  'use strict';

  const USERS_KEY = 'cineapp.users';
  const SESSION_KEY = 'cineapp.session';
  const DEMO = { email: 'demo@cineapp.com', password: 'cine1234' };

  // Estructura de email: usuario@dominio.ext (ext de 2+ letras)
  const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;

  // Hash simple para no guardar la contraseña en texto plano (solo demo)
  function fakeHash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    return 'h' + h.toString(36);
  }

  function users() {
    const u = C.store.get(USERS_KEY, {});
    if (!u[DEMO.email]) u[DEMO.email] = fakeHash(DEMO.password);
    return u;
  }

  C.auth = {
    DEMO,

    validateEmail(email) {
      const e = email.trim();
      if (!e) return 'Ingresá tu email.';
      if (!EMAIL_RE.test(e)) return 'Revisá el email: tiene que tener el formato nombre@dominio.com.';
      return '';
    },

    validatePassword(pw) {
      if (!pw) return 'Ingresá tu contraseña.';
      if (pw.length < 6) return 'La contraseña tiene que tener al menos 6 caracteres.';
      return '';
    },

    login(email, password) {
      const e = email.trim().toLowerCase();
      const errEmail = this.validateEmail(e);
      const errPw = this.validatePassword(password);
      if (errEmail || errPw) return { ok: false, field: errEmail ? 'email' : 'password', error: errEmail || errPw };
      const u = users();
      if (!u[e]) return { ok: false, field: 'email', error: 'No hay una cuenta con ese email. Podés crearla en "Crear cuenta".' };
      if (u[e] !== fakeHash(password)) return { ok: false, field: 'password', error: 'La contraseña no coincide con la de esa cuenta.' };
      C.store.set(SESSION_KEY, { email: e, since: Date.now() });
      return { ok: true, user: { email: e } };
    },

    register(email, password, confirm) {
      const e = email.trim().toLowerCase();
      const errEmail = this.validateEmail(e);
      if (errEmail) return { ok: false, field: 'email', error: errEmail };
      const errPw = this.validatePassword(password);
      if (errPw) return { ok: false, field: 'password', error: errPw };
      if (password !== confirm) return { ok: false, field: 'confirm', error: 'Las contraseñas no coinciden.' };
      const u = users();
      if (u[e]) return { ok: false, field: 'email', error: 'Ya existe una cuenta con ese email. Ingresá desde "Ingresar".' };
      u[e] = fakeHash(password);
      C.store.set(USERS_KEY, u);
      C.store.set(SESSION_KEY, { email: e, since: Date.now() });
      return { ok: true, user: { email: e } };
    },

    current() {
      const s = C.store.get(SESSION_KEY, null);
      return s && s.email ? { email: s.email } : null;
    },

    logout() {
      C.store.remove(SESSION_KEY);
    }
  };
})(window.CineApp);
