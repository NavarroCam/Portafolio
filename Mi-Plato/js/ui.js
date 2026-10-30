/* ==========================================================
   ui.js — navegación entre pantallas, tema y utilidades
   ========================================================== */

const Screens = {}; // cada módulo registra: Screens.nombre = { init(), render() }

const UI = (() => {
  const PUBLICAS = ['login', 'registro'];
  const ONBOARDING = ['salud', 'nutri', 'pautas'];
  const CON_TABS = ['hoy', 'agua', 'chat', 'semana'];
  let actual = null;

  /* ---------- Router por hash (#hoy, #agua...) ---------- */
  function destino() {
    let nombre = location.hash.replace('#', '') || 'hoy';
    if (!document.getElementById('screen-' + nombre)) nombre = 'hoy';
    const u = Store.u;
    if (!u) return PUBLICAS.includes(nombre) ? nombre : 'login';
    if (PUBLICAS.includes(nombre)) return 'hoy';
    if (!u.onboarding && !ONBOARDING.includes(nombre)) return 'salud';
    return nombre;
  }

  function route() {
    const nombre = destino();
    if (('#' + nombre) !== location.hash) {
      history.replaceState(null, '', '#' + nombre);
    }
    document.querySelectorAll('.screen').forEach(s => { s.hidden = s.id !== 'screen-' + nombre; });

    // Celular: barra de abajo solo en las 4 pantallas principales.
    // Compu: menú lateral siempre (una vez terminada la configuración inicial).
    const tabbar = document.getElementById('tabbar');
    const escritorio = window.matchMedia('(min-width: 960px)').matches;
    const listo = !!(Store.u && Store.u.onboarding);
    const conTabs = listo && (escritorio ? !PUBLICAS.includes(nombre) : CON_TABS.includes(nombre));
    tabbar.hidden = !conTabs;
    document.querySelector('.app').classList.toggle('has-tabbar', conTabs);
    const seccion = { resultado: 'cargar', exportar: 'semana', progreso: 'perfil', consulta: 'perfil', salud: 'perfil', nutri: 'perfil', pautas: 'perfil' }[nombre] || nombre;
    tabbar.querySelectorAll('a').forEach(a => {
      if (a.dataset.tab === seccion) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });

    // En el onboarding los botones dicen "Continuar"; desde el perfil, "Guardar"
    const enOnboarding = Store.u && !Store.u.onboarding;
    document.querySelectorAll('.js-onb-only').forEach(el => { el.hidden = !enOnboarding; });
    document.querySelectorAll('.js-onb-submit').forEach(el => { el.textContent = enOnboarding ? 'Continuar' : 'Guardar'; });
    document.querySelectorAll('.js-onb-back').forEach(el => {
      if (!enOnboarding) el.setAttribute('href', '#perfil');
    });
    const backSalud = document.querySelector('#screen-salud .js-onb-back');
    if (backSalud) backSalud.hidden = !!enOnboarding;

    actual = nombre;
    const s = Screens[nombre];
    if (s && s.render) s.render();
    window.scrollTo(0, 0);
    actualizarTema();
  }

  function ir(nombre) {
    if (location.hash === '#' + nombre) route();
    else location.hash = nombre;
  }

  /* ---------- Tema claro / oscuro ---------- */
  function esOscuro() {
    const t = Store.theme;
    if (t === 'dark') return true;
    if (t === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function actualizarTema() {
    document.documentElement.dataset.theme = Store.theme;
    const oscuro = esOscuro();
    document.querySelector('meta[name="theme-color"]').content = oscuro ? '#0F1612' : '#2F6B4F';
    document.querySelectorAll('.js-theme-toggle').forEach(b => {
      b.innerHTML = oscuro
        ? '<svg><use href="#i-sun"></use></svg>Claro'
        : '<svg><use href="#i-moon"></use></svg>Oscuro';
      b.setAttribute('aria-label', oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
    });
    const sel = document.getElementById('perfil-tema');
    if (sel) sel.value = Store.theme;
  }

  function setTema(t) {
    Store.theme = t;
    actualizarTema();
  }

  /* ---------- Toast ---------- */
  let toastTimer = null;
  function toast(texto, ms = 2600) {
    const t = document.getElementById('toast');
    t.textContent = texto;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  }

  /* ---------- Utilidades ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** Markdown muy básico para las respuestas del asistente */
  function mdLite(texto) {
    const lineas = esc(texto).split(/\n/);
    let html = '';
    let enLista = false;
    for (const l of lineas) {
      const item = l.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)/);
      if (item) {
        if (!enLista) { html += '<ul>'; enLista = true; }
        html += '<li>' + item[1] + '</li>';
      } else {
        if (enLista) { html += '</ul>'; enLista = false; }
        if (l.trim()) html += '<p>' + l + '</p>';
      }
    }
    if (enLista) html += '</ul>';
    return html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }

  function litros(ml) {
    return (ml / 1000).toLocaleString('es-AR', { maximumFractionDigits: 2 }) + ' L';
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  return {
    route, ir, toast, esc, mdLite, litros, uid, setTema, esOscuro, actualizarTema,
    get actual() { return actual; }
  };
})();
