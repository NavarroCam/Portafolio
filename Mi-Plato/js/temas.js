/* ==========================================================
   temas.js — colores de la app (paletas) y pantalla "Colores"
   La paleta se guarda en la cuenta (se ve igual en todos los
   dispositivos). Claro / oscuro / automático es de cada dispositivo.
   ========================================================== */

/* Para cada paleta:
   claro:  color principal, oscuro, suave, texto sobre suave, fondo
   oscuro: color principal (claro, sobre fondo oscuro), texto, suave, texto sobre suave
   tema / temaFuerte: tarjetas con texto blanco (agua y "Sacale una foto") */
const PALETAS = {
  salvia:    { nombre: 'Salvia',    tema: '#2F6B4F', temaFuerte: '#1F4A36', claro: ['#2F6B4F', '#E3EFE7', '#1F4A36', '#F3F5F0'], oscuro: ['#7FC29B', '#9ED3B3', '#1F3A2B', '#BFE3CD'] },
  terracota: { nombre: 'Terracota', tema: '#A84A17', temaFuerte: '#7A3410', claro: ['#A84A17', '#F8E6DA', '#7A3410', '#F7F3EF'], oscuro: ['#F0A577', '#F5BC97', '#3D2418', '#F6D2BC'] },
  petroleo:  { nombre: 'Petróleo',  tema: '#1E6272', temaFuerte: '#14454F', claro: ['#1E6272', '#DDEEF1', '#14454F', '#F1F5F6'], oscuro: ['#6FC1D1', '#93D2DE', '#15343B', '#C2E6ED'] },
  lavanda:   { nombre: 'Lavanda',   tema: '#5B4BA8', temaFuerte: '#3F3380', claro: ['#5B4BA8', '#E9E5F7', '#3F3380', '#F5F4FA'], oscuro: ['#A99CF0', '#C0B7F5', '#2A2547', '#DCD6FA'] },
  ciruela:   { nombre: 'Ciruela',   tema: '#7A3E6B', temaFuerte: '#592C4E', claro: ['#7A3E6B', '#F2E3EE', '#592C4E', '#F7F2F5'], oscuro: ['#D79BC6', '#E3B5D6', '#3A2234', '#F0D3E7'] },
  frambuesa: { nombre: 'Frambuesa', tema: '#B0345A', temaFuerte: '#842441', claro: ['#B0345A', '#F9E1E8', '#842441', '#FAF3F5'], oscuro: ['#F08AA8', '#F5A9BF', '#40202A', '#F9D0DC'] },
  azul:      { nombre: 'Azul',      tema: '#2457A6', temaFuerte: '#183D78', claro: ['#2457A6', '#E1EAF7', '#183D78', '#F2F5FA'], oscuro: ['#8CB4F0', '#A9C7F4', '#1A2B47', '#D3E2F9'] },
  marron:    { nombre: 'Marrón',    tema: '#6E4A2E', temaFuerte: '#4E331F', claro: ['#6E4A2E', '#F0E6DC', '#4E331F', '#F7F4F0'], oscuro: ['#D2A985', '#DEBE9F', '#33261C', '#EEDCCB'] },
  mono:      { nombre: 'Mono', nota: 'apto daltónicos', tema: '#262626', temaFuerte: '#000000', claro: ['#262626', '#E8E8E8', '#000000', '#F5F5F5'], oscuro: ['#E6E6E6', '#F0F0F0', '#2E2E2E', '#F5F5F5'] }
};

const Temas = {
  /** Paleta actual: la de la cuenta; si no hay sesión, la última usada en este dispositivo */
  actual() {
    const id = (Store.u && Store.u.paleta) || Store.paleta || 'salvia';
    return PALETAS[id] ? id : 'salvia';
  },

  /** Pone las variables CSS de la paleta (se llama desde UI.actualizarTema) */
  aplicar(oscuro) {
    const id = this.actual();
    const p = PALETAS[id];
    const r = document.documentElement;
    r.dataset.paleta = id;
    const set = (k, v) => r.style.setProperty(k, v);
    set('--tema', p.tema);
    set('--tema-fuerte', p.temaFuerte);
    if (oscuro) {
      const [acc, txt, soft, softInk] = p.oscuro;
      set('--accent', acc); set('--accent-text', txt); set('--accent-soft', soft); set('--accent-soft-ink', softInk);
      set('--accent-ink', '#0F1612');
      r.style.removeProperty('--bg');
    } else {
      const [acc, soft, softInk, bg] = p.claro;
      set('--accent', acc); set('--accent-text', acc); set('--accent-soft', soft); set('--accent-soft-ink', softInk);
      set('--accent-ink', '#FFFFFF');
      set('--bg', bg);
    }
    return oscuro ? '#0F1612' : p.tema;
  },

  elegir(id) {
    if (!PALETAS[id]) return;
    Store.paleta = id;
    if (Store.u) Store.update(u => { u.paleta = id; });
    UI.actualizarTema();
  }
};

/* ---------- Pantalla "Colores de la app" ---------- */
Screens.apariencia = {
  init() {
    document.getElementById('apariencia-paletas').addEventListener('click', e => {
      const b = e.target.closest('[data-paleta]');
      if (!b) return;
      Temas.elegir(b.dataset.paleta);
      this.render();
    });
    document.querySelectorAll('#screen-apariencia input[name="modo"]').forEach(r => {
      r.addEventListener('change', () => { UI.setTema(r.value); this.render(); });
    });
  },

  render() {
    const actual = Temas.actual();
    document.getElementById('apariencia-paletas').innerHTML = Object.entries(PALETAS).map(([id, p]) => `
      <button type="button" class="paleta" data-paleta="${id}" aria-pressed="${id === actual}">
        <span class="paleta-muestra" style="background:${p.claro[3]}">
          <i style="background:${p.tema}"></i>
          <span><i style="background:${p.claro[1]}"></i><i style="background:${p.temaFuerte}"></i></span>
        </span>
        <span class="paleta-nombre">${p.nombre}${p.nota ? `<small>${p.nota}</small>` : ''}</span>
        ${id === actual ? '<span class="paleta-check" aria-hidden="true"><svg><use href="#i-check"></use></svg></span>' : ''}
      </button>`).join('');
    const modo = document.querySelector(`#screen-apariencia input[name="modo"][value="${Store.theme}"]`);
    if (modo) modo.checked = true;
  }
};

/** Texto corto para "Mi usuario": "Lavanda · Claro" */
function textoApariencia() {
  const modo = { auto: 'Automático', light: 'Claro', dark: 'Oscuro' }[Store.theme] || 'Automático';
  return `${PALETAS[Temas.actual()].nombre} · ${modo}`;
}
