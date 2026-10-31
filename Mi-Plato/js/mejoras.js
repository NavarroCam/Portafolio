/* ==========================================================
   mejoras.js — "Próximas mejoras" (con votos) y "Sugerir una mejora"
   - La lista de mejoras se edita acá abajo (MEJORAS).
   - Los votos se guardan en Supabase (tabla "votos", ver supabase.sql).
   - Las sugerencias van a /api/sugerencia: se guardan en la tabla
     "sugerencias" y te llegan por mail.
   ========================================================== */

/* estado: 'camino' (en camino) | 'planeado' | 'idea' */
const MEJORAS = [
  { id: 'avisos-cerrada', estado: 'camino', titulo: 'Recordatorios con la app cerrada', detalle: 'Avisos de agua y comidas aunque no tengas la app abierta.' },
  { id: 'borrar-cuenta', estado: 'camino', titulo: 'Borrar mi cuenta y mis datos', detalle: 'Un botón para eliminar todo desde Mi usuario.' },
  { id: 'compartir-nutri', estado: 'planeado', titulo: 'Compartir con tu nutri', detalle: 'Un link para que vea tu semana sin mandarle el PDF.', nuevo: true },
  { id: 'instalar-app', estado: 'planeado', titulo: 'Que funcione sin internet', detalle: 'Ver tu día y cargar comidas aunque no tengas conexión.' },
  { id: 'lista-compras', estado: 'idea', titulo: 'Lista de compras', detalle: 'Armada con tus pautas y las recetas del asistente.' },
  { id: 'pasos', estado: 'idea', titulo: 'Contar pasos y actividad', detalle: 'Sumar la actividad del celular o del reloj al resumen semanal.' }
];
const ESTADOS_MEJORA = { camino: 'En camino', planeado: 'Planeado', idea: 'Ideas' };

Screens.mejoras = {
  conteos: {},     // { id: cantidad } de todos los usuarios
  mios: new Set(), // ids que votó este usuario

  init() {
    document.getElementById('mejoras-lista').addEventListener('click', e => {
      const b = e.target.closest('[data-votar]');
      if (b) this.votar(b.dataset.votar);
    });
  },

  async cargar() {
    const c = Nube.client;
    if (!c) return;
    try {
      const { data } = await c.rpc('conteo_votos');
      this.conteos = Object.fromEntries((data || []).map(x => [x.mejora_id, Number(x.votos) || 0]));
      if (Nube.user && !Demo.activo) {
        const r = await c.from('votos').select('mejora_id').eq('user_id', Nube.user.id);
        this.mios = new Set((r.data || []).map(x => x.mejora_id));
      }
    } catch (e) { /* sin conexión: se ve la lista sin números */ }
    if (UI.actual === 'mejoras') this.pintar();
  },

  async votar(id) {
    if (Demo.activo || !Nube.user) { UI.toast('Creá tu cuenta para votar. ¡Así sabemos qué hacer primero!', 3500); return; }
    const tenia = this.mios.has(id);
    // Se ve al instante y después se guarda
    if (tenia) this.mios.delete(id); else this.mios.add(id);
    this.conteos[id] = Math.max(0, (this.conteos[id] || 0) + (tenia ? -1 : 1));
    this.pintar();
    const q = Nube.client.from('votos');
    const { error } = tenia
      ? await q.delete().eq('user_id', Nube.user.id).eq('mejora_id', id)
      : await q.insert({ user_id: Nube.user.id, mejora_id: id });
    if (error) {
      if (tenia) this.mios.add(id); else this.mios.delete(id);
      this.conteos[id] = Math.max(0, (this.conteos[id] || 0) + (tenia ? 1 : -1));
      this.pintar();
      UI.toast('No se pudo guardar el voto. Probá de nuevo en un rato.');
    }
  },

  pintar() {
    const grupos = Object.keys(ESTADOS_MEJORA).map(estado => {
      // Dentro de cada grupo, lo más votado primero
      const items = MEJORAS.filter(m => m.estado === estado)
        .sort((a, b) => (this.conteos[b.id] || 0) - (this.conteos[a.id] || 0));
      if (!items.length) return '';
      return `
        <div class="stack-sm">
          <span class="estado-mejora estado-mejora--${estado}">${ESTADOS_MEJORA[estado]}</span>
          ${items.map(m => {
            const on = this.mios.has(m.id);
            const n = this.conteos[m.id];
            return `
            <div class="mejora">
              <div class="mejora-txt">
                <strong>${UI.esc(m.titulo)}${m.nuevo ? ' <span class="tag-nuevo">NUEVO</span>' : ''}</strong>
                <span>${UI.esc(m.detalle)}</span>
              </div>
              <button type="button" class="voto" data-votar="${m.id}" aria-pressed="${on}" aria-label="Me interesa: ${UI.esc(m.titulo)}${n != null ? `, ${n} votos` : ''}">
                <svg><use href="#i-heart${on ? '-fill' : ''}"></use></svg><span>${n != null ? n : ''}</span>
              </button>
            </div>`;
          }).join('')}
        </div>`;
    });
    document.getElementById('mejoras-lista').innerHTML = grupos.join('');
  },

  render() {
    // Desde la demo, "Volver" lleva a Hoy
    document.getElementById('mejoras-volver').setAttribute('href', Demo.activo ? '#hoy' : '#perfil');
    this.pintar();
    this.cargar();
  }
};

