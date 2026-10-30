/* ==========================================================
   app.js — arranque de la app
   ========================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Inicializa cada pantalla una sola vez
  Object.values(Screens).forEach(s => { if (s.init) s.init(); });
  Festejo.init();
  Modal.init();
  Horarios.init();

  // Botones de tema (login, registro, perfil): alternan claro/oscuro
  document.querySelectorAll('.js-theme-toggle').forEach(b => {
    b.addEventListener('click', () => UI.setTema(UI.esOscuro() ? 'light' : 'dark'));
  });
  // Si el tema es "automático", seguimos los cambios del sistema
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', UI.actualizarTema);

  window.addEventListener('hashchange', UI.route);
  UI.route();
  Recordatorios.iniciar();
});
