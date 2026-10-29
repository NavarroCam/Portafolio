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

/* ---------- Pautas (PDF) ---------- */
Screens.pautas = {
  leyendo: {}, // nombre de archivo -> estado mientras se procesa

  init() {
    document.getElementById('pautas-input').addEventListener('change', async e => {
      const files = [...e.target.files];
      e.target.value = '';
      for (const file of files) await this.procesar(file);
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
      if (!Store.u.onboarding) {
        Store.update(u => { u.onboarding = true; });
        UI.toast('¡Listo! Ya podés cargar tu primera comida.');
        UI.ir('hoy');
      } else {
        UI.ir('perfil');
      }
    });
  },

  async procesar(file) {
    if (file.type !== 'application/pdf') { UI.toast(file.name + ' no es un PDF.'); return; }
    if (file.size > 3 * 1024 * 1024) { UI.toast(file.name + ' pesa más de 3 MB.'); return; }
    this.leyendo[file.name] = 'Leyendo…';
    this.render();
    try {
      const dataURL = await Api.leerComoDataURL(file);
      const r = await Api.leerPautas(dataURL, file.name);
      const nuevas = Array.isArray(r.reglas) ? r.reglas : [];
      Store.update(u => {
        const set = new Set(u.pautas.reglas.map(x => x.toLowerCase()));
        nuevas.forEach(x => {
          const t = String(x).trim();
          if (t && !set.has(t.toLowerCase())) { u.pautas.reglas.push(t); set.add(t.toLowerCase()); }
        });
        u.pautas.archivos = u.pautas.archivos.filter(a => a.nombre !== file.name);
        u.pautas.archivos.push({ nombre: file.name, fecha: new Date().toISOString(), reglas: nuevas.length });
      });
      delete this.leyendo[file.name];
      UI.toast(`Encontré ${nuevas.length} reglas en ${file.name}`);
    } catch (err) {
      this.leyendo[file.name] = 'Error';
      UI.toast(err.message, 6000);
    }
    this.render();
  },

  render() {
    const p = Store.u.pautas;
    const archivos = p.archivos.map(a => ({ nombre: a.nombre, estado: `${a.reglas} reglas`, ok: true }));
    Object.entries(this.leyendo).forEach(([nombre, estado]) => {
      if (!archivos.some(a => a.nombre === nombre)) archivos.push({ nombre, estado, ok: false });
    });
    document.getElementById('pautas-archivos').innerHTML = archivos.map(a => `
      <li class="file-row">
        <span class="file-ico">PDF</span>
        <span class="name">${UI.esc(a.nombre)}</span>
        <span class="tag ${a.ok ? 'tag--ok' : 'tag--muted'}">${UI.esc(a.estado)}</span>
      </li>`).join('');

    document.getElementById('pautas-reglas').innerHTML = p.reglas.map((r, i) => `
      <li>${UI.esc(r)}<button type="button" data-i="${i}" aria-label="Quitar regla: ${UI.esc(r)}">×</button></li>`).join('');

    document.getElementById('pautas-listo').textContent = Store.u.onboarding ? 'Volver' : 'Listo, empezar';
  }
};
