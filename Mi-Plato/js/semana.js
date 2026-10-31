/* ==========================================================
   semana.js — resumen semanal y exportación a PDF (jsPDF)
   ========================================================== */

const Semana = {
  /** Datos calculados de la semana que empieza en `lunes` */
  datos(lunes) {
    const u = Store.u;
    const dias = Fechas.diasSemana(lunes);
    const hoyClave = Fechas.clave();
    const desdeClave = Fechas.clave(new Date(u.creado)); // no contamos días antes de crear la cuenta
    const finSemana = Fechas.sumarDias(lunes, 7);
    const idsPlan = new Set(Plan.comidas().map(c => c.id));
    const nComidas = idsPlan.size;
    const comidas = u.comidas.filter(c => {
      const f = new Date(c.fecha);
      return f >= lunes && f < finSemana;
    });

    const porDia = dias.map(d => {
      const clave = Fechas.clave(d);
      const lista = comidas.filter(c => Fechas.clave(new Date(c.fecha)) === clave);
      const tipos = new Set(lista.map(c => c.tipo).filter(t => idsPlan.has(t)));
      return {
        fecha: d,
        clave,
        comidas: lista,
        ok: lista.filter(c => idsPlan.has(c.tipo) && c.analisis && c.analisis.veredicto === 'ok').length,
        completas: tipos.size,
        agua: u.agua[clave] || 0,
        entrenos: Actividad.delDia(clave),
        actividad: Actividad.delDia(clave).length,
        pasado: clave <= hoyClave && clave >= desdeClave,
        esHoy: clave === hoyClave
      };
    });

    const pasados = porDia.filter(d => d.pasado);
    // Límites semanales del usuario (p. ej. papa/choclo: máx. 2) y cuánto lleva
    const limitesSemana = Plan.limites().filter(l => l.periodo === 'semana').map(l => ({
      ...l, total: comidas.reduce((n, c) => n + conteoDe(c, l.id), 0)
    }));
    const metaAct = u.metas.find(m => m.tipo === 'actividad');

    return {
      lunes, dias: porDia, comidas,
      totalOk: comidas.filter(c => c.analisis && c.analisis.veredicto === 'ok').length,
      limitesSemana, nComidas,
      actividad: porDia.reduce((n, d) => n + d.actividad, 0),
      entrenos: porDia.flatMap(d => d.entrenos),
      metaActividad: metaAct ? Number(metaAct.valor) || 3 : 3,
      diasAgua: pasados.filter(d => d.agua >= META_AGUA).length,
      aguaPromedio: pasados.length ? pasados.reduce((n, d) => n + d.agua, 0) / pasados.length : 0,
      diasCompletos: pasados.filter(d => d.completas >= nComidas).length,
      diasIncompletos: pasados.filter(d => d.completas < nComidas && !d.esHoy),
      diasPasados: pasados.length,
      medidas: u.medidas.filter(m => {
        const f = Fechas.desdeClave(m.fecha);
        return f >= lunes && f < finSemana;
      })
    };
  },

  /** Genera el PDF y devuelve { blob, nombre } */
  async pdf(lunes, op) {
    if (!window.jspdf) throw new Error('No se pudo cargar la librería de PDF. Revisá tu conexión.');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const u = Store.u;
    const d = this.datos(lunes);
    if (op.comidas) await Fotos.asegurar(d.comidas.map(c => c.fotoId).filter(Boolean));
    const W = 210, M = 16;
    let y = 18;

    const verde = [47, 107, 79], gris = [79, 94, 85], tinta = [23, 35, 28], naranja = [164, 71, 15];
    const salto = h => { if (y + h > 282) { doc.addPage(); y = 18; } };
    const texto = (t, x, size = 10, color = tinta, estilo = 'normal') => {
      doc.setFont('helvetica', estilo); doc.setFontSize(size); doc.setTextColor(...color); doc.text(String(t), x, y);
    };
    const seccion = t => {
      salto(14); y += 4;
      texto(t, M, 13, tinta, 'bold'); y += 2;
      doc.setDrawColor(221, 227, 218); doc.line(M, y, W - M, y); y += 6;
    };

    // Encabezado
    texto('Registro semanal', M, 18, tinta, 'bold');
    doc.setFontSize(9); doc.setTextColor(...gris); doc.text('Mi Plato', W - M, y, { align: 'right' });
    y += 7;
    texto(`${u.perfil.nombre} ${u.perfil.apellido} · ${Fechas.rango(lunes)} ${lunes.getFullYear()}`, M, 10, gris);
    y += 5;
    if (u.nutri.tiene && u.nutri.nombre) { texto('Para: ' + u.nutri.nombre, M, 10, gris); y += 5; }
    if (u.nutri.objetivo) { texto('Objetivo: ' + u.nutri.objetivo, M, 10, gris); y += 5; }
    doc.setDrawColor(...verde); doc.setLineWidth(0.8); doc.line(M, y, W - M, y); doc.setLineWidth(0.2);
    y += 8;

    // Resumen en cajas
    const cajas = [
      [`${d.totalOk}/${d.comidas.length}`, 'comidas "va bien"'],
      [UI.litros(Math.round(d.aguaPromedio)), 'agua promedio'],
      [`${d.actividad}`, 'entrenamientos'],
      d.limitesSemana.length
        ? [`${d.limitesSemana[0].total}${d.limitesSemana[0].max != null ? '/' + d.limitesSemana[0].max : ''}`, d.limitesSemana[0].nombre.toLowerCase()]
        : [`${d.diasAgua}/${d.diasPasados}`, 'días con 2 L de agua']
    ];
    const cw = (W - 2 * M - 9) / 4;
    cajas.forEach(([v, l], i) => {
      const x = M + i * (cw + 3);
      doc.setFillColor(243, 245, 240); doc.roundedRect(x, y - 5, cw, 17, 2, 2, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...tinta); doc.text(v, x + cw / 2, y + 3, { align: 'center' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...gris); doc.text(l, x + cw / 2, y + 9, { align: 'center' });
    });
    y += 20;

    // Comidas
    if (op.comidas) {
      seccion('Comidas');
      const conComidas = d.dias.filter(x => x.comidas.length);
      if (!conComidas.length) { texto('No hay comidas cargadas esta semana.', M, 10, gris); y += 6; }
      for (const dia of conComidas) {
        salto(12);
        texto(Fechas.largo(dia.fecha), M, 11, verde, 'bold'); y += 6;
        for (const c of dia.comidas) {
          const a = c.analisis || {};
          const tipo = Plan.nombre(c.tipo, c);
          const items = (a.items || []).map(i => i.nombre).join(', ') || c.descripcion || '';
          const lineas = doc.splitTextToSize(items, W - 2 * M - 52);
          const nota = a.veredicto !== 'ok' && a.problemas && a.problemas.length
            ? doc.splitTextToSize('A mejorar: ' + a.problemas.map(p => p.titulo).join('; '), W - 2 * M - 52) : [];
          const alto = Math.max(20, 6 + (lineas.length + nota.length) * 4.4);
          salto(alto + 2);
          const inicio = y;
          const foto = fotoDe(c);
          if (foto) {
            try { doc.addImage(foto, 'JPEG', M, y - 4, 18, 18); } catch (e) { /* imagen inválida */ }
          }
          const x = M + 22;
          texto(`${tipo} · ${Fechas.hora(c.fecha)}`, x, 10, tinta, 'bold');
          const ok = a.veredicto === 'ok';
          doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...(ok ? verde : naranja));
          doc.text(ok ? 'Va bien' : 'Ajustar', W - M, y, { align: 'right' });
          y += 5;
          doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...gris);
          doc.text(lineas, x, y); y += lineas.length * 4.4;
          if (nota.length) { doc.setTextColor(...naranja); doc.text(nota, x, y); y += nota.length * 4.4; }
          y = Math.max(y, inicio + 16) + 3;
        }
        y += 2;
      }
    }

    // Agua y actividad por día
    if (op.agua || op.actividad) {
      seccion(op.agua && op.actividad ? 'Agua y actividad física' : op.agua ? 'Agua' : 'Actividad física');
      d.dias.forEach(dia => {
        salto(7);
        texto(Fechas.largo(dia.fecha), M, 10);
        let x = W - M;
        if (op.actividad) {
          // "Natación 40 min, Gym" (recortado para que entre en la columna)
          const txt = dia.entrenos.map(e => e.tipo ? e.tipo + (e.minutos ? ` ${e.minutos} min` : '') : 'Entrenamiento').join(', ');
          doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
          doc.setTextColor(...gris); doc.text(txt ? doc.splitTextToSize(txt, 68)[0] : '—', x, y, { align: 'right' });
          x -= 76;
        }
        if (op.agua) {
          doc.setTextColor(...(dia.agua >= META_AGUA ? verde : gris));
          doc.text(dia.agua ? UI.litros(dia.agua) : '—', x, y, { align: 'right' });
        }
        y += 6;
      });
    }

    // Peso y medidas
    if (op.peso) {
      seccion('Peso y medidas');
      const lista = d.medidas.length ? d.medidas : u.medidas.slice(-1);
      if (!lista.length) { texto('Sin registros.', M, 10, gris); y += 6; }
      lista.forEach(m => {
        salto(7);
        const partes = [m.peso ? `${m.peso} kg` : '', m.cintura ? `cintura ${m.cintura} cm` : '', m.cadera ? `cadera ${m.cadera} cm` : ''].filter(Boolean);
        texto(`${Fechas.corto(Fechas.desdeClave(m.fecha))}: ${partes.join(' · ')}`, M, 10);
        y += 6;
      });
    }

    // Notas
    if (op.notas && u.notas.trim()) {
      seccion('Notas y dudas');
      const l = doc.splitTextToSize(u.notas.trim(), W - 2 * M);
      l.forEach(linea => { salto(6); texto(linea, M, 10); y += 5; });
    }

    // Pie
    const paginas = doc.getNumberOfPages();
    for (let i = 1; i <= paginas; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...gris);
      doc.text(`Página ${i} de ${paginas} · generado con Mi Plato`, W / 2, 292, { align: 'center' });
    }

    const nombre = `Mi-Plato_${Fechas.clave(lunes)}.pdf`;
    return { blob: doc.output('blob'), nombre };
  },

  descargar({ blob, nombre }) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  },

  /** Intenta compartir el PDF (celular). Si no se puede, lo descarga. Devuelve true si se compartió */
  async compartir(archivo, texto) {
    const file = new File([archivo.blob], archivo.nombre, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Mi registro semanal', text: texto });
        return true;
      } catch (e) {
        if (e.name === 'AbortError') return true;
      }
    }
    this.descargar(archivo);
    return false;
  }
};

