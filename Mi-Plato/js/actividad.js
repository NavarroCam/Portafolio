/* ==========================================================
   actividad.js — actividad física: cada entrenamiento con su día,
   tipo (gym, natación, caminata...), minutos y una nota.
   u.entrenos = [{ id, fecha: 'AAAA-MM-DD', tipo, minutos, nota }]
   (antes era u.actividad = { 'AAAA-MM-DD': cantidad }: se migra solo)
   ========================================================== */

const TIPOS_ACTIVIDAD = ['Gym', 'Caminata', 'Natación', 'Running', 'Bici', 'Yoga', 'Baile', 'Otro'];

const Actividad = {
  lista() { return (Store.u && Store.u.entrenos) || []; },
  delDia(clave) { return this.lista().filter(e => e.fecha === clave); },

  /** "Natación · 45 min" */
  texto(e) {
    return [e.tipo || 'Entrenamiento', e.minutos ? `${e.minutos} min` : ''].filter(Boolean).join(' · ');
  },

  /** Usuarios de antes: pasa el contador por día a entrenamientos sueltos */
  migrar() {
    const u = Store.u;
    if (!u || Array.isArray(u.entrenos)) return;
    Store.update(x => {
      x.entrenos = [];
      Object.entries(x.actividad || {}).forEach(([fecha, n]) => {
        for (let i = 0; i < (Number(n) || 0); i++) x.entrenos.push({ id: UI.uid(), fecha, tipo: '', minutos: null, nota: '' });
      });
    });
  },

  /* ---------- Ventana para agregar o editar ---------- */
  editando: null,
  tipo: '',

  abrir(id, fechaPorDefecto) {
    const e = id ? this.lista().find(x => x.id === id) : null;
    this.editando = e ? e.id : null;
    this.tipo = e ? e.tipo : '';
    document.getElementById('dlg-actividad-titulo').textContent = e ? 'Editar actividad' : 'Registrar actividad';
    document.getElementById('act-fecha').value = e ? e.fecha : (fechaPorDefecto || Fechas.clave());
    document.getElementById('act-fecha').max = Fechas.clave();
    document.getElementById('act-minutos').value = e && e.minutos ? e.minutos : '';
    document.getElementById('act-nota').value = e ? e.nota || '' : '';
    // Si el tipo guardado no es uno de los botones, va como "Otro" con su texto
    const conocido = !this.tipo || TIPOS_ACTIVIDAD.includes(this.tipo);
    document.getElementById('act-otro').value = conocido ? '' : this.tipo;
    if (!conocido) this.tipo = 'Otro';
    document.getElementById('act-borrar').hidden = !e;
    document.getElementById('act-error').textContent = '';
    this.pintarTipos();
    Modal.abrir('dlg-actividad');
  },

  pintarTipos() {
    document.getElementById('act-tipos').innerHTML = TIPOS_ACTIVIDAD.map(t =>
      `<button type="button" class="chip" role="radio" data-tipo="${t}" aria-checked="${t === this.tipo}">${t}</button>`).join('');
    document.getElementById('act-otro-wrap').hidden = this.tipo !== 'Otro';
  },

  guardar() {
    const fecha = document.getElementById('act-fecha').value;
    const err = document.getElementById('act-error');
    if (!fecha) { err.textContent = 'Elegí el día.'; return; }
    if (fecha > Fechas.clave()) { err.textContent = 'No se puede registrar un día que todavía no pasó.'; return; }
    if (!this.tipo) { err.textContent = 'Elegí qué actividad hiciste.'; return; }
    const otro = document.getElementById('act-otro').value.trim();
    const tipo = this.tipo === 'Otro' && otro ? otro.slice(0, 30) : this.tipo;
    const min = parseInt(document.getElementById('act-minutos').value, 10);
    const datos = {
      fecha, tipo,
      minutos: Number.isFinite(min) && min > 0 ? Math.min(min, 600) : null,
      nota: document.getElementById('act-nota').value.trim().slice(0, 140)
    };
    const nuevo = !this.editando;
    Store.update(u => {
      if (!Array.isArray(u.entrenos)) u.entrenos = [];
      if (nuevo) u.entrenos.push({ id: UI.uid(), ...datos });
      else Object.assign(u.entrenos.find(e => e.id === this.editando) || {}, datos);
      u.entrenos.sort((a, b) => a.fecha.localeCompare(b.fecha));
    });
    Modal.cerrar();
    UI.toast(nuevo ? `${tipo} registrado. ¡Bien ahí!` : 'Actividad actualizada');
    UI.route();
  },

  borrar() {
    const id = this.editando;
    Store.update(u => { u.entrenos = (u.entrenos || []).filter(e => e.id !== id); });
    Modal.cerrar();
    UI.toast('Actividad borrada');
    UI.route();
  },

  init() {
    document.getElementById('act-tipos').addEventListener('click', e => {
      const b = e.target.closest('.chip');
      if (!b) return;
      this.tipo = b.dataset.tipo;
      this.pintarTipos();
      if (this.tipo === 'Otro') document.getElementById('act-otro').focus();
    });
    document.getElementById('form-actividad').addEventListener('submit', e => { e.preventDefault(); this.guardar(); });
    document.getElementById('act-borrar').addEventListener('click', () => this.borrar());
  }
};
