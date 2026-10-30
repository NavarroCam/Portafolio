/* ==========================================================
   hoy.js — pantalla "Hoy", agua y recordatorios
   ========================================================== */

const TIPOS = [
  { id: 'desayuno', nombre: 'Desayuno', hora: '08:00', guia: 'Infusión + 1 hidrato + 1 proteína + 1 fibra' },
  { id: 'almuerzo', nombre: 'Almuerzo', hora: '13:00', guia: '½ vegetales · ¼ proteína · ¼ cereal' },
  { id: 'merienda', nombre: 'Merienda', hora: '17:00', guia: 'Infusión + 1 hidrato + 1 proteína + 1 fibra' },
  { id: 'cena', nombre: 'Cena', hora: '21:00', guia: '½ vegetales · ¼ proteína · ¼ cereal' }
];

/** Horario de cada comida ('HH:MM'): el que eligió el usuario o el de fábrica */
function horaDe(tipo) {
  const propios = (Store.u && Store.u.horarios) || {};
  return propios[tipo] || TIPOS.find(t => t.id === tipo).hora;
}
const aMinutos = hhmm => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + (m || 0); };
const horaLinda = hhmm => { const [h, m] = String(hhmm).split(':'); return `${Number(h)}:${m}`; };

/** Tipo de comida sugerido según la hora: el horario más cercano */
function tipoPorHora(d = new Date()) {
  const ahora = d.getHours() * 60 + d.getMinutes();
  let mejor = TIPOS[0].id, dist = Infinity;
  for (const t of TIPOS) {
    const x = Math.abs(aMinutos(horaDe(t.id)) - ahora);
    const diff = Math.min(x, 1440 - x);
    if (diff < dist) { dist = diff; mejor = t.id; }
  }
  return mejor;
}

/** Comidas guardadas de un día (clave AAAA-MM-DD) */
function comidasDelDia(clave) {
  return Store.u.comidas.filter(c => Fechas.clave(new Date(c.fecha)) === clave);
}

/* ---------- Agua ---------- */
const META_AGUA = 2000;
const VASO = 250;

const Agua = {
  hoy() { return Store.u.agua[Fechas.clave()] || 0; },
  /** Guarda el total del día. Devuelve true si con esto se llegó a la meta */
  set(ml) {
    const antes = this.hoy();
    const clave = Fechas.clave();
    Store.update(u => { u.agua[clave] = Math.max(0, Math.min(ml, 5000)); });
    // Cada vez que se pasa de menos de 2 L a 2 L o más, festejamos
    // (igual desde "Hoy" que desde "Agua")
    if (antes < META_AGUA && this.hoy() >= META_AGUA) {
      Festejo.mostrar();
      return true;
    }
    return false;
  },
  sumar(ml) {
    if (!this.set(this.hoy() + ml)) UI.toast(`+${ml} ml · llevás ${UI.litros(this.hoy())}`);
  },
  /** Días seguidos (hasta hoy) con 2 L */
  racha() {
    let n = 0;
    let d = new Date();
    while ((Store.u.agua[Fechas.clave(d)] || 0) >= META_AGUA) { n++; d = Fechas.sumarDias(d, -1); }
    return n;
  },
  faltanVasos() { return Math.max(0, Math.ceil((META_AGUA - this.hoy()) / VASO)); }
};

