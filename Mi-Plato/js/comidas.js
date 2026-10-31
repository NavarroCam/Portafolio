/* ==========================================================
   comidas.js — cargar una comida con foto y ver el análisis
   ========================================================== */

const EXTRA = 'extra';
const hhmm = (d = new Date()) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/* Cámara a pantalla completa:
   - en el celular se abre la cámara dentro de la app (si el navegador lo permite);
     si no, el botón redondo abre la cámara del sistema.
   - en la compu se arrastra una foto o se elige un archivo. */
Screens.cargar = {
  foto: null,          // dataURL comprimida (1024 px)
  tipoElegido: null,   // lo puede setear "Hoy" al tocar una comida pendiente
  hora: null,          // 'HH:MM' elegida (por defecto, la hora actual)
  nombreExtra: '',     // nombre de una comida extra (colación, postre...)
  modo: 'camara',      // 'camara' | 'revisar' | 'describir'
  stream: null,

  init() {
    const onFile = async e => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        this.foto = await Api.comprimirImagen(file, 1024, 0.8);
        this.apagarCamara();
        this.modo = 'revisar';
        this.pintar();
      } catch (err) {
        UI.toast(err.message);
      }
    };
    document.getElementById('cargar-camara').addEventListener('change', onFile);
    document.getElementById('cargar-galeria').addEventListener('change', onFile);
    // En la compu: arrastrar y soltar una foto
    const visor = document.getElementById('screen-cargar');
    visor.addEventListener('dragover', e => { e.preventDefault(); visor.classList.add('arrastrando'); });
    visor.addEventListener('dragleave', e => { if (e.target === visor) visor.classList.remove('arrastrando'); });
    visor.addEventListener('drop', e => {
      e.preventDefault();
      visor.classList.remove('arrastrando');
      const file = [...(e.dataTransfer.files || [])].find(f => f.type.startsWith('image/'));
      if (file) onFile({ target: { files: [file], value: '' } });
      else UI.toast('Soltá una imagen (JPG o PNG).');
    });

    document.getElementById('cargar-disparar').addEventListener('click', () => this.disparar());
    document.getElementById('cargar-cerrar').addEventListener('click', () => this.reset());
    const lateral = document.querySelector('#tabbar .tabbar-cta');
    if (lateral) lateral.addEventListener('click', () => { if (UI.actual !== 'cargar') this.reset(); });
    document.getElementById('cargar-describir').addEventListener('click', () => {
      this.apagarCamara();
      this.modo = 'describir';
      this.pintar();
      setTimeout(() => document.getElementById('cargar-desc').focus(), 50);
    });
    document.getElementById('cargar-repetir').addEventListener('click', () => this.volverACamara());
    document.getElementById('cargar-a-camara').addEventListener('click', () => this.volverACamara());
    document.getElementById('cargar-desc').addEventListener('input', () => this.actualizarBoton());

    // "Lo voy a comer" / "Ya lo comí": botón arriba (cámara) y opciones en el panel
    document.getElementById('cargar-momento').addEventListener('click', () => {
      const ahora = this.momento() === 'antes' ? 'despues' : 'antes';
      document.querySelector(`#screen-cargar input[value="${ahora}"]`).checked = true;
      this.pintarTop();
    });
    document.querySelectorAll('#screen-cargar input[name="momento"]').forEach(r => r.addEventListener('change', () => this.pintarTop()));

    // Elegir comida, hora y extra
    document.getElementById('cargar-elegir').addEventListener('click', () => this.abrirElegir());
    document.getElementById('cargar-tipos').addEventListener('click', e => {
      const b = e.target.closest('.chip');
      if (!b) return;
      this.tipoDialogo = b.dataset.tipo;
      this.pintarElegir();
    });
    document.getElementById('form-cargar-comida').addEventListener('submit', e => {
      e.preventDefault();
      this.tipoElegido = this.tipoDialogo;
      this.hora = document.getElementById('cargar-hora').value || hhmm();
      this.nombreExtra = this.tipoElegido === EXTRA ? document.getElementById('cargar-extra').value.trim() : '';
      Modal.cerrar();
      this.pintarTop();
    });

    document.getElementById('cargar-analizar').addEventListener('click', () => {
      if (Demo.activo && !Demo.puedeAnalizar(this.foto)) return;
      Screens.resultado.pendiente = {
        foto: this.modo === 'describir' ? null : this.foto,
        descripcion: document.getElementById('cargar-desc').value.trim(),
        tipo: this.tipoElegido,
        nombreExtra: this.nombreExtra,
        hora: this.hora,
        momento: this.momento()
      };
      UI.ir('resultado');
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.apagarCamara();
      else if (UI.actual === 'cargar' && this.modo === 'camara') this.prenderCamara();
    });
  },

  momento() {
    const r = document.querySelector('#screen-cargar input[name="momento"]:checked');
    return r ? r.value : 'antes';
  },

  /** Nombre visible de la comida elegida */
  nombreElegido() {
    if (this.tipoElegido === EXTRA) return this.nombreExtra || 'Comida extra';
    return Plan.nombre(this.tipoElegido);
  },

  reset() {
    this.foto = null;
    this.tipoElegido = null;
    this.hora = null;
    this.nombreExtra = '';
    this.modo = 'camara';
    document.getElementById('cargar-desc').value = '';
    document.querySelector('#screen-cargar input[value="antes"]').checked = true;
  },

  /* ---------- Cámara dentro de la app ---------- */
  usaCamaraPropia() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) &&
      window.matchMedia('(pointer: coarse)').matches && !this.camaraFallo;
  },

  async prenderCamara() {
    if (this.stream || !this.usaCamaraPropia()) { this.pintar(); return; }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1920 } }, audio: false
      });
      // Si mientras pedía permiso el usuario se fue de la pantalla, la apagamos
      if (UI.actual !== 'cargar' || this.modo !== 'camara') { this.apagarCamara(); return; }
      const v = document.getElementById('cargar-video');
      v.srcObject = this.stream;
      await v.play().catch(() => {});
    } catch (e) {
      this.camaraFallo = true; // sin permiso: usamos la cámara del sistema
      this.stream = null;
    }
    this.pintar();
  },

  apagarCamara() {
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    this.stream = null;
    const v = document.getElementById('cargar-video');
    if (v) v.srcObject = null;
  },

  disparar() {
    const v = document.getElementById('cargar-video');
    if (this.stream && v.videoWidth) {
      const escala = Math.min(1, 1024 / Math.max(v.videoWidth, v.videoHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(v.videoWidth * escala);
      c.height = Math.round(v.videoHeight * escala);
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      this.foto = c.toDataURL('image/jpeg', 0.8);
      this.apagarCamara();
      this.modo = 'revisar';
      this.pintar();
      return;
    }
    // Sin cámara propia: celular → cámara del sistema; compu → elegir archivo
    document.getElementById(window.matchMedia('(pointer: coarse)').matches ? 'cargar-camara' : 'cargar-galeria').click();
  },

  volverACamara() {
    this.foto = null;
    this.modo = 'camara';
    this.pintar();
    this.prenderCamara();
  },

  /** Al salir de la pantalla apagamos la cámara */
  salir() { this.apagarCamara(); },

  /* ---------- Dibujo ---------- */
  pintarTop() {
    const nombre = this.nombreElegido();
    document.getElementById('cargar-elegir-txt').textContent = `${nombre} · ${horaLinda(this.hora)}`;
    document.getElementById('cargar-elegir').setAttribute('aria-label', `${nombre} a las ${horaLinda(this.hora)}. Tocá para cambiar la comida o la hora`);
    document.getElementById('cargar-momento').textContent = this.momento() === 'antes' ? 'Lo voy a comer' : 'Ya lo comí';
  },

  pintar() {
    const m = this.modo;
    const scr = document.getElementById('screen-cargar');
    scr.dataset.modo = m;
    const video = document.getElementById('cargar-video');
    const img = document.getElementById('cargar-preview');
    video.hidden = !(m === 'camara' && this.stream);
    img.hidden = !(m === 'revisar' && this.foto);
    if (this.foto) img.src = this.foto;
    document.getElementById('cargar-vacio').hidden = !(m === 'camara' && !this.stream);
    document.getElementById('cargar-guia').hidden = m !== 'camara';
    document.getElementById('cargar-hint').hidden = m !== 'camara';
    document.getElementById('cargar-barra').hidden = m !== 'camara';
    document.getElementById('cargar-panel').hidden = m === 'camara';
    document.getElementById('cargar-cerrar').hidden = m === 'revisar';
    document.getElementById('cargar-repetir').hidden = m !== 'revisar';
    document.getElementById('cargar-momento').hidden = m !== 'camara';
    document.getElementById('cargar-a-camara').hidden = m !== 'describir';
    document.getElementById('cargar-panel-titulo').textContent = m === 'describir' ? 'Contame qué comiste' : '¡Buena foto!';
    document.getElementById('cargar-desc-label').innerHTML = m === 'describir'
      ? '¿Qué tenía el plato? <span class="muted">(sumá cantidades si podés)</span>'
      : '¿Querés aclarar algo? <span class="muted">(opcional)</span>';
    document.getElementById('cargar-desc').rows = m === 'describir' ? 4 : 2;
    document.getElementById('cargar-desc').placeholder = m === 'describir'
      ? 'Ej.: una porción de tarta de verdura con ensalada de tomate'
      : 'Ej.: la carne es peceto al horno';
    this.pintarTop();
    this.actualizarBoton();
  },

  abrirElegir() {
    this.tipoDialogo = this.tipoElegido;
    document.getElementById('cargar-hora').value = this.hora;
    document.getElementById('cargar-extra').value = this.nombreExtra;
    this.pintarElegir();
    Modal.abrir('dlg-cargar');
  },

  pintarElegir() {
    const opciones = [...Plan.comidas(), { id: EXTRA, nombre: 'Extra' }];
    document.getElementById('cargar-tipos').innerHTML = opciones.map(t =>
      `<button type="button" class="chip" role="radio" data-tipo="${UI.esc(t.id)}" aria-checked="${t.id === this.tipoDialogo}">${t.id === EXTRA ? '<svg><use href="#i-plus"></use></svg>' : ''}${UI.esc(t.nombre)}</button>`
    ).join('');
    const extra = this.tipoDialogo === EXTRA;
    document.getElementById('cargar-extra-wrap').hidden = !extra;
    const c = Plan.get(this.tipoDialogo);
    document.getElementById('cargar-hora-plan').textContent = extra
      ? 'Una comida fuera de tu plan: colación, postre, algo que picaste…'
      : c ? `En tu plan: ${horaLinda(c.hora)}${c.guia ? ' · ' + c.guia : ''}` : '';
  },

  actualizarBoton() {
    const desc = document.getElementById('cargar-desc').value.trim();
    document.getElementById('cargar-analizar').disabled = this.modo === 'describir' ? desc.length < 3 : !this.foto;
  },

  render() {
    if (!this.tipoElegido || (this.tipoElegido !== EXTRA && !Plan.get(this.tipoElegido))) this.tipoElegido = Plan.porHora();
    if (!this.hora) this.hora = hhmm();
    if (this.modo === 'revisar' && !this.foto) this.modo = 'camara';
    this.pintar();
    if (this.modo === 'camara') this.prenderCamara();
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
      const fotoId = mini ? await Fotos.guardar(mini) : null;
      const fecha = new Date();
      if (p.hora) { const [h, m] = p.hora.split(':').map(Number); fecha.setHours(h, m, 0, 0); }
      if (Demo.activo) { Demo.guardarComida(p, this.analisis, fecha); btn.disabled = false; return; }
      const ok = Store.update(u => {
        u.comidas.push({
          id: UI.uid(),
          fecha: fecha.toISOString(),
          tipo: p.tipo,
          nombreComida: p.tipo === EXTRA ? (p.nombreExtra || 'Extra') : Plan.nombre(p.tipo),
          momento: p.momento,
          fotoId,
          descripcion: p.descripcion,
          analisis: this.analisis
        });
        u.comidas.sort((a, b) => a.fecha.localeCompare(b.fecha));
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

    const nombre = p.tipo === EXTRA ? (p.nombreExtra || 'Comida extra') : Plan.nombre(p.tipo);
    document.getElementById('res-contexto').textContent =
      `${nombre} · ${p.momento === 'antes' ? 'lo vas a comer' : 'ya lo comiste'}`;

    const cargando = document.getElementById('res-cargando');
    const error = document.getElementById('res-error-wrap');
    const contenido = document.getElementById('res-contenido');
    cargando.hidden = false; error.hidden = true; contenido.hidden = true;
    this.analisis = null;

    try {
      const a = p.demoAnalisis
        ? await new Promise(r => setTimeout(() => r(JSON.parse(JSON.stringify(p.demoAnalisis))), 900))
        : await Api.analizarPlato(p);
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