/** Link de WhatsApp a partir de un número argentino */
function linkWhatsApp(tel, texto) {
  let n = String(tel || '').replace(/\D/g, '');
  if (!n) return null;
  if (!n.startsWith('54')) n = '549' + n.replace(/^0/, '');
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}
function linkEmail(email, asunto, texto) {
  if (!email) return null;
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(texto)}`;
}

/* ---------- Pantalla Semana ---------- */
Screens.semana = {
  offset: 0,

  init() {
    document.getElementById('semana-prev').addEventListener('click', () => { this.offset--; this.render(); });
    document.getElementById('semana-next').addEventListener('click', () => { if (this.offset < 0) { this.offset++; this.render(); } });
    document.getElementById('semana-metricas').addEventListener('click', e => {
      const ed = e.target.closest('[data-entreno]');
      if (ed) { Actividad.abrir(ed.dataset.entreno); return; }
      if (!e.target.closest('[data-accion="actividad"]')) return;
      // En una semana pasada, por defecto el domingo de esa semana
      const dom = Fechas.clave(Fechas.sumarDias(this.lunes(), 6));
      Actividad.abrir(null, dom < Fechas.clave() ? dom : Fechas.clave());
    });
  },

  lunes() { return Fechas.sumarDias(Fechas.lunes(), this.offset * 7); },

  render() {
    const lunes = this.lunes();
    const d = Semana.datos(lunes);
    document.getElementById('semana-rango').textContent = Fechas.rango(lunes);
    document.getElementById('semana-next').disabled = this.offset >= 0;
    Screens.exportar.lunesElegido = lunes;

    const letras = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    document.getElementById('semana-dias').innerHTML = d.dias.map((dia, i) => {
      const cls = !dia.comidas.length ? '' : dia.ok >= d.nComidas ? 'good' : 'mid';
      return `<div class="day ${dia.esHoy ? 'today' : ''}"><span>${letras[i]}</span>
        <span class="day-dot ${cls}" aria-label="${Fechas.largo(dia.fecha)}: ${dia.ok} de ${d.nComidas} comidas bien">${dia.comidas.length ? dia.ok + '/' + d.nComidas : ''}</span></div>`;
    }).join('');

    const barra = (v, max, color = 'var(--accent)') => `<div class="bar"><div style="width:${Math.min(100, max ? v / max * 100 : 0)}%;background:${color}"></div></div>`;
    const faltantes = d.diasIncompletos.map(x => x.fecha.toLocaleDateString('es-AR', { weekday: 'long' })).join(', ');

    document.getElementById('semana-ayuda').textContent = `Comidas que fueron "va bien" sobre las ${d.nComidas} del día`;
    document.getElementById('semana-metricas').innerHTML = d.limitesSemana.map(l => {
      const tope = l.max != null ? l.max : (l.min || 1);
      return `
      <div class="card metric">
        <div class="row-between"><span>${UI.esc(l.nombre)}</span><b>${l.total} ${l.max != null ? 'de ' + l.max : ''}</b></div>
        ${barra(l.total, tope, Plan.excedido(l, l.total) ? 'var(--warn)' : 'var(--carb)')}
        <small>${l.max != null ? 'Máximo' : 'Mínimo'} semanal según tus pautas</small>
      </div>`;
    }).join('') + `
      <div class="card metric">
        <div class="row-between"><span>Actividad física</span><b>${d.actividad} de ${d.metaActividad}</b></div>
        ${barra(d.actividad, d.metaActividad, 'var(--prot)')}
        ${d.entrenos.length ? `<div class="entrenos">${d.entrenos.map(e => `
          <button type="button" class="entreno" data-entreno="${e.id}" aria-label="Editar: ${UI.esc(Actividad.texto(e))}, ${Fechas.largo(Fechas.desdeClave(e.fecha))}">
            <span class="entreno-dia">${Fechas.desdeClave(e.fecha).toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '')}</span>
            <span class="entreno-txt"><strong>${UI.esc(Actividad.texto(e))}</strong>${e.nota ? `<small>${UI.esc(e.nota)}</small>` : ''}</span>
            <svg><use href="#i-pen"></use></svg>
          </button>`).join('')}</div>` : ''}
        <div class="row-between"><small>${d.entrenos.length ? 'Tocá una para editarla o borrarla' : 'Gym, caminata, natación…'}</small>
          <button type="button" class="mini" data-accion="actividad">+ Registrar</button></div>
      </div>
      <div class="card metric">
        <div class="row-between"><span>Días con 2 L de agua</span><b>${d.diasAgua} de ${d.diasPasados}</b></div>
        ${barra(d.diasAgua, d.diasPasados, 'var(--water)')}
      </div>
      <div class="card metric">
        <div class="row-between"><span>Todas tus comidas cargadas</span><b>${d.diasCompletos} de ${d.diasPasados} días</b></div>
        ${barra(d.diasCompletos, d.diasPasados)}
        ${faltantes ? `<small>Faltaron comidas el ${UI.esc(faltantes)}</small>` : ''}
      </div>`;
  }
};

/* ---------- Pantalla Exportar ---------- */
Screens.exportar = {
  lunesElegido: null,

  init() {
    document.getElementById('exp-semana').addEventListener('change', e => {
      this.lunesElegido = Fechas.desdeClave(e.target.value);
      this.resumen();
    });
    document.getElementById('exp-descargar').addEventListener('click', () => this.generar(false));
    document.getElementById('exp-enviar').addEventListener('click', () => this.generar(true));
  },

  opciones() {
    return {
      comidas: document.getElementById('exp-comidas').checked,
      agua: document.getElementById('exp-agua').checked,
      actividad: document.getElementById('exp-actividad').checked,
      peso: document.getElementById('exp-peso').checked,
      notas: document.getElementById('exp-notas').checked
    };
  },

  async generar(enviar) {
    try {
      const archivo = await Semana.pdf(this.lunesElegido, this.opciones());
      if (!enviar) { Semana.descargar(archivo); UI.toast('PDF descargado'); return; }
      const n = Store.u.nutri;
      const texto = `Hola${n.nombre ? ' ' + n.nombre : ''}, te mando mi registro de la semana ${Fechas.rango(this.lunesElegido)}.`;
      const compartido = await Semana.compartir(archivo, texto);
      if (compartido) return;
      const link = linkWhatsApp(n.telefono, texto + ' (te adjunto el PDF)') || linkEmail(n.email, 'Mi registro semanal', texto + '\n\nTe adjunto el PDF.');
      if (link) { UI.toast('Se descargó el PDF: adjuntalo en el mensaje.', 5000); window.open(link, '_blank'); }
      else UI.toast('Se descargó el PDF. Cargá el contacto de tu nutri en tu perfil para enviarlo directo.', 5000);
    } catch (err) {
      UI.toast(err.message, 5000);
    }
  },

  resumen() {
    const d = Semana.datos(this.lunesElegido);
    document.getElementById('exp-resumen').innerHTML = `
      <strong>Resumen de la semana</strong>
      <div class="grid-3">
        <div class="stat"><span>Comidas ok</span><strong>${d.totalOk}/${d.comidas.length}</strong></div>
        <div class="stat"><span>Agua prom.</span><strong>${UI.litros(Math.round(d.aguaPromedio))}</strong></div>
        <div class="stat"><span>Entrenos</span><strong>${d.actividad}</strong></div>
      </div>`;
  },

  render() {
    if (!this.lunesElegido) this.lunesElegido = Fechas.lunes();
    const actual = Fechas.lunes();
    const opciones = Array.from({ length: 8 }, (_, i) => Fechas.sumarDias(actual, -7 * i));
    const sel = document.getElementById('exp-semana');
    sel.innerHTML = opciones.map(l => `<option value="${Fechas.clave(l)}">${Fechas.rango(l)}${l.getTime() === actual.getTime() ? ' (esta semana)' : ''}</option>`).join('');
    sel.value = Fechas.clave(this.lunesElegido);
    if (!sel.value) { sel.value = Fechas.clave(actual); this.lunesElegido = actual; }
    this.resumen();
  }
};
