/* ==========================================================
   app.js — arranque de la app
   ========================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  // Inicializa cada pantalla una sola vez
  Object.values(Screens).forEach(s => { if (s.init) s.init(); });
  Festejo.init();
  Modal.init();
  Horarios.init();
  Clave.init();
  Demo.init();

  // Botones de tema (login, registro, perfil): alternan claro/oscuro
  document.querySelectorAll('.js-theme-toggle').forEach(b => {
    b.addEventListener('click', () => UI.setTema(UI.esOscuro() ? 'light' : 'dark'));
  });
  // Si el tema es "automático", seguimos los cambios del sistema
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', UI.actualizarTema);
  // Al pasar de celular a compu (o girar la tablet) cambia la navegación
  window.matchMedia('(min-width: 960px)').addEventListener('change', () => UI.route());
  UI.actualizarTema();

  // Conexión con la nube y sesión guardada
  try {
    if (await Nube.init()) await Nube.restaurar();
  } catch (e) {
    UI.toast(e.message || 'No se pudo conectar con la nube.', 5000);
  }
  await Demo.retomar();
  UI.actualizarTema();
  document.getElementById('arranque').hidden = true;

  window.addEventListener('hashchange', UI.route);
  UI.route();
  Recordatorios.iniciar();
});