/* ---------- Festejo al llegar a los 2 L: mensaje + confeti ---------- */
const Festejo = {
  mostrar() {
    const modal = document.getElementById('festejo');
    const u = Store.u;
    const racha = Agua.racha();
    const quien = nombreCorto();
    document.getElementById('festejo-titulo').textContent = `¡Llegaste a los 2 litros${quien ? ', ' + quien : ''}!`;
    document.getElementById('festejo-texto').textContent = racha > 1
      ? `Llevás ${racha} días seguidos cumpliendo la meta de agua. ¡Seguí así!`
      : 'Cumpliste la meta de agua de hoy. Tu cuerpo te lo agradece.';
    this.anterior = document.activeElement;
    modal.hidden = false;
    document.getElementById('festejo-ok').focus();
    if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) this.confeti();
  },

  cerrar() {
    document.getElementById('festejo').hidden = true;
    if (this.anterior && this.anterior.focus) this.anterior.focus();
  },

  init() {
    document.getElementById('festejo-ok').addEventListener('click', () => this.cerrar());
    document.getElementById('festejo').addEventListener('click', e => { if (e.target.id === 'festejo') this.cerrar(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !document.getElementById('festejo').hidden) this.cerrar();
    });
  },

  /** Confeti con canvas, sin librerías */
  confeti(duracion = 3200) {
    const c = document.createElement('canvas');
    c.className = 'confeti';
    c.setAttribute('aria-hidden', 'true');
    document.body.appendChild(c);
    const ctx = c.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const ajustar = () => {
      c.width = innerWidth * dpr; c.height = innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    ajustar();
    window.addEventListener('resize', ajustar);

    const colores = ['#2F6B4F', '#7FC29B', '#1F5FA8', '#9CC3F0', '#C9A227', '#B5541C', '#F0A673'];
    const W = innerWidth, H = innerHeight;
    // Dos "cañones" desde abajo a los costados + una lluvia desde arriba
    const piezas = [];
    const crear = (x, y, vx, vy) => piezas.push({
      x, y, vx, vy,
      w: 6 + Math.random() * 6, h: 8 + Math.random() * 8,
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      color: colores[(Math.random() * colores.length) | 0],
      forma: Math.random() < 0.3 ? 'circulo' : 'papel',
      osc: Math.random() * Math.PI * 2
    });
    for (let i = 0; i < 70; i++) {
      crear(0, H * 0.75, 4 + Math.random() * 8, -(10 + Math.random() * 9));
      crear(W, H * 0.75, -(4 + Math.random() * 8), -(10 + Math.random() * 9));
    }
    for (let i = 0; i < 60; i++) crear(Math.random() * W, -20 - Math.random() * H * 0.5, (Math.random() - 0.5) * 2, 2 + Math.random() * 3);

    const inicio = performance.now();
    const cuadro = ahora => {
      const t = ahora - inicio;
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = t > duracion - 600 ? Math.max(0, (duracion - t) / 600) : 1;
      for (const p of piezas) {
        p.vy += 0.28;            // gravedad
        p.vx *= 0.985;           // rozamiento del aire
        p.vy = Math.min(p.vy, 6);
        p.osc += 0.1;
        p.x += p.vx + Math.sin(p.osc) * 0.6;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.forma === 'circulo') { ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2); ctx.fill(); }
        else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.osc)) + 2);
        ctx.restore();
      }
      if (t < duracion) requestAnimationFrame(cuadro);
      else { window.removeEventListener('resize', ajustar); c.remove(); }
    };
    requestAnimationFrame(cuadro);
  }
};

/* ---------- Recordatorios (mientras la app está abierta) ---------- */
const Recordatorios = {
  ultimo: null,

  async pedirPermiso() {
    if (!('Notification' in window)) return 'no-soportado';
    if (Notification.permission === 'default') return Notification.requestPermission();
    return Notification.permission;
  },

  avisar(titulo, cuerpo) {
    UI.toast(titulo + ' · ' + cuerpo, 5000);
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification(titulo, { body: cuerpo, tag: 'agua' }); } catch (e) { /* algunos celulares no lo permiten fuera de un service worker */ }
    }
  },

  revisar() {
    const u = Store.u;
    if (!u || !u.onboarding) return;
    const r = u.recordatorios;
    const ahora = new Date();
    const h = ahora.getHours();
    const marca = Fechas.clave(ahora) + '-' + h;
    if (this.ultimo === marca) return;

    const total = Agua.hoy();
    if (r.atrasada && h === 18 && total < 1000) {
      this.ultimo = marca;
      this.avisar('Vas atrasada con el agua', `Llevás ${UI.litros(total)}. Te faltan ${Agua.faltanVasos()} vasos.`);
      return;
    }
    if (r.cada2 && h >= 9 && h <= 21 && (h - 9) % 2 === 0 && total < META_AGUA) {
      this.ultimo = marca;
      this.avisar('Hora de un vaso de agua', `Vas ${UI.litros(total)} de 2 L · te faltan ${Agua.faltanVasos()}`);
    }
  },

  iniciar() {
    setInterval(() => this.revisar(), 60 * 1000);
    this.revisar();
  }
};

