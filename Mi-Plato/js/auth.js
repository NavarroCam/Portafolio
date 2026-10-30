/* ==========================================================
   auth.js — ingreso, registro y configuración inicial
   (salud, nutricionista y pautas en PDF)

   La cuenta vive en Supabase (ver nube.js): podés entrar con
   el mismo email y contraseña desde cualquier dispositivo.
   ========================================================== */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function ocupado(btn, si, texto) {
  if (si) { btn.dataset.texto = btn.textContent; btn.textContent = texto; btn.disabled = true; }
  else { btn.textContent = btn.dataset.texto || btn.textContent; btn.disabled = false; }
}

function mostrarMensaje(el, texto, aviso) {
  el.textContent = texto;
  el.classList.toggle('form-aviso', !!aviso);
}

/* ---------- Ingresar ---------- */
Screens.login = {
  init() {
    document.getElementById('form-login').addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target;
      const email = f.email.value.trim().toLowerCase();
      const err = document.getElementById('login-error');
      mostrarMensaje(err, '');
      if (Nube.estado === 'sin-config') { mostrarMensaje(err, 'La app todavía no está conectada a la nube (faltan las variables de Supabase en Vercel).'); return; }
      if (!EMAIL_RE.test(email)) { mostrarMensaje(err, 'Revisá el email.'); return; }
      if (!f.pass.value) { mostrarMensaje(err, 'Escribí tu contraseña.'); return; }
      const btn = f.querySelector('button[type=submit]');
      ocupado(btn, true, 'Ingresando…');
      try {
        const r = await Nube.ingresar(email, f.pass.value);
        if (!r.ok) { mostrarMensaje(err, r.error, r.aviso); return; }
        f.reset();
        if (r.migrado) UI.toast('¡Listo! Tu cuenta y tus datos ya están en la nube.', 4500);
        UI.ir(Store.u.onboarding ? 'hoy' : 'salud');
      } catch (er) {
        mostrarMensaje(err, Nube.traducir(er));
      } finally {
        ocupado(btn, false);
      }
    });

    document.getElementById('login-olvide').addEventListener('click', async () => {
      const email = document.getElementById('login-email').value.trim().toLowerCase();
      const err = document.getElementById('login-error');
      if (!EMAIL_RE.test(email)) { mostrarMensaje(err, 'Escribí tu email arriba y volvé a tocar "Me olvidé la contraseña".'); return; }
      try {
        await Nube.recuperar(email);
        mostrarMensaje(err, `Te mandamos un mail a ${email} para crear una contraseña nueva.`, true);
      } catch (er) { mostrarMensaje(err, er.message); }
    });
  },

  render() {
    document.getElementById('login-legado').hidden = !Legado.hay();
    const err = document.getElementById('login-error');
    if (Nube.estado === 'sin-config') mostrarMensaje(err, 'La app todavía no está conectada a la nube (faltan las variables de Supabase en Vercel).');
  }
};

/* ---------- Registro ---------- */
Screens.registro = {
  init() {
    document.getElementById('form-registro').addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target;
      const err = document.getElementById('registro-error');
      mostrarMensaje(err, '');
      const email = f.email.value.trim().toLowerCase();
      if (!f.nombre.value.trim()) { mostrarMensaje(err, 'Completá tu nombre.'); return; }
      if (!EMAIL_RE.test(email)) { mostrarMensaje(err, 'Revisá el email.'); return; }
      if (f.pass.value.length < 8) { mostrarMensaje(err, 'La contraseña tiene que tener al menos 8 caracteres.'); return; }
      if (f.pass.value !== f.pass2.value) { mostrarMensaje(err, 'Las contraseñas no coinciden.'); return; }
      if (!f.terminos.checked) { mostrarMensaje(err, 'Tenés que aceptar para continuar.'); return; }
      if (Nube.estado === 'sin-config') { mostrarMensaje(err, 'La app todavía no está conectada a la nube (faltan las variables de Supabase en Vercel).'); return; }

      const perfil = {
        nombre: f.nombre.value.trim(),
        apellido: f.apellido.value.trim(),
        apodo: f.apodo.value.trim(),
        nacimiento: f.nacimiento.value,
        altura: f.altura.value
      };
      const btn = f.querySelector('button[type=submit]');
      ocupado(btn, true, 'Creando cuenta…');
      try {
        const r = await Nube.registrar(email, f.pass.value, perfil);
        if (!r.ok) { mostrarMensaje(err, r.error, r.aviso); return; }
        f.reset();
        UI.ir('salud');
      } catch (er) {
        mostrarMensaje(err, Nube.traducir(er));
      } finally {
        ocupado(btn, false);
      }
    });
  }
};

