/* ==========================================================
   demo.js — usuario de demo con datos de ejemplo
   Para que cualquiera pueda probar la app antes de registrarse.
   - Los datos viven solo en este navegador: nunca se suben a la nube.
   - No usa Gemini: los platos de ejemplo ya vienen analizados.
   ========================================================== */

const DEMO_ID = 'demo';

/* Platos de ejemplo con su análisis (lo que respondería Gemini) */
const DEMO_PLATOS = {
  pollo: {
    nombre: 'Pollo, ensalada y arroz yamaní', foto: 'img/demo/pollo.jpg',
    analisis: {
      veredicto: 'ok', titulo: 'Plato bien armado',
      items: [{ nombre: 'Pechuga de pollo grillada', ok: true }, { nombre: 'Ensalada de hojas y tomate', ok: true }, { nombre: 'Arroz yamaní', ok: true }],
      distribucion: { vegetales: 50, proteina: 25, carbohidratos: 25 }, problemas: [],
      sugerencia: '', consejo: 'Buen equilibrio: la mitad del plato son vegetales y el cereal es integral.', conteos: {}
    }
  },
  milanesa: {
    nombre: 'Milanesa frita con papas', foto: 'img/demo/milanesa.jpg',
    analisis: {
      veredicto: 'ajustar', titulo: 'Se puede mejorar',
      items: [{ nombre: 'Milanesa frita', ok: false, nota: 'Mejor al horno' }, { nombre: 'Papas fritas', ok: false, nota: 'Cuenta como 1 de 2 por semana' }],
      distribucion: { proteina: 45, carbohidratos: 55 },
      problemas: [{ titulo: 'Frituras', detalle: 'Tus pautas piden evitar frituras.' }, { titulo: 'Faltan vegetales', detalle: 'La mitad del plato debería ser verdura.' }],
      sugerencia: 'milanesa al horno con ensalada de hojas y media porción de puré de calabaza.', consejo: '', conteos: { tuberculos: 1 }
    }
  },
  yogur: {
    nombre: 'Yogur griego con frutas', foto: 'img/demo/yogur.jpg',
    analisis: {
      veredicto: 'ok', titulo: 'Merienda completa',
      items: [{ nombre: 'Yogur griego natural', ok: true }, { nombre: 'Banana', ok: true }, { nombre: 'Arándanos', ok: true }, { nombre: 'Granola de avena', ok: true }],
      distribucion: { proteina: 40, carbohidratos: 35, otros: 25 }, problemas: [],
      sugerencia: '', consejo: 'Suma 2 frutas al conteo del día.', conteos: { frutas: 2 }
    }
  },
  tostada: {
    nombre: 'Tostada con palta y huevo', foto: 'img/demo/tostada.jpg',
    analisis: {
      veredicto: 'ok', titulo: 'Va bien',
      items: [{ nombre: 'Pan integral', ok: true }, { nombre: 'Palta', ok: true }, { nombre: 'Huevo a la plancha', ok: true }, { nombre: 'Café', ok: true }],
      distribucion: { proteina: 35, carbohidratos: 35, otros: 30 }, problemas: [],
      sugerencia: '', consejo: 'Ojo: es el huevo del día (máximo 1).', conteos: { huevos: 1 }
    }
  }
};

