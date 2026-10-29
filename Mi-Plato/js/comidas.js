/* ==========================================================
   comidas.js — cargar una comida con foto y ver el análisis
   ========================================================== */

Screens.cargar = {
  foto: null,          // dataURL comprimida (1024 px)
  tipoElegido: null,   // lo puede setear "Hoy" al tocar una comida pendiente

  init() {
    const onFile = async e => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        this.foto = await Api.comprimirImagen(file, 1024, 0.8);
        this.pintarFoto();
      } catch (err) {
        UI.toast(err.message);
      }
    };
    document.getElementById('cargar-camara').addEventListener('change', onFile);
    document.getElementById('cargar-galeria').addEventListener('change', onFile);
    document.getElementById('cargar-desc').addEventListener('input', () => this.actualizarBoton());

    document.getElementById('cargar-tipo').addEventListener('click', e => {
      const b = e.target.closest('.chip');
      if (!b) return;
      this.tipoElegido = b.dataset.tipo;
      this.pintarTipos();
    });

    document.getElementById('cargar-analizar').addEventListener('click', () => {
      Screens.resultado.pendiente = {
        foto: this.foto,
        descripcion: document.getElementById('cargar-desc').value.trim(),
        tipo: this.tipoElegido,
        momento: document.querySelector('#screen-cargar input[name="momento"]:checked').value
      };
      UI.ir('resultado');
    });
  },

  reset() {
    this.foto = null;
    this.tipoElegido = null;
    document.getElementById('cargar-desc').value = '';
    document.querySelector('#screen-cargar input[value="antes"]').checked = true;
  },

  pintarFoto() {
    const img = document.getElementById('cargar-preview');
    img.hidden = !this.foto;
    if (this.foto) img.src = this.foto;
    document.getElementById('cargar-vacio').hidden = !!this.foto;
    this.actualizarBoton();
  },

  pintarTipos() {
    document.getElementById('cargar-tipo').innerHTML = TIPOS.map(t =>
      `<button type="button" class="chip" role="radio" data-tipo="${t.id}" aria-checked="${t.id === this.tipoElegido}">${t.nombre}</button>`
    ).join('');
  },

  actualizarBoton() {
    const desc = document.getElementById('cargar-desc').value.trim();
    document.getElementById('cargar-analizar').disabled = !this.foto && desc.length < 3;
  },

  render() {
    if (!this.tipoElegido) this.tipoElegido = tipoPorHora();
    this.pintarTipos();
    this.pintarFoto();
  }
};

/* ---------- Resultado del análisis ---------- */
const COLORES_PLATO = {
  vegetales: { color: 'var(--veg)', nombre: 'Vegetales' },
  proteina: { color: 'var(--prot)', nombre: 'Proteína' },
  carbohidratos: { color: 'var(--carb)', nombre: 'Cereal / hidratos' },
  otros: { color: 'var(--line-strong)', nombre: 'Otros' }
};