/* ---------- Condiciones de salud ---------- */
const CONDICIONES = [
  'Hipotiroidismo', 'Hipertiroidismo', 'Diabetes tipo 1', 'Diabetes tipo 2',
  'Resistencia a la insulina', 'Hipertensión', 'Colesterol alto', 'Celiaquía',
  'Intolerancia a la lactosa', 'Ninguna'
];

Screens.salud = {
  seleccion: new Set(),

  init() {
    const cont = document.getElementById('salud-chips');
    cont.innerHTML = CONDICIONES.map(c =>
      `<button type="button" class="chip" data-c="${UI.esc(c)}" aria-pressed="false">${UI.esc(c)}</button>`
    ).join('');

    cont.addEventListener('click', e => {
      const b = e.target.closest('.chip');
      if (!b) return;
      const c = b.dataset.c;
      if (this.seleccion.has(c)) this.seleccion.delete(c);
      else {
        if (c === 'Ninguna') this.seleccion.clear();
        else this.seleccion.delete('Ninguna');
        this.seleccion.add(c);
      }
      this.pintarChips();
    });

    document.getElementById('form-salud').addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      Store.update(u => {
        u.salud.condiciones = [...this.seleccion].filter(c => c !== 'Ninguna');
        u.salud.otra = f.otra.value.trim();
        u.salud.alergias = f.alergias.value.trim();
      });
      if (Store.u.onboarding) { UI.toast('Guardado'); UI.ir('perfil'); }
      else UI.ir('nutri');
    });
  },

  pintarChips() {
    document.querySelectorAll('#salud-chips .chip').forEach(b => {
      const on = this.seleccion.has(b.dataset.c);
      b.setAttribute('aria-pressed', on);
      b.innerHTML = (on ? '<svg><use href="#i-check"></use></svg>' : '') + UI.esc(b.dataset.c);
    });
  },

  render() {
    const s = Store.u.salud;
    this.seleccion = new Set(s.condiciones);
    this.pintarChips();
    const f = document.getElementById('form-salud');
    f.otra.value = s.otra || '';
    f.alergias.value = s.alergias || '';
  }
};

/* ---------- Nutricionista ---------- */
Screens.nutri = {
  init() {
    const f = document.getElementById('form-nutri');
    f.addEventListener('change', e => {
      if (e.target.name === 'tiene') this.toggleCampos();
    });
    f.addEventListener('submit', e => {
      e.preventDefault();
      const err = document.getElementById('nutri-error');
      err.textContent = '';
      const tiene = f.tiene.value === 'si';
      const tel = f.telefono.value.trim();
      const mail = f.email.value.trim();
      if (tiene && !tel && !mail) {
        err.textContent = 'Cargá su WhatsApp o su email para poder consultarle directo desde la app.';
        return;
      }
      if (mail && !EMAIL_RE.test(mail)) { err.textContent = 'Revisá el email de tu nutricionista.'; return; }
      Store.update(u => {
        u.nutri = {
          tiene,
          nombre: f.nombre.value.trim(),
          telefono: tel,
          email: mail,
          proximo: f.proximo.value,
          frecuencia: f.frecuencia.value,
          objetivo: f.objetivo.value.trim()
        };
      });
      if (Store.u.onboarding) { UI.toast('Guardado'); UI.ir('perfil'); }
      else UI.ir('pautas');
    });
  },

  toggleCampos() {
    const f = document.getElementById('form-nutri');
    document.getElementById('nutri-campos').hidden = f.tiene.value !== 'si';
  },

  render() {
    const n = Store.u.nutri;
    const f = document.getElementById('form-nutri');
    f.tiene.value = n.tiene ? 'si' : 'no';
    f.nombre.value = n.nombre || '';
    f.telefono.value = n.telefono || '';
    f.email.value = n.email || '';
    f.proximo.value = n.proximo || '';
    f.frecuencia.value = n.frecuencia || 'Cada 15 días';
    f.objetivo.value = n.objetivo || '';
    this.toggleCampos();
  }
};