/* ---------- Editar horarios y la hora de una comida ---------- */
const Horarios = {
  init() {
    // Horarios de las 4 comidas
    document.getElementById('dlg-horarios-campos').innerHTML = TIPOS.map(t => `
      <div class="field"><label for="hora-${t.id}">${t.nombre}</label>
        <input id="hora-${t.id}" name="${t.id}" type="time" required></div>`).join('');
    document.getElementById('form-horarios').addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      Store.update(u => { u.horarios = Object.fromEntries(TIPOS.map(t => [t.id, f[t.id].value || t.hora])); });
      Modal.cerrar();
      UI.toast('Horarios guardados');
      UI.route();
    });
    document.getElementById('horarios-reset').addEventListener('click', () => {
      TIPOS.forEach(t => { document.getElementById('hora-' + t.id).value = t.hora; });
    });

    // Hora de una comida ya cargada
    document.getElementById('form-hora-comida').addEventListener('submit', e => {
      e.preventDefault();
      const hhmm = document.getElementById('hora-comida').value;
      const tipo = document.getElementById('tipo-comida').value;
      if (!hhmm) return;
      Store.update(u => {
        const c = u.comidas.find(x => x.id === this.comidaId);
        if (!c) return;
        const d = new Date(c.fecha);
        const [h, m] = hhmm.split(':').map(Number);
        d.setHours(h, m, 0, 0);
        c.fecha = d.toISOString();
        c.tipo = tipo;
        u.comidas.sort((a, b) => a.fecha.localeCompare(b.fecha));
      });
      Modal.cerrar();
      UI.toast('Comida actualizada');
      UI.route();
    });
    document.getElementById('tipo-comida').innerHTML = TIPOS.map(t => `<option value="${t.id}">${t.nombre}</option>`).join('');
  },

  abrirHorarios() {
    TIPOS.forEach(t => { document.getElementById('hora-' + t.id).value = horaDe(t.id); });
    Modal.abrir('dlg-horarios', 'hora-desayuno');
  },

  abrirComida(id) {
    const c = Store.u.comidas.find(x => x.id === id);
    if (!c) return;
    this.comidaId = id;
    const d = new Date(c.fecha);
    document.getElementById('hora-comida').value = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    document.getElementById('tipo-comida').value = c.tipo;
    Modal.abrir('dlg-comida', 'hora-comida');
  }
};

