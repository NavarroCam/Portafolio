/* ==========================================================
   mis-comidas.js — pantalla "Mis comidas y límites"
   Cada usuario edita sus comidas (nombre, hora, guía y cómo se
   evalúa la foto) y los límites que la app cuenta en cada plato.
   ========================================================== */

Screens['mis-comidas'] = {
  editandoComida: null,   // id o null si es nueva
  editandoLimite: null,

  init() {
    document.getElementById('plan-estilo').innerHTML =
      Object.entries(ESTILOS).map(([k, v]) => `<option value="${k}">${UI.esc(v)}</option>`).join('');

    document.getElementById('mc-comidas').addEventListener('click', e => {
      const b = e.target.closest('[data-id]');
      if (b) this.abrirComida(b.dataset.id);
    });
    document.getElementById('mc-limites').addEventListener('click', e => {
      const b = e.target.closest('[data-id]');
      if (b) this.abrirLimite(b.dataset.id);
    });
    document.getElementById('mc-agregar-comida').addEventListener('click', () => this.abrirComida(null));
    document.getElementById('mc-agregar-limite').addEventListener('click', () => this.abrirLimite(null));

    /* ---- Guardar / borrar comida ---- */
    document.getElementById('form-plan').addEventListener('submit', e => {
      e.preventDefault();
      const err = document.getElementById('plan-error');
      const nombre = document.getElementById('plan-nombre').value.trim();
      const hora = document.getElementById('plan-hora').value;
      if (!nombre) { err.textContent = 'Poné un nombre.'; return; }
      if (!hora) { err.textContent = 'Elegí la hora.'; return; }
      const datos = {
        nombre, hora,
        estilo: document.getElementById('plan-estilo').value,
        guia: document.getElementById('plan-guia').value.trim()
      };
      const id = this.editandoComida;
      Store.update(u => {
        u.comidasPlan = Plan.comidas().map(c => ({ ...c }));
        if (id) Object.assign(u.comidasPlan.find(c => c.id === id), datos);
        else {
          let nuevo = 'c-' + slug(nombre), i = 2;
          while (u.comidasPlan.some(c => c.id === nuevo)) nuevo = 'c-' + slug(nombre) + '-' + i++;
          u.comidasPlan.push({ id: nuevo, ...datos });
        }
        u.planEditado = true;
      });
      Modal.cerrar();
      UI.toast(id ? 'Comida actualizada' : 'Comida agregada');
      this.render();
    });

    document.getElementById('plan-borrar').addEventListener('click', () => {
      const id = this.editandoComida;
      if (!id) return;
      if (Plan.comidas().length <= 1) { document.getElementById('plan-error').textContent = 'Tiene que quedar al menos una comida.'; return; }
      if (!confirm(`¿Eliminar "${Plan.nombre(id)}" de tu plan? Lo que ya cargaste no se borra.`)) return;
      Store.update(u => {
        u.comidasPlan = Plan.comidas().filter(c => c.id !== id);
        u.planEditado = true;
      });
      Modal.cerrar();
      UI.toast('Comida eliminada');
      this.render();
    });

    /* ---- Guardar / borrar límite ---- */
    document.getElementById('form-limite').addEventListener('submit', e => {
      e.preventDefault();
      const err = document.getElementById('lim-error');
      const nombre = document.getElementById('lim-nombre').value.trim();
      const num = v => (v === '' ? null : Math.max(0, Math.round(Number(v))));
      const min = num(document.getElementById('lim-min').value);
      const max = num(document.getElementById('lim-max').value);
      if (!nombre) { err.textContent = 'Poné qué querés controlar.'; return; }
      if (min == null && max == null) { err.textContent = 'Completá un mínimo, un máximo o los dos.'; return; }
      if (min != null && max != null && min > max) { err.textContent = 'El mínimo no puede ser mayor que el máximo.'; return; }
      const datos = { nombre, min, max, periodo: document.getElementById('lim-periodo').value };
      const id = this.editandoLimite;
      Store.update(u => {
        u.limites = Plan.limites().map(l => ({ ...l }));
        if (id) Object.assign(u.limites.find(l => l.id === id), datos);
        else {
          let nuevo = 'l-' + slug(nombre), i = 2;
          while (u.limites.some(l => l.id === nuevo)) nuevo = 'l-' + slug(nombre) + '-' + i++;
          u.limites.push({ id: nuevo, ...datos });
        }
        u.planEditado = true;
      });
      Modal.cerrar();
      UI.toast(id ? 'Límite actualizado' : 'Límite agregado');
      this.render();
    });

    document.getElementById('lim-borrar').addEventListener('click', () => {
      const id = this.editandoLimite;
      if (!id) return;
      Store.update(u => {
        u.limites = Plan.limites().filter(l => l.id !== id);
        u.planEditado = true;
      });
      Modal.cerrar();
      UI.toast('Límite eliminado');
      this.render();
    });

    /* ---- Usar lo que se detectó en los PDFs ---- */
    document.getElementById('mc-sugerencia').addEventListener('click', e => {
      if (!e.target.closest('#mc-usar-sugerido')) return;
      const s = Store.u.pautas.sugerido;
      if (!s) return;
      if (!confirm('¿Reemplazar tus comidas y límites por los que encontré en tus PDFs?')) return;
      Store.update(u => {
        if (s.comidas.length) u.comidasPlan = s.comidas;
        if (s.limites.length) u.limites = s.limites;
        u.pautas.sugerido.aplicado = true;
      });
      UI.toast('Listo, usé lo que indican tus pautas');
      this.render();
    });
  },

  abrirComida(id) {
    this.editandoComida = id;
    const c = id ? Plan.get(id) : { nombre: '', hora: '10:30', estilo: 'libre', guia: '' };
    if (!c) return;
    document.getElementById('dlg-plan-titulo').textContent = id ? 'Editar comida' : 'Nueva comida';
    document.getElementById('plan-nombre').value = c.nombre;
    document.getElementById('plan-hora').value = c.hora;
    document.getElementById('plan-estilo').value = c.estilo || 'libre';
    document.getElementById('plan-guia').value = c.guia || '';
    document.getElementById('plan-error').textContent = '';
    document.getElementById('plan-borrar').hidden = !id;
    Modal.abrir('dlg-plan', 'plan-nombre');
  },

  abrirLimite(id) {
    this.editandoLimite = id;
    const l = id ? Plan.limites().find(x => x.id === id) : { nombre: '', min: null, max: null, periodo: 'dia' };
    if (!l) return;
    document.getElementById('dlg-limite-titulo').textContent = id ? 'Editar límite' : 'Nuevo límite';
    document.getElementById('lim-nombre').value = l.nombre;
    document.getElementById('lim-min').value = l.min != null ? l.min : '';
    document.getElementById('lim-max').value = l.max != null ? l.max : '';
    document.getElementById('lim-periodo').value = l.periodo;
    document.getElementById('lim-error').textContent = '';
    document.getElementById('lim-borrar').hidden = !id;
    Modal.abrir('dlg-limite', 'lim-nombre');
  },

  render() {
    // Durante la configuración inicial se vuelve a las pautas; después, a Mi usuario
    document.querySelector('#screen-mis-comidas .topbar a').setAttribute('href', Store.u.onboarding ? '#perfil' : '#pautas');
    const chev = '<svg class="chev"><use href="#i-chevron"></use></svg>';
    document.getElementById('mc-comidas').innerHTML = Plan.comidas().map(c => `
      <button type="button" class="list-link" data-id="${UI.esc(c.id)}">
        <span><strong>${UI.esc(c.nombre)} · ${horaLinda(c.hora)}</strong>
        <small class="muted">${UI.esc(c.guia || 'Sin guía')}</small>
        <small class="muted">Evaluación: ${UI.esc(ESTILOS_CORTO[c.estilo] || ESTILOS_CORTO.libre)}</small></span>${chev}
      </button>`).join('');

    const lim = Plan.limites();
    const cajaLim = document.getElementById('mc-limites');
    cajaLim.innerHTML = lim.length ? lim.map(l => `
      <button type="button" class="list-link" data-id="${UI.esc(l.id)}">
        <span><strong>${UI.esc(l.nombre)}</strong><small class="muted">${Plan.objetivo(l).replace(/^de /, '').replace('/sem', '')} por ${l.periodo === 'semana' ? 'semana' : 'día'}</small></span>${chev}
      </button>`).join('') : '';
    cajaLim.hidden = !lim.length;

    // Sugerencia de los PDFs, si el usuario ya había editado a mano y no la usó
    const s = Store.u.pautas && Store.u.pautas.sugerido;
    const sug = document.getElementById('mc-sugerencia');
    const mostrar = s && !s.aplicado && Store.u.planEditado && (s.comidas.length || s.limites.length);
    sug.hidden = !mostrar;
    if (mostrar) {
      sug.innerHTML = `<strong>En tus PDFs encontré ${s.comidas.length} comidas y ${s.limites.length} límites.</strong>
        <span>${UI.esc(s.comidas.map(c => `${c.nombre} ${horaLinda(c.hora)}`).join(' · '))}</span>
        <button type="button" class="btn btn--primary btn--sm" id="mc-usar-sugerido">Usar estas</button>`;
    }
  }
};