Screens.sugerir = {
  tipo: 'nuevo',

  init() {
    document.getElementById('sug-tipo').addEventListener('click', e => {
      const b = e.target.closest('.chip');
      if (!b) return;
      this.tipo = b.dataset.tipo;
      document.querySelectorAll('#sug-tipo .chip').forEach(x => x.setAttribute('aria-checked', String(x === b)));
    });
    document.getElementById('form-sugerir').addEventListener('submit', e => { e.preventDefault(); this.enviar(); });
  },

  async enviar() {
    const titulo = document.getElementById('sug-titulo').value.trim();
    const detalle = document.getElementById('sug-detalle').value.trim();
    const avisar = document.getElementById('sug-avisar').checked;
    const email = document.getElementById('sug-email').value.trim();
    const err = document.getElementById('sug-error');
    err.textContent = '';
    if (titulo.length < 3) { err.textContent = 'Contanos tu idea en pocas palabras.'; document.getElementById('sug-titulo').focus(); return; }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) { err.textContent = 'Revisá el email.'; return; }

    const btn = document.getElementById('sug-enviar');
    btn.disabled = true; btn.textContent = 'Enviando…';
    try {
      const token = Demo.activo ? null : await Nube.token();
      let res;
      try {
        res = await fetch('/api/sugerencia', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
          body: JSON.stringify({
            tipo: this.tipo, titulo, detalle, avisar, email,
            nombre: Demo.activo ? '' : nombreCorto(),
            contexto: {
              dispositivo: window.matchMedia('(min-width: 960px)').matches ? 'compu' : 'celular',
              paleta: PALETAS[Temas.actual()].nombre,
              demo: Demo.activo
            }
          })
        });
      } catch (e) { throw new Error('No hay conexión. Revisá tu internet e intentá de nuevo.'); }
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'No se pudo enviar. Probá de nuevo en un rato.');
      this.gracias(titulo, avisar && (!!token || !!email));
    } catch (e) {
      err.textContent = e.message;
    } finally {
      btn.disabled = false; btn.textContent = 'Enviar';
    }
  },

  gracias(titulo, avisar) {
    const quien = Demo.activo ? '' : nombreCorto();
    document.getElementById('sug-gracias-titulo').textContent = `¡Gracias${quien ? ', ' + quien : ''}!`;
    document.getElementById('sug-gracias-texto').textContent =
      `Tu idea "${titulo}" ya le llegó a quien hace Mi Plato.${avisar ? ' Te avisamos por mail cuando esté lista.' : ''}`;
    document.getElementById('form-sugerir').hidden = true;
    document.getElementById('sug-gracias').hidden = false;
  },

  render() {
    document.getElementById('form-sugerir').hidden = false;
    document.getElementById('sug-gracias').hidden = true;
    document.getElementById('sug-titulo').value = '';
    document.getElementById('sug-detalle').value = '';
    document.getElementById('sug-error').textContent = '';
    // Sin cuenta (demo) pedimos el email para poder avisarle
    document.getElementById('sug-email-wrap').hidden = !Demo.activo;
  }
};