/* Ventanas emergentes simples (una a la vez) */
const Modal = {
  abierto: null,
  abrir(id, foco) {
    this.anterior = document.activeElement;
    this.abierto = document.getElementById(id);
    this.abierto.hidden = false;
    const f = foco && document.getElementById(foco);
    if (f) setTimeout(() => f.focus(), 50);
  },
  cerrar() {
    if (!this.abierto) return;
    this.abierto.hidden = true;
    this.abierto = null;
    if (this.anterior && this.anterior.focus) this.anterior.focus();
  },
  init() {
    document.querySelectorAll('.modal').forEach(m => {
      m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-cerrar]')) this.cerrar(); });
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') this.cerrar(); });
  }
};

/* ---------- Pantalla Hoy ---------- */
Screens.hoy = {
  init() {
    document.getElementById('hoy-editar-horarios').addEventListener('click', () => Horarios.abrirHorarios());
    document.getElementById('hoy-comidas').addEventListener('click', e => {
      const b = e.target.closest('[data-comida]');
      if (b) Horarios.abrirComida(b.dataset.comida);
    });
    document.getElementById('hoy-agua-mas').addEventListener('click', () => {
      Agua.sumar(VASO);
      this.render();
    });
  },

  render() {
    const u = Store.u;
    const hoy = new Date();
    document.getElementById('hoy-fecha').textContent = Fechas.largo(hoy);
    document.getElementById('hoy-saludo').textContent = nombreCorto() ? 'Hola, ' + nombreCorto() : 'Hola';

    // Agua
    const ml = Agua.hoy();
    document.getElementById('hoy-agua').textContent = UI.litros(ml);
    document.getElementById('hoy-agua-bar').style.width = Math.min(100, ml / META_AGUA * 100) + '%';
    document.getElementById('hoy-agua-texto').textContent = ml >= META_AGUA
      ? '¡Meta cumplida!'
      : `Te faltan ${Agua.faltanVasos()} vasos`;

    // Comidas
    const delDia = comidasDelDia(Fechas.clave(hoy));
    document.getElementById('hoy-comidas').innerHTML = TIPOS.map(t => {
      const c = delDia.filter(x => x.tipo === t.id).pop();
      if (!c) {
        return `
          <a class="meal meal--pending" href="#cargar" data-tipo="${t.id}">
            <span class="meal-ico meal-ico--pending"><svg><use href="#i-clock"></use></svg></span>
            <span class="meal-body"><strong>${t.nombre} · ${horaLinda(horaDe(t.id))}</strong><span>${t.guia}</span></span>
            <span class="meal-action">Cargar</span>
          </a>`;
      }
      const ok = c.analisis && c.analisis.veredicto === 'ok';
      const nombres = c.analisis && c.analisis.items ? c.analisis.items.map(i => i.nombre).join(', ') : (c.descripcion || '');
      return `
        <button type="button" class="meal meal--btn" data-comida="${c.id}" aria-label="${t.nombre} a las ${Fechas.hora(c.fecha)}. Tocá para cambiar la hora">
          <span class="meal-ico ${ok ? 'meal-ico--ok' : 'meal-ico--warn'}">
            ${fotoDe(c) ? `<img src="${fotoDe(c)}" alt="">` : `<svg><use href="#i-${ok ? 'check' : 'alert'}"></use></svg>`}
          </span>
          <span class="meal-body"><strong>${t.nombre} · ${Fechas.hora(c.fecha)}</strong><span>${UI.esc(nombres)}</span></span>
          <span class="tag ${ok ? 'tag--ok' : 'tag--warn'}">${ok ? 'Va bien' : 'Ajustar'}</span>
        </button>`;
    }).join('');

    document.querySelectorAll('#hoy-comidas a[data-tipo]').forEach(a => {
      a.addEventListener('click', () => { Screens.cargar.tipoElegido = a.dataset.tipo; });
    });

    // Contadores del día (salen del análisis de cada comida)
    const sum = k => delDia.reduce((n, c) => n + ((c.analisis && c.analisis.conteos && Number(c.analisis.conteos[k])) || 0), 0);
    const lunes = Fechas.lunes(hoy);
    const tuberculosSemana = Store.u.comidas
      .filter(c => new Date(c.fecha) >= lunes)
      .reduce((n, c) => n + ((c.analisis && c.analisis.conteos && Number(c.analisis.conteos.tuberculos)) || 0), 0);
    document.getElementById('hoy-contadores').innerHTML = `
      <div class="mini-card stat"><span>Frutas</span><strong>${sum('frutas')} <small>de 3–4</small></strong></div>
      <div class="mini-card stat"><span>Huevo</span><strong>${sum('huevos')} <small>máx. 1</small></strong></div>
      <div class="mini-card stat"><span>Papa/choclo</span><strong>${tuberculosSemana} <small>de 2/sem</small></strong></div>`;
  }
};

/* ---------- Pantalla Agua ---------- */
Screens.agua = {
  init() {
    document.getElementById('agua-vasos').addEventListener('click', e => {
      const b = e.target.closest('.glass');
      if (!b) return;
      const i = Number(b.dataset.i);
      const lleno = (i + 1) * VASO;
      // Tocar el último vaso lleno lo vacía; si no, llena hasta ese vaso
      Agua.set(Agua.hoy() === lleno ? i * VASO : lleno);
      this.render();
    });

    document.querySelectorAll('#screen-agua [data-ml]').forEach(b => {
      b.addEventListener('click', () => { Agua.sumar(Number(b.dataset.ml)); this.render(); });
    });

    const map = { 'rec-cada2': 'cada2', 'rec-comidas': 'comidas', 'rec-atrasada': 'atrasada' };
    Object.entries(map).forEach(([id, key]) => {
      document.getElementById(id).addEventListener('change', async e => {
        const on = e.target.checked;
        Store.update(u => { u.recordatorios[key] = on; });
        if (on && key !== 'comidas') {
          const p = await Recordatorios.pedirPermiso();
          this.textoPermiso(p);
        }
      });
    });
  },

  textoPermiso(p) {
    const el = document.getElementById('agua-permiso');
    const estado = p || ('Notification' in window ? Notification.permission : 'no-soportado');
    if (estado === 'granted') el.textContent = 'Los avisos llegan mientras la app esté abierta (también en otra pestaña).';
    else if (estado === 'denied') el.textContent = 'Bloqueaste las notificaciones del navegador. Igual te avisamos dentro de la app.';
    else if (estado === 'no-soportado') el.textContent = 'Tu navegador no soporta notificaciones: te avisamos dentro de la app.';
    else el.textContent = 'Al activar un recordatorio te vamos a pedir permiso para mandarte notificaciones.';
  },

  render() {
    const ml = Agua.hoy();
    document.getElementById('agua-total').textContent = UI.litros(ml);
    const llenos = Math.floor(ml / VASO);
    document.getElementById('agua-vasos').innerHTML = Array.from({ length: 8 }, (_, i) =>
      `<button type="button" class="glass ${i < llenos ? 'full' : ''}" data-i="${i}" aria-label="Vaso ${i + 1}, ${i < llenos ? 'tomado' : 'pendiente'}"></button>`
    ).join('');
    const r = Store.u.recordatorios;
    document.getElementById('rec-cada2').checked = r.cada2;
    document.getElementById('rec-comidas').checked = r.comidas;
    document.getElementById('rec-atrasada').checked = r.atrasada;
    this.textoPermiso();
  }
};