Screens.resultado = {
  pendiente: null,
  analisis: null,

  init() {
    document.getElementById('res-reintentar').addEventListener('click', () => this.render());
    document.getElementById('res-descartar').addEventListener('click', () => {
      this.pendiente = null;
      Screens.cargar.reset();
      UI.ir('cargar');
    });

    document.getElementById('res-guardar').addEventListener('click', async () => {
      const p = this.pendiente;
      if (!p || !this.analisis) return;
      const btn = document.getElementById('res-guardar');
      btn.disabled = true;
      const mini = p.foto ? await Api.miniatura(p.foto, 360) : null;
      const ok = Store.update(u => {
        u.comidas.push({
          id: UI.uid(),
          fecha: new Date().toISOString(),
          tipo: p.tipo,
          momento: p.momento,
          foto: mini,
          descripcion: p.descripcion,
          analisis: this.analisis
        });
      });
      btn.disabled = false;
      if (!ok) return;
      this.pendiente = null;
      Screens.cargar.reset();
      const r = Store.u.recordatorios;
      if (r.comidas && (p.tipo === 'almuerzo' || p.tipo === 'cena')) {
        Recordatorios.avisar('Comida guardada', 'Acordate de tomar un vaso de agua con la comida.');
      } else {
        UI.toast('Comida guardada');
      }
      UI.ir('hoy');
    });
  },

  async render() {
    const p = this.pendiente;
    if (!p) { UI.ir('cargar'); return; }

    const tipo = TIPOS.find(t => t.id === p.tipo);
    document.getElementById('res-contexto').textContent =
      `${tipo ? tipo.nombre : ''} · ${p.momento === 'antes' ? 'lo vas a comer' : 'ya lo comiste'}`;

    const cargando = document.getElementById('res-cargando');
    const error = document.getElementById('res-error-wrap');
    const contenido = document.getElementById('res-contenido');
    cargando.hidden = false; error.hidden = true; contenido.hidden = true;
    this.analisis = null;

    try {
      const a = await Api.analizarPlato(p);
      if (this.pendiente !== p) return; // el usuario se fue de la pantalla
      this.analisis = a;
      this.pintar(a, p);
      contenido.hidden = false;
    } catch (err) {
      document.getElementById('res-error').innerHTML = `<strong>No pude analizar el plato.</strong><br>${UI.esc(err.message)}`;
      error.hidden = false;
    } finally {
      cargando.hidden = true;
    }
  },

  pintar(a, p) {
    const ok = a.veredicto === 'ok';
    const foto = document.getElementById('res-foto');
    foto.hidden = !p.foto;
    if (p.foto) foto.src = p.foto;

    const badge = document.getElementById('res-badge');
    badge.className = 'badge ' + (ok ? 'badge--ok' : 'badge--warn');
    badge.innerHTML = `<svg><use href="#i-${ok ? 'check' : 'alert'}"></use></svg>${ok ? 'Va bien' : 'Ajustalo un poco'}`;
    document.getElementById('res-titulo').textContent = a.titulo || (ok ? 'Plato bien armado' : 'Se puede mejorar');

    // Distribución del plato (gráfico de torta con conic-gradient)
    const d = a.distribucion || {};
    const claves = Object.keys(COLORES_PLATO);
    const total = claves.reduce((n, k) => n + (Number(d[k]) || 0), 0) || 1;
    let acum = 0;
    const tramos = claves.filter(k => Number(d[k]) > 0).map(k => {
      const desde = acum;
      acum += (Number(d[k]) / total) * 100;
      return `${COLORES_PLATO[k].color} ${desde}% ${acum}%`;
    });
    const plato = document.getElementById('res-plato');
    plato.style.background = tramos.length ? `conic-gradient(${tramos.join(', ')})` : '';
    plato.setAttribute('aria-label', 'Distribución del plato: ' +
      claves.filter(k => Number(d[k]) > 0).map(k => `${COLORES_PLATO[k].nombre} ${Math.round(d[k] / total * 100)}%`).join(', '));
    document.getElementById('res-dist').innerHTML =
      '<span class="small strong muted">Distribución detectada</span>' +
      claves.filter(k => Number(d[k]) > 0).map(k => `
        <div class="legend"><i style="background:${COLORES_PLATO[k].color}"></i><span>${COLORES_PLATO[k].nombre}</span><b>${Math.round(d[k] / total * 100)}%</b></div>`
      ).join('');

    // Problemas
    const probs = Array.isArray(a.problemas) ? a.problemas : [];
    const cajaProbs = document.getElementById('res-problemas');
    cajaProbs.hidden = probs.length === 0;
    cajaProbs.innerHTML = probs.map((x, i) => `
      <div class="problem"><span class="problem-num">${i + 1}</span>
        <div><strong>${UI.esc(x.titulo)}</strong><span>${UI.esc(x.detalle)}</span></div></div>`).join('');

    // Ítems detectados
    document.getElementById('res-items').innerHTML = (a.items || []).map(i => `
      <li class="list-item"><span>${UI.esc(i.nombre)}${i.nota ? `<br><small class="muted">${UI.esc(i.nota)}</small>` : ''}</span>
      <span class="tag ${i.ok ? 'tag--ok' : 'tag--warn'}">${i.ok ? 'OK' : 'Revisar'}</span></li>`).join('');

    const sug = document.getElementById('res-sugerencia');
    sug.hidden = !a.sugerencia;
    sug.innerHTML = a.sugerencia ? `<strong>Probá así:</strong> ${UI.esc(a.sugerencia)}` : '';
    const con = document.getElementById('res-consejo');
    con.hidden = !a.consejo;
    con.textContent = a.consejo || '';

    document.getElementById('res-guardar').textContent = ok ? 'Guardar' : 'Guardar igual';
  }
};
