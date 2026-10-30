/* ==========================================================
   perfil.js — mi usuario, progreso y metas, consultas
   ========================================================== */

function ultimaMedida(campo) {
  const lista = [...Store.u.medidas].filter(m => m[campo]).sort((a, b) => a.fecha.localeCompare(b.fecha));
  return lista.length ? lista[lista.length - 1] : null;
}
function primeraMedida(campo) {
  const lista = [...Store.u.medidas].filter(m => m[campo]).sort((a, b) => a.fecha.localeCompare(b.fecha));
  return lista.length ? lista[0] : null;
}
const kg = v => Number(v).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + ' kg';

/* ---------- Mi usuario ---------- */
Screens.perfil = {
  init() {
    document.getElementById('perfil-notas').addEventListener('change', e => {
      Store.update(u => { u.notas = e.target.value; });
      UI.toast('Notas guardadas');
    });
    document.getElementById('perfil-tema').addEventListener('change', e => UI.setTema(e.target.value));
    document.getElementById('form-apodo').addEventListener('submit', e => {
      e.preventDefault();
      const input = document.getElementById('perfil-apodo');
      input.blur();
      const apodo = input.value.trim().slice(0, 24);
      Store.update(u => { u.perfil.apodo = apodo; });
      UI.toast(apodo ? `¡Listo, ${apodo}!` : 'Apodo borrado: te vamos a decir por tu nombre');
      this.render();
    });
    document.getElementById('perfil-salir').addEventListener('click', async e => {
      const btn = e.currentTarget;
      btn.disabled = true;
      await Nube.salir();
      btn.disabled = false;
      UI.ir('login');
    });
  },

  render() {
    const u = Store.u;
    const p = u.perfil;
    document.getElementById('perfil-iniciales').textContent = ((p.nombre[0] || '') + (p.apellido[0] || '')).toUpperCase();
    document.getElementById('perfil-nombre').textContent = `${p.nombre} ${p.apellido}`.trim() + (p.apodo ? ` (${p.apodo})` : '');
    document.getElementById('perfil-apodo').value = p.apodo || '';
    document.getElementById('perfil-objetivo').textContent = u.nutri.objetivo ? 'Objetivo: ' + u.nutri.objetivo : Store.email;

    // Tarjeta de nutricionista: solo si indicó que tiene uno
    const n = u.nutri;
    const caja = document.getElementById('perfil-nutri');
    caja.hidden = !n.tiene;
    if (n.tiene) {
      const wa = linkWhatsApp(n.telefono, 'Hola, te hago una consulta: ');
      const mail = linkEmail(n.email, 'Consulta', '');
      const proximo = n.proximo ? Fechas.corto(Fechas.desdeClave(n.proximo)) : 'sin fecha';
      caja.innerHTML = `
        <div class="row-between" style="align-items:flex-start">
          <div class="stack-xs" style="gap:2px">
            <span class="label">Tu nutricionista</span>
            <span class="name">${UI.esc(n.nombre || 'Sin nombre')}</span>
            <span class="sub">Próximo control: ${UI.esc(proximo)}</span>
          </div>
          <a class="edit" href="#nutri">Editar</a>
        </div>
        <div class="nutri-actions">
          <a href="#consulta"><svg><use href="#i-chat"></use></svg>Consultar</a>
          <a href="${wa || '#'}" target="_blank" rel="noopener" aria-disabled="${!wa}"><svg><use href="#i-phone"></use></svg>WhatsApp</a>
          <a href="${mail || '#'}" aria-disabled="${!mail}"><svg><use href="#i-mail"></use></svg>Email</a>
        </div>`;
    }

    // Progreso
    const ult = ultimaMedida('peso');
    const pri = primeraMedida('peso');
    const metaPeso = u.metas.find(m => m.tipo === 'peso');
    const diff = ult && pri ? pri.peso - ult.peso : 0;
    document.getElementById('perfil-progreso').innerHTML = `
      <div class="stat"><span>Peso actual</span><strong>${ult ? kg(ult.peso) : '—'}</strong></div>
      <div class="stat"><span>${diff >= 0 ? 'Bajaste' : 'Subiste'}</span><strong class="accent-text">${ult ? kg(Math.abs(diff)) : '—'}</strong></div>
      <div class="stat"><span>Meta</span><strong>${metaPeso ? kg(metaPeso.valor) : '—'}</strong></div>`;

    const cond = [...u.salud.condiciones, u.salud.otra].filter(Boolean);
    document.getElementById('perfil-salud').textContent = cond.length ? cond.join(', ') : 'Ninguna cargada';
    document.getElementById('perfil-pautas').textContent = `${u.pautas.archivos.length} PDF · ${u.pautas.reglas.length} reglas`;
    document.getElementById('perfil-nutri-txt').textContent = n.tiene ? (n.nombre || 'Cargado') : 'No estoy en seguimiento';
    document.getElementById('perfil-notas').value = u.notas || '';
    document.getElementById('perfil-email').textContent = Store.email || '';
    document.getElementById('perfil-sync').textContent = Nube.textoEstado();
    const nL = Plan.limites().length;
    document.getElementById('perfil-plan-txt').textContent = `${Plan.comidas().length} comidas · ${nL} ${nL === 1 ? 'límite' : 'límites'}`;
    document.getElementById('perfil-tema').value = Store.theme;
  }
};

