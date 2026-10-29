/* ==========================================================
   chat.js — asistente de recetas e ingredientes (Gemini)
   ========================================================== */

const SUGERENCIAS = [
  'Ideas de merienda',
  '¿Qué ceno con lo que tengo en la heladera?',
  'Receta de panqueques de avena',
  '¿Qué legumbre me conviene?',
  '¿Puedo comer queso cremoso?'
];

Screens.chat = {
  enviando: false,

  init() {
    document.getElementById('form-chat').addEventListener('submit', e => {
      e.preventDefault();
      const input = document.getElementById('chat-input');
      const t = input.value.trim();
      if (!t || this.enviando) return;
      input.value = '';
      this.enviar(t);
    });

    document.getElementById('chat-sugerencias').addEventListener('click', e => {
      const b = e.target.closest('.chip');
      if (b && !this.enviando) this.enviar(b.textContent);
    });

    document.getElementById('chat-nuevo').addEventListener('click', () => {
      if (!Store.u.chat.length) return;
      Store.update(u => { u.chat = []; });
      this.render();
    });
  },

  async enviar(texto) {
    this.enviando = true;
    Store.update(u => { u.chat.push({ role: 'user', text: texto }); });
    this.render(true);
    try {
      const historial = Store.u.chat.slice(-12);
      const r = await Api.chat(historial);
      Store.update(u => { u.chat.push({ role: 'model', text: r.texto || 'No tengo una respuesta para eso.' }); });
    } catch (err) {
      Store.update(u => { u.chat.push({ role: 'model', text: '⚠ ' + err.message, error: true }); });
    }
    this.enviando = false;
    this.render();
  },

  render(escribiendo = false) {
    const log = document.getElementById('chat-log');
    const msgs = Store.u.chat;
    if (!msgs.length) {
      log.innerHTML = `<p class="chat-empty">Preguntame por recetas, ingredientes o qué comer.<br>Respondo según tus pautas${Store.u.pautas.reglas.length ? '' : ' (todavía no cargaste ninguna)'}.</p>`;
    } else {
      log.innerHTML = msgs.map(m => m.role === 'user'
        ? `<div class="msg msg--user">${UI.esc(m.text)}</div>`
        : `<div class="msg msg--bot">${UI.mdLite(m.text)}</div>`
      ).join('') + (escribiendo ? '<div class="msg msg--bot msg--typing">Escribiendo…</div>' : '');
    }
    log.scrollTop = log.scrollHeight;

    document.getElementById('chat-sugerencias').innerHTML = msgs.length > 2 ? '' :
      SUGERENCIAS.map(s => `<button type="button" class="chip">${UI.esc(s)}</button>`).join('');
  }
};
