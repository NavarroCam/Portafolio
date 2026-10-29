/* ==========================================================
   auth.js — ingreso, registro y configuración inicial
   (salud, nutricionista y pautas en PDF)

   Nota: el login es local (los datos quedan en este
   dispositivo). La contraseña se guarda como hash SHA-256,
   nunca en texto plano.
   ========================================================== */

async function hashPass(email, pass) {
  const datos = new TextEncoder().encode(email.toLowerCase() + '::' + pass);
  const buf = await crypto.subtle.digest('SHA-256', datos);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ---------- Ingresar ---------- */
Screens.login = {
  init() {
    document.getElementById('form-login').addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target;
      const email = f.email.value.trim().toLowerCase();
      const err = document.getElementById('login-error');
      err.textContent = '';
      if (!EMAIL_RE.test(email)) { err.textContent = 'Revisá el email.'; return; }
      if (!Store.existe(email)) { err.textContent = 'No hay una cuenta con ese email en este dispositivo.'; return; }
      const h = await hashPass(email, f.pass.value);
      if (h !== Store.hash(email)) { err.textContent = 'La contraseña no es correcta.'; return; }
      Store.login(email);
      f.reset();
      UI.ir(Store.u.onboarding ? 'hoy' : 'salud');
    });
  }
};

/* ---------- Registro ---------- */
Screens.registro = {
  init() {
    document.getElementById('form-registro').addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target;
      const err = document.getElementById('registro-error');
      err.textContent = '';
      const email = f.email.value.trim().toLowerCase();
      if (!f.nombre.value.trim()) { err.textContent = 'Completá tu nombre.'; return; }
      if (!EMAIL_RE.test(email)) { err.textContent = 'Revisá el email.'; return; }
      if (Store.existe(email)) { err.textContent = 'Ya existe una cuenta con ese email. Ingresá.'; return; }
      if (f.pass.value.length < 8) { err.textContent = 'La contraseña tiene que tener al menos 8 caracteres.'; return; }
      if (f.pass.value !== f.pass2.value) { err.textContent = 'Las contraseñas no coinciden.'; return; }
      if (!f.terminos.checked) { err.textContent = 'Tenés que aceptar para continuar.'; return; }

      Store.crear(email, {
        passHash: await hashPass(email, f.pass.value),
        nombre: f.nombre.value.trim(),
        apellido: f.apellido.value.trim(),
        nacimiento: f.nacimiento.value,
        altura: f.altura.value
      });
      f.reset();
      UI.ir('salud');
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
   Los archivos se leen en paralelo (de a 3). Cada uno guarda las
   reglas que aportó, así al borrarlo se van también sus reglas. */
const MAX_PDF_MB = 25;
const EN_PARALELO = 3;

Screens.pautas = {
  cola: [],      // archivos en proceso: { id, file, nombre, estado: 'esperando'|'leyendo'|'error', error }
  activos: 0,

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
      if (reintentar) {
        const item = this.cola.find(x => x.id === reintentar.dataset.reintentar);
        if (item) { item.estado = 'esperando'; item.error = ''; this.siguiente(); this.render(); }
      }
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
      // Los que quedaron con error no se guardan
      this.cola = this.cola.filter(x => x.estado !== 'error');
      if (!Store.u.onboarding) {
        Store.update(u => { u.onboarding = true; });
        UI.toast('¡Listo! Ya podés cargar tu primera comida.');
        UI.ir('hoy');
      } else {
        UI.ir('perfil');
      }
    });
  },

  pendientes() {
    return this.cola.filter(x => x.estado === 'esperando' || x.estado === 'leyendo').length;
  },

  agregar(files) {
    for (const file of files) {
      const esPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      if (!esPdf) { UI.toast(file.name + ' no es un PDF.'); continue; }
      if (file.size > MAX_PDF_MB * 1024 * 1024) { UI.toast(`${file.name} pesa más de ${MAX_PDF_MB} MB.`); continue; }
      this.cola.push({ id: UI.uid(), file, nombre: file.name, estado: 'esperando', error: '' });
    }
    this.siguiente();
    this.render();
  },

  /** Arranca los archivos en espera, de a EN_PARALELO */
  siguiente() {
    while (this.activos < EN_PARALELO) {
      const item = this.cola.find(x => x.estado === 'esperando');
      if (!item) break;
      this.procesar(item);
    }
  },

  async procesar(item) {
    item.estado = 'leyendo';
    this.activos++;
    this.render();
    try {
      const r = await Api.leerPautas(item.file);
      if (!this.cola.includes(item)) return; // lo borraron mientras se leía
      const nuevas = (Array.isArray(r.reglas) ? r.reglas : []).map(x => String(x).trim()).filter(Boolean);
      Store.update(u => {
        const set = new Set(u.pautas.reglas.map(x => x.toLowerCase()));
        nuevas.forEach(t => {
          if (!set.has(t.toLowerCase())) { u.pautas.reglas.push(t); set.add(t.toLowerCase()); }
        });
        u.pautas.archivos.push({ id: item.id, nombre: item.nombre, fecha: new Date().toISOString(), reglas: nuevas });
      });
      this.cola = this.cola.filter(x => x !== item);
      if (!nuevas.length) UI.toast(`No encontré pautas en ${item.nombre}.`);
    } catch (err) {
      item.estado = 'error';
      item.error = err.message;
    } finally {
      this.activos--;
      this.siguiente();
      this.render();
    }
  },

  borrar(id, silencioso = false) {
    const enCola = this.cola.find(x => x.id === id);
    if (enCola) {
      this.cola = this.cola.filter(x => x !== enCola);
      this.render();
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
        texto: x.estado === 'error' ? 'Error' : x.estado === 'leyendo' ? 'Leyendo…' : 'En espera'
      }))
    ];

    document.getElementById('pautas-archivos').innerHTML = filas.map(f => `
      <li class="file-row ${f.estado === 'error' ? 'file-row--error' : ''}">
        <span class="file-ico">PDF</span>
        <span class="file-main">
          <span class="name">${UI.esc(f.nombre)}</span>
          <span class="file-status">
            ${f.estado === 'leyendo' ? '<span class="spinner spinner--sm" aria-hidden="true"></span>' : ''}
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
