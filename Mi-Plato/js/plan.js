/* ==========================================================
   plan.js — las comidas y los límites de CADA usuario
   - comidasPlan: [{ id, nombre, hora 'HH:MM', guia, estilo }]
       estilo: 'plato' (½ vegetales, ¼ proteína, ¼ cereal),
               'estructura' (infusión + hidrato + proteína + fibra),
               'libre' (solo las pautas)
   - limites: [{ id, nombre, min, max, periodo: 'dia' | 'semana' }]
   Se arman solos al leer los PDFs de pautas (si el usuario no
   los editó) y se editan en "Mis comidas".
   ========================================================== */

/* Comidas de ejemplo para quien no subió pautas todavía */
const TIPOS = [
  { id: 'desayuno', nombre: 'Desayuno', hora: '08:00', estilo: 'estructura', guia: 'Infusión + 1 hidrato + 1 proteína + 1 fibra' },
  { id: 'almuerzo', nombre: 'Almuerzo', hora: '13:00', estilo: 'plato', guia: '½ vegetales · ¼ proteína · ¼ cereal' },
  { id: 'merienda', nombre: 'Merienda', hora: '17:00', estilo: 'estructura', guia: 'Infusión + 1 hidrato + 1 proteína + 1 fibra' },
  { id: 'cena', nombre: 'Cena', hora: '21:00', estilo: 'plato', guia: '½ vegetales · ¼ proteína · ¼ cereal' }
];

const ESTILOS_CORTO = { plato: 'Plato completo', estructura: 'Tipo desayuno/merienda', libre: 'Libre' };
const ESTILOS = {
  plato: 'Plato completo (½ vegetales, ¼ proteína, ¼ cereal)',
  estructura: 'Infusión + hidrato + proteína + fibra',
  libre: 'Libre (solo mis pautas)'
};

/* Límites que mostraba la app antes (vienen de las pautas de Cam) */
const LIMITES_ANTERIORES = [
  { id: 'frutas', nombre: 'Frutas', min: 3, max: 4, periodo: 'dia' },
  { id: 'huevos', nombre: 'Huevo', min: null, max: 1, periodo: 'dia' },
  { id: 'tuberculos', nombre: 'Papa, choclo, batata', min: null, max: 2, periodo: 'semana' }
];

const aMinutos = hhmm => { const [h, m] = String(hhmm || '00:00').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const horaLinda = hhmm => { const [h, m] = String(hhmm || '').split(':'); return h ? `${Number(h)}:${m || '00'}` : ''; };
const slug = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'item';

const Plan = {
  /** Comidas del usuario, ordenadas por hora */
  comidas() {
    // Sin plan todavía: las 4 comidas clásicas, sin guía (hasta que suba sus pautas o las edite)
    const l = (Store.u && Store.u.comidasPlan) || TIPOS.map(t => ({ ...t, guia: '' }));
    return [...l].sort((a, b) => aMinutos(a.hora) - aMinutos(b.hora));
  },
  get(id) { return this.comidas().find(c => c.id === id) || null; },
  /** Nombre para mostrar. Si la comida ya no está en el plan, usa el nombre guardado en el registro */
  nombre(id, registro) {
    const c = this.get(id) || TIPOS.find(t => t.id === id);
    return c ? c.nombre : (registro && registro.nombreComida) || 'Comida';
  },
  limites() { return (Store.u && Store.u.limites) || []; },

  /** Comida sugerida según la hora: la de horario más cercano */
  porHora(d = new Date()) {
    const ahora = d.getHours() * 60 + d.getMinutes();
    let mejor = this.comidas()[0], dist = Infinity;
    for (const c of this.comidas()) {
      const x = Math.abs(aMinutos(c.hora) - ahora);
      const diff = Math.min(x, 1440 - x);
      if (diff < dist) { dist = diff; mejor = c; }
    }
    return mejor ? mejor.id : null;
  },

  /** Texto del objetivo de un límite: "de 3–4", "máx. 1", "mín. 2" */
  objetivo(l) {
    const sem = l.periodo === 'semana' ? '/sem' : '';
    if (l.min != null && l.max != null) return `de ${l.min}–${l.max}${sem}`;
    if (l.max != null) return `máx. ${l.max}${sem}`;
    if (l.min != null) return `mín. ${l.min}${sem}`;
    return l.periodo === 'semana' ? 'por semana' : 'por día';
  },
  /** ¿Se pasó del máximo? */
  excedido(l, n) { return l.max != null && n > l.max; },

  /** Convierte lo que detectó Gemini en el formato de la app */
  desdeDetectado(comidas = [], limites = []) {
    const usados = new Set();
    const idUnico = base => { let id = base, i = 2; while (usados.has(id)) id = base + '-' + i++; usados.add(id); return id; };
    const plan = comidas
      .filter(c => c && c.nombre)
      .map((c, i) => {
        // Si coincide con una comida clásica, mantenemos su id (así las comidas ya cargadas siguen asociadas)
        const clasica = TIPOS.find(t => slug(t.nombre) === slug(c.nombre));
        const hora = /^\d{1,2}:\d{2}$/.test(c.hora || '') ? c.hora.padStart(5, '0') : (clasica ? clasica.hora : '');
        return {
          id: idUnico(clasica ? clasica.id : 'c-' + slug(c.nombre)),
          nombre: String(c.nombre).slice(0, 30),
          hora: hora || ['08:00', '10:30', '13:00', '17:00', '19:00', '21:00'][Math.min(i, 5)],
          guia: String(c.guia || '').slice(0, 140),
          estilo: ESTILOS[c.estilo] ? c.estilo : 'libre'
        };
      });
    const lim = limites
      .filter(l => l && l.nombre && (l.min != null || l.max != null))
      .map(l => {
        const s = slug(l.nombre);
        // Mismos ids que antes para frutas, huevo y papa/choclo (así se siguen contando las comidas viejas)
        const anterior = /^frutas?(-|$)/.test(s) && !/seco/.test(s) ? 'frutas' : /huevo/.test(s) ? 'huevos' : /papa|choclo|batata|mandioca|tubercul/.test(s) ? 'tuberculos' : null;
        return {
          id: idUnico(anterior || 'l-' + s),
          nombre: String(l.nombre).slice(0, 30),
          min: Number.isFinite(Number(l.min)) && l.min !== null && l.min !== '' ? Number(l.min) : null,
          max: Number.isFinite(Number(l.max)) && l.max !== null && l.max !== '' ? Number(l.max) : null,
          periodo: l.periodo === 'semana' ? 'semana' : 'dia'
        };
      });
    return { plan, lim };
  },

  /** Usuarios de antes de esta versión (no tienen "limites"): les armamos el plan con lo que ya veían */
  migrar() {
    const u = Store.u;
    if (!u || 'limites' in u) return;
    Store.update(x => {
      const h = x.horarios || {};
      x.comidasPlan = TIPOS.map(t => ({ ...t, hora: h[t.id] || t.hora }));
      x.limites = LIMITES_ANTERIORES.map(l => ({ ...l }));
      x.planEditado = false;
    });
  }
};

/** Cantidad contada de un límite en una comida (acepta el formato viejo y el nuevo) */
function conteoDe(c, id) {
  const k = c && c.analisis && c.analisis.conteos;
  if (!k) return 0;
  if (Array.isArray(k)) { const x = k.find(e => e.id === id); return x ? Number(x.cantidad) || 0 : 0; }
  return Number(k[id]) || 0;
}