const Demo = {
  get activo() { return Store.userId === DEMO_ID; },

  /** Entra a la demo con una semana de datos de ejemplo */
  async entrar() {
    const fotos = {};
    // Las fotos van como dataURL para que también salgan en el PDF
    await Promise.all(Object.entries(DEMO_PLATOS).map(async ([k, p]) => {
      try {
        const blob = await (await fetch(p.foto)).blob();
        fotos[k] = await Api.leerComoDataURL(blob);
      } catch (e) { fotos[k] = p.foto; }
    }));
    Store.abrir(DEMO_ID, 'demo@miplato', this.datos(fotos), new Date().toISOString(), false);
    try { sessionStorage.setItem('miplato:demo', '1'); } catch (e) { /* nada */ }
    this.pintarBanner();
  },

  salir() {
    Store.cerrar();
    try { sessionStorage.removeItem('miplato:demo'); } catch (e) { /* nada */ }
    this.pintarBanner();
  },

  /** Al recargar la página en medio de la demo, la volvemos a abrir */
  async retomar() {
    let flag = false;
    try { flag = sessionStorage.getItem('miplato:demo') === '1'; } catch (e) { /* nada */ }
    if (flag && !Store.cache) await this.entrar();
    this.pintarBanner();
  },

  crearCuenta() {
    this.salir();
    UI.ir('registro');
  },

  pintarBanner() {
    const on = this.activo;
    document.getElementById('demo-banner').hidden = !on;
    document.documentElement.classList.toggle('modo-demo', on);
  },

  /* ---------- Datos de ejemplo ---------- */
  datos(fotos) {
    const u = usuarioVacio({ nombre: 'Sofía', apellido: 'Ejemplo', apodo: 'Sofi', nacimiento: '1996-05-14', altura: '165' });
    const hoy = new Date();
    const dia = n => Fechas.sumarDias(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()), n);
    u.creado = dia(-30).toISOString();
    u.onboarding = true;
    u.salud = { condiciones: ['Hipotiroidismo'], otra: '', alergias: '' };
    u.nutri = { tiene: true, nombre: 'Lic. de ejemplo', telefono: '', email: '', proximo: Fechas.clave(dia(9)), frecuencia: 'Cada 15 días', objetivo: 'Volver a mi peso ideal' };
    u.pautas = {
      archivos: [{ id: 'demo-pdf', nombre: 'Plan de alimentación (ejemplo).pdf', tamano: 182000, fecha: dia(-30).toISOString(), estado: 'ok' }],
      reglas: ['Plato: ½ vegetales, ¼ proteína, ¼ cereal integral', 'Evitar frituras', 'Frutas: 3 a 4 por día', 'Huevo: máximo 1 por día', 'Papa, choclo o batata: máximo 2 por semana', 'Tomar 2 litros de agua por día']
    };
    u.comidasPlan = TIPOS.map(t => ({ ...t }));
    u.limites = LIMITES_ANTERIORES.map(l => ({ ...l }));
    u.planEditado = true;
    u.recordatorios = { cada2: false, comidas: false, atrasada: false };

    const A = k => JSON.parse(JSON.stringify(DEMO_PLATOS[k].analisis));
    const reg = [
      // [días atrás, comida, hora, plato]
      [-6, 'desayuno', '08:05', 'yogur'], [-6, 'almuerzo', '13:10', 'pollo'], [-6, 'merienda', '17:20', 'tostada'], [-6, 'cena', '21:00', 'pollo'],
      [-5, 'desayuno', '07:50', 'tostada'], [-5, 'almuerzo', '13:30', 'pollo'], [-5, 'merienda', '17:05', 'yogur'], [-5, 'cena', '21:15', 'milanesa'],
      [-4, 'desayuno', '08:20', 'yogur'], [-4, 'almuerzo', '13:00', 'pollo'], [-4, 'cena', '20:45', 'pollo'],
      [-3, 'desayuno', '08:00', 'tostada'], [-3, 'almuerzo', '13:15', 'pollo'], [-3, 'merienda', '17:30', 'yogur'], [-3, 'cena', '21:00', 'pollo'],
      [-2, 'desayuno', '08:10', 'yogur'], [-2, 'almuerzo', '13:05', 'milanesa'], [-2, 'merienda', '17:00', 'yogur'], [-2, 'cena', '21:10', 'pollo'],
      [-1, 'desayuno', '07:55', 'tostada'], [-1, 'almuerzo', '13:20', 'pollo'], [-1, 'merienda', '16:50', 'yogur'],
      [0, 'desayuno', '08:10', 'yogur'], [0, 'almuerzo', '13:05', 'milanesa']
    ];
    const ahora = hoy.getHours() * 60 + hoy.getMinutes();
    reg.forEach(([n, tipo, hora, plato], i) => {
      // De hoy solo lo que ya pasó (si abren la demo a la mañana, no hay almuerzo cargado)
      if (n === 0 && aMinutos(hora) > ahora) return;
      const d = dia(n);
      const [h, m] = hora.split(':').map(Number);
      d.setHours(h, m, 0, 0);
      u.comidas.push({ id: 'demo' + i, fecha: d.toISOString(), tipo, nombreComida: Plan.nombre(tipo), momento: 'despues', foto: fotos[plato], descripcion: '', analisis: A(plato) });
    });
    // Agua: días cumplidos y otros no tanto
    [2000, 2250, 1500, 2000, 1750, 2000].forEach((ml, i) => { u.agua[Fechas.clave(dia(i - 6))] = ml; });
    u.agua[Fechas.clave(dia(0))] = Math.min(1500, Math.max(250, Math.floor(ahora / 60 - 7) * 250));
    u.actividad[Fechas.clave(dia(-5))] = 1; u.actividad[Fechas.clave(dia(-3))] = 1; u.actividad[Fechas.clave(dia(-1))] = 1;
    u.medidas = [
      { fecha: Fechas.clave(dia(-28)), peso: 71.4, cintura: 85, cadera: 102 },
      { fecha: Fechas.clave(dia(-14)), peso: 70.6, cintura: 84, cadera: 101 },
      { fecha: Fechas.clave(dia(-2)), peso: 69.8, cintura: 82.5, cadera: 100 }
    ];
    u.metas = [{ id: 'demo-meta', tipo: 'peso', valor: 66, fecha: Fechas.clave(dia(90)), texto: '' }];
    u.notas = '¿Puedo reemplazar el arroz yamaní por quinoa?\n¿Cuántas veces por semana puedo comer pescado?';
    u.chat = [
      { role: 'user', text: 'Ideas de merienda' },
      { role: 'model', text: 'Según tus pautas, algunas opciones:\n- **Yogur griego** con fruta y una cucharada de avena\n- **Tostada integral** con queso untable descremado y tomate\n- **Licuado** de banana con leche descremada y canela\n\nAcordate de sumar una fruta: hoy llevás 2 de 3–4.' }
    ];
    return u;
  },

  /* ---------- Platos de ejemplo (en vez de la cámara) ---------- */
  abrirPlatos() {
    document.getElementById('demo-platos').innerHTML = Object.entries(DEMO_PLATOS).map(([k, p]) => `
      <button type="button" class="demo-plato" data-plato="${k}">
        <img src="${p.foto}" alt="">
        <strong>${UI.esc(p.nombre)}</strong>
        <span class="tag ${p.analisis.veredicto === 'ok' ? 'tag--ok' : 'tag--warn'}">${p.analisis.veredicto === 'ok' ? 'Va bien' : 'Ajustar'}</span>
      </button>`).join('');
    Modal.abrir('dlg-demo');
  },

  elegirPlato(k) {
    const p = DEMO_PLATOS[k];
    const c = Screens.cargar;
    Modal.cerrar();
    Screens.resultado.pendiente = {
      foto: p.foto, descripcion: '', tipo: c.tipoElegido || Plan.porHora(), nombreExtra: c.nombreExtra,
      hora: c.hora, momento: 'antes', demoAnalisis: p.analisis
    };
    UI.ir('resultado');
  },

  /** En la demo no se analizan fotos propias (necesita cuenta) */
  puedeAnalizar() {
    this.abrirPlatos();
    UI.toast('En la demo usá un plato de ejemplo. Para tus fotos, creá tu cuenta.', 4000);
    return false;
  },

  /** Guarda la comida de ejemplo (solo en este navegador) y vuelve a Hoy */
  guardarComida(p, analisis, fecha) {
    Store.update(u => {
      u.comidas.push({
        id: UI.uid(), fecha: fecha.toISOString(), tipo: p.tipo,
        nombreComida: p.tipo === 'extra' ? (p.nombreExtra || 'Extra') : Plan.nombre(p.tipo),
        momento: p.momento, foto: p.foto, descripcion: p.descripcion, analisis
      });
      u.comidas.sort((a, b) => a.fecha.localeCompare(b.fecha));
    });
    Screens.resultado.pendiente = null;
    Screens.cargar.reset();
    UI.toast('Guardada en la demo. ¡Así de fácil!');
    UI.ir('hoy');
  },

  init() {
    document.getElementById('login-demo').addEventListener('click', async e => {
      const btn = e.currentTarget;
      btn.disabled = true;
      await this.entrar();
      btn.disabled = false;
      UI.ir('hoy');
    });
    document.getElementById('demo-crear').addEventListener('click', () => this.crearCuenta());
    document.getElementById('demo-crear2').addEventListener('click', () => { Modal.cerrar(); this.crearCuenta(); });
    document.getElementById('demo-platos').addEventListener('click', e => {
      const b = e.target.closest('[data-plato]');
      if (b) this.elegirPlato(b.dataset.plato);
    });
  }
};