/* ---------- Progreso y metas ---------- */
Screens.progreso = {
  init() {
    document.getElementById('form-medida').addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      const num = v => (v === '' ? null : Number(v));
      const m = { fecha: f.fecha.value || Fechas.clave(), peso: num(f.peso.value), cintura: num(f.cintura.value), cadera: num(f.cadera.value) };
      if (!m.peso && !m.cintura && !m.cadera) { UI.toast('Cargá al menos un dato'); return; }
      Store.update(u => {
        u.medidas = u.medidas.filter(x => x.fecha !== m.fecha);
        u.medidas.push(m);
        u.medidas.sort((a, b) => a.fecha.localeCompare(b.fecha));
      });
      f.reset();
      UI.toast('Registro guardado');
      this.render();
    });

    document.getElementById('prog-historial').addEventListener('click', e => {
      const b = e.target.closest('[data-borrar]');
      if (!b) return;
      Store.update(u => { u.medidas = u.medidas.filter(x => x.fecha !== b.dataset.borrar); });
      this.render();
    });

    const tipo = document.getElementById('meta-tipo');
    tipo.addEventListener('change', () => this.formMeta());

    document.getElementById('form-meta').addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      const meta = { id: UI.uid(), tipo: f.tipo.value, valor: f.valor.value, fecha: f.fecha.value, texto: f.texto.value.trim() };
      if (meta.tipo === 'libre' ? !meta.texto : !meta.valor) { UI.toast('Completá la meta'); return; }
      Store.update(u => {
        if (meta.tipo !== 'libre') u.metas = u.metas.filter(m => m.tipo !== meta.tipo); // una por tipo
        u.metas.push(meta);
      });
      f.reset();
      this.formMeta();
      this.render();
    });

    document.getElementById('prog-metas').addEventListener('click', e => {
      const b = e.target.closest('[data-meta]');
      if (b) {
        Store.update(u => { u.metas = u.metas.filter(m => m.id !== b.dataset.meta); });
        this.render();
        return;
      }
      const c = e.target.closest('[data-cumplir]');
      if (c) {
        Store.update(u => { const m = u.metas.find(x => x.id === c.dataset.cumplir); if (m) m.cumplida = !m.cumplida; });
        this.render();
      }
    });
  },

  formMeta() {
    const tipo = document.getElementById('meta-tipo').value;
    document.getElementById('meta-texto-wrap').hidden = tipo !== 'libre';
    const valor = document.getElementById('meta-valor');
    valor.closest('.field').hidden = tipo === 'libre';
    document.querySelector('label[for="meta-valor"]').textContent =
      tipo === 'peso' ? 'Peso meta (kg)' : tipo === 'actividad' ? 'Veces por semana' : 'Días por semana';
  },

  grafico() {
    const puntos = Store.u.medidas.filter(m => m.peso);
    const cont = document.getElementById('prog-grafico');
    if (puntos.length < 2) {
      cont.innerHTML = `<p class="chart-empty">${puntos.length ? 'Con un registro más ya ves la curva.' : 'Cargá tu peso para ver tu progreso.'}</p>`;
      return;
    }
    const W = 320, H = 130, pad = 14;
    const pesos = puntos.map(p => p.peso);
    const meta = Store.u.metas.find(m => m.tipo === 'peso');
    const valores = meta ? [...pesos, Number(meta.valor)] : pesos;
    const min = Math.min(...valores) - 0.5, max = Math.max(...valores) + 0.5;
    const x = i => pad + i * ((W - 2 * pad) / (puntos.length - 1));
    const y = v => pad + (max - v) / (max - min) * (H - 2 * pad - 14);
    const linea = puntos.map((p, i) => `${x(i).toFixed(1)},${y(p.peso).toFixed(1)}`).join(' ');
    const metaY = meta ? y(Number(meta.valor)) : null;
    cont.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Peso de ${kg(pesos[0])} a ${kg(pesos[pesos.length - 1])}">
        ${metaY !== null ? `<line x1="0" x2="${W}" y1="${metaY}" y2="${metaY}" stroke="var(--prot)" stroke-dasharray="4 4"/>
          <text x="${W}" y="${metaY - 4}" text-anchor="end" font-size="10" fill="var(--muted)">meta ${kg(meta.valor)}</text>` : ''}
        <polyline points="${linea}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
        ${puntos.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.peso)}" r="${i === puntos.length - 1 ? 5 : 3.5}" fill="${i === puntos.length - 1 ? 'var(--surface)' : 'var(--accent)'}" stroke="var(--accent)" stroke-width="2.5"/>`).join('')}
        <text x="0" y="${H - 2}" font-size="10" fill="var(--muted)">${Fechas.corto(Fechas.desdeClave(puntos[0].fecha))}</text>
        <text x="${W}" y="${H - 2}" text-anchor="end" font-size="10" fill="var(--muted)">${Fechas.corto(Fechas.desdeClave(puntos[puntos.length - 1].fecha))}</text>
      </svg>`;
  },

  render() {
    const u = Store.u;
    const ult = ultimaMedida('peso');
    const pri = primeraMedida('peso');
    document.getElementById('prog-actual').textContent = ult ? kg(ult.peso) : '— kg';
    const diff = ult && pri ? ult.peso - pri.peso : 0;
    document.getElementById('prog-delta').textContent = ult && pri && ult !== pri
      ? `${diff <= 0 ? '−' : '+'}${kg(Math.abs(diff))} desde ${Fechas.corto(Fechas.desdeClave(pri.fecha))}` : '';
    document.getElementById('med-fecha').value = Fechas.clave();
    this.grafico();

    document.getElementById('prog-historial').innerHTML = [...u.medidas].reverse().slice(0, 8).map(m => {
      const partes = [m.peso ? kg(m.peso) : '', m.cintura ? `cintura ${m.cintura} cm` : '', m.cadera ? `cadera ${m.cadera} cm` : ''].filter(Boolean);
      return `<li class="list-item"><span><strong>${Fechas.corto(Fechas.desdeClave(m.fecha))}</strong> · ${UI.esc(partes.join(' · '))}</span>
        <button type="button" class="icon-btn" data-borrar="${m.fecha}" aria-label="Borrar registro del ${Fechas.corto(Fechas.desdeClave(m.fecha))}"><svg><use href="#i-trash"></use></svg></button></li>`;
    }).join('');

    // Metas con su avance
    const semana = Semana.datos(Fechas.lunes());
    document.getElementById('prog-metas').innerHTML = u.metas.length ? u.metas.map(m => {
      let titulo, avance = 0, detalle = '';
      if (m.tipo === 'peso') {
        titulo = `Llegar a ${kg(m.valor)}`;
        if (ult && pri && pri.peso !== Number(m.valor)) {
          avance = (pri.peso - ult.peso) / (pri.peso - Number(m.valor));
          detalle = `${kg(Math.abs(ult.peso - m.valor))} para llegar`;
        }
      } else if (m.tipo === 'actividad') {
        titulo = `Entrenar ${m.valor} veces por semana`;
        avance = semana.actividad / Number(m.valor);
        detalle = `${semana.actividad} de ${m.valor} esta semana`;
      } else if (m.tipo === 'agua') {
        titulo = `${m.valor} días con 2 L por semana`;
        avance = semana.diasAgua / Number(m.valor);
        detalle = `${semana.diasAgua} de ${m.valor} esta semana`;
      } else {
        titulo = m.texto;
        avance = m.cumplida ? 1 : 0;
        detalle = m.cumplida ? 'Cumplida' : '';
      }
      const fecha = m.fecha ? ' · para el ' + Fechas.corto(Fechas.desdeClave(m.fecha)) : '';
      const pct = Math.max(0, Math.min(1, avance)) * 100;
      return `<div class="card goal">
        <div class="row-between"><span>${UI.esc(titulo)}</span>
          <span style="display:flex;gap:2px">
            ${m.tipo === 'libre' ? `<button type="button" class="del" data-cumplir="${m.id}" aria-label="Marcar como ${m.cumplida ? 'no cumplida' : 'cumplida'}"><svg><use href="#i-check"></use></svg></button>` : ''}
            <button type="button" class="del" data-meta="${m.id}" aria-label="Borrar meta"><svg><use href="#i-trash"></use></svg></button>
          </span></div>
        <div class="bar"><div style="width:${pct}%"></div></div>
        <small class="muted">${UI.esc(detalle + fecha)}</small>
      </div>`;
    }).join('') : '<p class="small muted">Todavía no tenés metas. Agregá una abajo.</p>';
    this.formMeta();
  }
};

/* ---------- Consultar a tu nutri ---------- */
const MOTIVOS = [
  { id: 'duda', nombre: 'Duda con una comida', texto: 'Hola, te hago una consulta sobre una comida: ' },
  { id: 'turno', nombre: 'Pedir turno', texto: 'Hola, ¿tenés un turno disponible para el próximo control?' },
  { id: 'progreso', nombre: 'Mandar mi progreso', texto: '' },
  { id: 'otra', nombre: 'Otra', texto: 'Hola, ' }
];

Screens.consulta = {
  motivo: 'duda',

  init() {
    document.getElementById('consulta-motivos').addEventListener('click', e => {
      const b = e.target.closest('.chip');
      if (!b) return;
      this.motivo = b.dataset.id;
      document.getElementById('consulta-msj').value = this.textoMotivo();
      document.getElementById('consulta-pdf').checked = this.motivo === 'progreso';
      this.pintarMotivos();
    });
    document.getElementById('consulta-wa').addEventListener('click', () => this.enviar('wa'));
    document.getElementById('consulta-mail').addEventListener('click', () => this.enviar('mail'));
  },

  textoMotivo() {
    const m = MOTIVOS.find(x => x.id === this.motivo);
    if (this.motivo !== 'progreso') return m.texto;
    const ult = ultimaMedida('peso');
    const d = Semana.datos(Fechas.lunes());
    return `Hola, te paso cómo vengo esta semana: ${d.totalOk} de ${d.comidas.length} comidas bien, ${d.diasAgua} días con 2 L de agua y ${d.actividad} entrenamientos.` +
      (ult ? ` Mi último peso: ${kg(ult.peso)}.` : '') + ' Te adjunto el resumen en PDF.';
  },

  pintarMotivos() {
    document.getElementById('consulta-motivos').innerHTML = MOTIVOS.map(m =>
      `<button type="button" class="chip" role="radio" data-id="${m.id}" aria-checked="${m.id === this.motivo}">${m.nombre}</button>`
    ).join('');
  },

  async enviar(canal) {
    const n = Store.u.nutri;
    const texto = document.getElementById('consulta-msj').value.trim();
    if (!texto) { UI.toast('Escribí tu mensaje'); return; }
    const link = canal === 'wa' ? linkWhatsApp(n.telefono, texto) : linkEmail(n.email, 'Consulta', texto);
    if (!link) {
      UI.toast(canal === 'wa' ? 'No cargaste el WhatsApp de tu nutri.' : 'No cargaste el email de tu nutri.');
      return;
    }
    if (document.getElementById('consulta-pdf').checked) {
      try {
        const archivo = await Semana.pdf(Fechas.lunes(), { comidas: true, agua: true, actividad: true, peso: true, notas: true });
        Semana.descargar(archivo);
        UI.toast('Se descargó el PDF: adjuntalo en el mensaje.', 5000);
      } catch (err) { UI.toast(err.message); }
    }
    window.open(link, '_blank');
  },

  render() {
    const n = Store.u.nutri;
    if (!n.tiene) { UI.toast('Primero indicá que estás con un nutricionista.'); UI.ir('nutri'); return; }
    document.getElementById('consulta-nombre').textContent = n.nombre || '';
    document.getElementById('consulta-wa').disabled = !n.telefono;
    document.getElementById('consulta-mail').disabled = !n.email;
    this.pintarMotivos();
    const msj = document.getElementById('consulta-msj');
    if (!msj.value) msj.value = this.textoMotivo();
  }
};