/* ---------- Pautas (PDF) ----------
   1) Cada PDF se lee en el celular (texto o fotos de páginas), de a 3.
   2) Cuando todos están preparados, se mandan JUNTOS a Gemini en un solo
      pedido, así no se pasa el límite por minuto del plan gratuito.
   Cada archivo guarda las reglas que aportó: al borrarlo se van sus reglas. */
const MAX_PDF_MB = 25;
const EN_PARALELO = 3;
const MAX_LOTE_BYTES = 3.2 * 1024 * 1024;

Screens.pautas = {
  // estado: 'esperando' → 'preparando' → 'listo' → 'leyendo' → (se guarda) | 'error'
  cola: [],
  preparando: 0,
  enviando: false,

  init() {
    document.getElementById('pautas-input').addEventListener('change', e => {
      const files = [...e.target.files];
      e.target.value = '';
      this.agregar(files);
    });

    document.getElementById('pautas-archivos').addEventListener('click', e => {
      const borrar = e.target.closest('[data-borrar]');
      if (borrar) { this.borrar(borrar.dataset.borrar); return; }
      const reintentar = e.target.closest('[data-reintentar]');
      if (reintentar) this.reintentar(reintentar.dataset.reintentar);
    });

    document.getElementById('pautas-borrar-todo').addEventListener('click', () => {
      const total = Store.u.pautas.archivos.length + this.cola.length;
      if (!total) return;
      if (!confirm(`¿Eliminar ${total === 1 ? 'el documento' : 'los ' + total + ' documentos'} y las reglas que salieron de ${total === 1 ? 'él' : 'ellos'}?`)) return;
      this.cola = [];
      [...Store.u.pautas.archivos].forEach(a => this.borrar(a.id || a.nombre, true));
      UI.toast('Documentos eliminados');
      this.render();
    });

    document.getElementById('pautas-reglas').addEventListener('click', e => {
      const b = e.target.closest('button[data-i]');
      if (!b) return;
      Store.update(u => { u.pautas.reglas.splice(Number(b.dataset.i), 1); });
      this.render();
    });

    document.getElementById('form-regla').addEventListener('submit', e => {
      e.preventDefault();
      const input = document.getElementById('regla-nueva');
      const t = input.value.trim();
      if (!t) return;
      Store.update(u => { u.pautas.reglas.push(t); });
      input.value = '';
      this.render();
    });

    document.getElementById('pautas-listo').addEventListener('click', () => {
      if (this.pendientes() > 0) return;
      this.cola = this.cola.filter(x => x.estado !== 'error');
      if (!Store.u.onboarding) {
        Store.update(u => { u.onboarding = true; });
        UI.toast(`¡Listo${nombreCorto() ? ', ' + nombreCorto() : ''}! Ya podés cargar tu primera comida.`);
        UI.ir('hoy');
      } else {
        UI.ir('perfil');
      }
    });
  },

  /** Comidas y límites que detectó Gemini en los PDFs */
  aplicarPlan(r) {
    const { plan, lim } = Plan.desdeDetectado(r.comidas || [], r.limites || []);
    if (!plan.length && !lim.length) return;
    const editado = Store.u.planEditado;
    Store.update(u => {
      u.pautas.sugerido = { comidas: plan, limites: lim, fecha: new Date().toISOString(), aplicado: !editado };
      // Si nunca editó sus comidas a mano, las armamos directamente con lo que dicen sus pautas
      if (!editado) {
        if (plan.length) u.comidasPlan = plan;
        if (lim.length) u.limites = lim;
      }
    });
    if (!editado) UI.toast(`Armé tus ${Plan.comidas().length} comidas con tus pautas. Podés revisarlas en "Mis comidas".`, 4500);
    else UI.toast('En tus PDFs encontré comidas y límites: los podés usar desde "Mis comidas".', 4500);
  },

  pendientes() {
    return this.cola.filter(x => x.estado !== 'error').length;
  },

  agregar(files) {
    for (const file of files) {
      const esPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      if (!esPdf) { UI.toast(file.name + ' no es un PDF.'); continue; }
      if (file.size > MAX_PDF_MB * 1024 * 1024) { UI.toast(`${file.name} pesa más de ${MAX_PDF_MB} MB.`); continue; }
      this.cola.push({ id: UI.uid(), file, nombre: file.name, estado: 'esperando', error: '', contenido: null });
    }
    this.preparar();
    this.render();
  },

  reintentar(id) {
    const item = this.cola.find(x => x.id === id);
    if (!item) return;
    item.error = '';
    item.estado = item.contenido ? 'listo' : 'esperando';
    this.preparar();
    this.enviar();
    this.render();
  },

  /** Paso 1: leer los PDF en el celular */
  preparar() {
    while (this.preparando < EN_PARALELO) {
      const item = this.cola.find(x => x.estado === 'esperando');
      if (!item) break;
      item.estado = 'preparando';
      this.preparando++;
      Api.prepararPDF(item.file)
        .then(contenido => { item.contenido = contenido; item.estado = 'listo'; })
        .catch(err => { item.estado = 'error'; item.error = err.message; })
        .finally(() => {
          this.preparando--;
          this.preparar();
          this.enviar();
          this.render();
        });
    }
  },

  /** Paso 2: mandar a Gemini todos los preparados juntos */
  async enviar() {
    if (this.enviando) return;
    // Esperamos a que terminen de prepararse todos, para mandarlos en un solo pedido
    if (this.cola.some(x => x.estado === 'esperando' || x.estado === 'preparando')) return;
    const listos = this.cola.filter(x => x.estado === 'listo');
    if (!listos.length) return;

    // Armamos un lote que no supere el tamaño que acepta el servidor
    const lote = [];
    let peso = 0;
    for (const item of listos) {
      const p = JSON.stringify(item.contenido).length;
      if (lote.length && peso + p > MAX_LOTE_BYTES) break;
      lote.push(item);
      peso += p;
    }

    this.enviando = true;
    lote.forEach(x => { x.estado = 'leyendo'; });
    this.render();
    try {
      const r = await Api.leerPautasLote(lote.map(x => ({ id: x.id, nombre: x.nombre, ...x.contenido })));
      const porId = {};
      (r.documentos || []).forEach(d => { porId[d.id] = Array.isArray(d.reglas) ? d.reglas : []; });
      const sinPautas = [];
      Store.update(u => {
        const set = new Set(u.pautas.reglas.map(x => x.toLowerCase()));
        for (const item of lote) {
          if (!this.cola.includes(item)) continue; // lo borraron mientras se leía
          const nuevas = (porId[item.id] || []).map(x => String(x).trim()).filter(Boolean);
          nuevas.forEach(t => {
            if (!set.has(t.toLowerCase())) { u.pautas.reglas.push(t); set.add(t.toLowerCase()); }
          });
          u.pautas.archivos.push({ id: item.id, nombre: item.nombre, fecha: new Date().toISOString(), reglas: nuevas });
          if (!nuevas.length) sinPautas.push(item.nombre);
        }
      });
      this.cola = this.cola.filter(x => !lote.includes(x));
      if (sinPautas.length) UI.toast(`No encontré pautas en ${sinPautas.join(', ')}.`, 4500);
      this.aplicarPlan(r);
    } catch (err) {
      lote.forEach(x => { if (x.estado === 'leyendo') { x.estado = 'error'; x.error = err.message; } });
    } finally {
      this.enviando = false;
      this.render();
      this.enviar(); // si quedaron más (lote grande o agregados mientras tanto)
    }
  },

  borrar(id, silencioso = false) {
    const enCola = this.cola.find(x => x.id === id);
    if (enCola) {
      this.cola = this.cola.filter(x => x !== enCola);
      this.render();
      this.enviar(); // por si era el único que faltaba preparar
      return;
    }
    Store.update(u => {
      const arch = u.pautas.archivos.find(a => (a.id || a.nombre) === id);
      if (!arch) return;
      u.pautas.archivos = u.pautas.archivos.filter(a => a !== arch);
      // Quitamos sus reglas, salvo las que también vienen de otro archivo
      const propias = Array.isArray(arch.reglas) ? arch.reglas.map(x => x.toLowerCase()) : [];
      const deOtros = new Set(u.pautas.archivos.flatMap(a => Array.isArray(a.reglas) ? a.reglas.map(x => x.toLowerCase()) : []));
      u.pautas.reglas = u.pautas.reglas.filter(r => !propias.includes(r.toLowerCase()) || deOtros.has(r.toLowerCase()));
    });
    if (!silencioso) { UI.toast('Documento eliminado'); this.render(); }
  },

  render() {
    const p = Store.u.pautas;
    const filas = [
      ...p.archivos.map(a => ({
        id: a.id || a.nombre, nombre: a.nombre, estado: 'listo',
        texto: `${Array.isArray(a.reglas) ? a.reglas.length : a.reglas} reglas`
      })),
      ...this.cola.map(x => ({
        id: x.id, nombre: x.nombre, estado: x.estado, error: x.error,
        texto: x.estado === 'error' ? 'Error'
          : x.estado === 'leyendo' ? 'Sacando reglas…'
          : x.estado === 'preparando' ? 'Abriendo…'
          : x.estado === 'listo' ? 'Preparado'
          : 'En espera'
      }))
    ];

    document.getElementById('pautas-archivos').innerHTML = filas.map(f => `
      <li class="file-row ${f.estado === 'error' ? 'file-row--error' : ''}">
        <span class="file-ico">PDF</span>
        <span class="file-main">
          <span class="name">${UI.esc(f.nombre)}</span>
          <span class="file-status">
            ${f.estado === 'leyendo' || f.estado === 'preparando' ? '<span class="spinner spinner--sm" aria-hidden="true"></span>' : ''}
            <span class="tag ${f.estado === 'listo' ? 'tag--ok' : f.estado === 'error' ? 'tag--warn' : 'tag--muted'}">${UI.esc(f.texto)}</span>
            ${f.estado === 'error' ? `<button type="button" class="link-btn" data-reintentar="${f.id}">Reintentar</button>` : ''}
          </span>
          ${f.error ? `<span class="file-error">${UI.esc(f.error)}</span>` : ''}
        </span>
        <button type="button" class="del-btn" data-borrar="${UI.esc(f.id)}" aria-label="Eliminar ${UI.esc(f.nombre)}"><svg><use href="#i-trash"></use></svg><span>Eliminar</span></button>
      </li>`).join('');

    document.getElementById('pautas-reglas').innerHTML = p.reglas.map((r, i) => `
      <li>${UI.esc(r)}<button type="button" data-i="${i}" aria-label="Quitar regla: ${UI.esc(r)}">×</button></li>`).join('');

    document.getElementById('pautas-borrar-todo').hidden = filas.length < 2;

    // Resumen de comidas y límites (se arman solos con los PDFs)
    const resumen = document.getElementById('pautas-plan');
    resumen.hidden = !(Store.u.comidasPlan || Plan.limites().length);
    if (!resumen.hidden) {
      resumen.innerHTML = `
        <div class="row-between"><strong>Tus comidas</strong><a class="link-btn" href="#mis-comidas">Revisar</a></div>
        <span class="small">${UI.esc(Plan.comidas().map(c => `${c.nombre} ${horaLinda(c.hora)}`).join(' · '))}</span>
        ${Plan.limites().length ? `<span class="small muted">Límites: ${UI.esc(Plan.limites().map(l => `${l.nombre} ${Plan.objetivo(l)}`).join(' · '))}</span>` : ''}`;
    }

    const pend = this.pendientes();
    const btn = document.getElementById('pautas-listo');
    btn.disabled = pend > 0;
    btn.textContent = pend > 0
      ? `Leyendo ${pend} archivo${pend > 1 ? 's' : ''}…`
      : (Store.u.onboarding ? 'Volver' : 'Listo, empezar');
    const errores = this.cola.filter(x => x.estado === 'error').length;
    document.getElementById('pautas-aviso').textContent = pend > 0
      ? 'Podés seguir agregando archivos o reglas mientras tanto.'
      : errores ? `${errores} archivo${errores > 1 ? 's' : ''} con error: reintentá o eliminalo${errores > 1 ? 's' : ''}. Si seguís, no se van a usar.` : '';
  }
};
