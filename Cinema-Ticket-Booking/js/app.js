/* ==========================================================
   app.js — Navegación y pantallas
   Flujo: Login → Cine → Película → Formato → Día → Horario
          → Entradas → Butacas → Confirmar → Comprobante
   ========================================================== */
window.CineApp = window.CineApp || {};

(function (C) {
  'use strict';

  const $app = document.getElementById('app');

  const STEPS = [
    { id: 'cinema',  label: 'Cine' },
    { id: 'movie',   label: 'Película' },
    { id: 'format',  label: 'Formato' },
    { id: 'day',     label: 'Día' },
    { id: 'time',    label: 'Horario' },
    { id: 'qty',     label: 'Entradas' },
    { id: 'seats',   label: 'Butacas' },
    { id: 'confirm', label: 'Confirmar' }
  ];

  /* ---------- Estado de la app ---------- */
  const S = {
    user: C.auth.current(),
    movies: [],
    source: null,
    moviesReady: false,
    step: 'cinema',
    cinema: null, movie: null, option: null, date: null, show: null,
    qty: 2,
    seats: [],
    booking: null,
    qrDataUrl: null,
    authTab: 'login',
    authError: null,
    zoom: 1
  };

  /* ---------- Helpers ---------- */
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const stepIndex = id => STEPS.findIndex(s => s.id === id);

  const POSTER_TONES = [
    ['#5a0d18', '#140507'], ['#1f2447', '#07080f'], ['#113a36', '#040d0c'],
    ['#4a3310', '#0f0a03'], ['#3a1447', '#0b040e'], ['#123049', '#03090f']
  ];

  function poster(movie, cls) {
    if (movie.poster) {
      return '<div class="poster ' + (cls || '') + '"><img src="' + esc(movie.poster) +
        '" alt="Poster de ' + esc(movie.title) + '" loading="lazy" onerror="this.parentNode.classList.add(\'poster--broken\');this.remove()"><span class="poster-title">' + esc(movie.title) + '</span></div>';
    }
    const [a, b] = POSTER_TONES[C.hash(String(movie.id)) % POSTER_TONES.length];
    return '<div class="poster poster--gen ' + (cls || '') + '" style="--pa:' + a + ';--pb:' + b + '" role="img" aria-label="Poster de ' + esc(movie.title) + '">' +
      '<span class="poster-genre">' + esc((movie.genres || [])[0] || 'Estreno') + '</span>' +
      '<span class="poster-title">' + esc(movie.title) + '</span></div>';
  }

  function movieMeta(m) {
    const bits = [];
    if (m.rating) bits.push('<span class="tag tag--rating">' + esc(m.rating) + '</span>');
    if (m.runtime) bits.push('<span class="meta">' + Math.floor(m.runtime / 60) + ' h ' + String(m.runtime % 60).padStart(2, '0') + ' min</span>');
    if (m.genres && m.genres.length) bits.push('<span class="meta">' + esc(m.genres.slice(0, 2).join(' · ')) + '</span>');
    return bits.join('');
  }

  function unitPrice() { return S.option ? S.option.price : 0; }

  /* ---------- Cambios de selección (resetean lo que depende) ---------- */
  function resetFrom(step) {
    const order = ['cinema', 'movie', 'option', 'date', 'show', 'qty', 'seats'];
    const start = order.indexOf(step);
    order.slice(start).forEach(k => {
      if (k === 'qty') S.qty = 2;
      else if (k === 'seats') S.seats = [];
      else S[k] = null;
    });
  }

  function go(step) {
    S.step = step;
    render();
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    const h = $app.querySelector('h1');
    if (h) h.focus({ preventScroll: true });
  }

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(msg) {
    let t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.className = 'toast';
      t.setAttribute('role', 'status');
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('toast--show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('toast--show'), 2800);
  }

  /* ==========================================================
     LOGIN
     ========================================================== */
  function viewLogin() {
    const isLogin = S.authTab === 'login';
    const err = S.authError || {};
    const errFor = f => err.field === f ? '<p class="field-error" id="err-' + f + '">' + esc(err.error) + '</p>' : '';
    const inv = f => err.field === f ? ' aria-invalid="true" aria-describedby="err-' + f + '"' : '';

    // mini butacas decorativas
    let deco = '';
    for (let r = 0; r < 5; r++) {
      deco += '<div class="deco-row">';
      for (let i = 0; i < 9; i++) {
        const on = (r === 2 && (i === 4 || i === 5));
        const off = C.hash('deco' + r + i) % 3 === 0;
        deco += '<i class="' + (on ? 'on' : off ? 'off' : '') + '"></i>';
      }
      deco += '</div>';
    }

    return (
      '<main class="login">' +
        '<section class="login-art" aria-hidden="true">' +
          '<div class="brand brand--lg">CINE<b>APP</b></div>' +
          '<p class="login-kicker">Funciones · Butacas · Entradas</p>' +
          '<h2 class="login-headline">Tu butaca<br>te espera.</h2>' +
          '<div class="deco-screen"></div>' +
          '<div class="deco-seats">' + deco + '</div>' +
        '</section>' +
        '<section class="login-panel">' +
          '<div class="brand brand--sm">CINE<b>APP</b></div>' +
          '<h1 tabindex="-1">' + (isLogin ? 'Ingresá a tu cuenta' : 'Creá tu cuenta') + '</h1>' +
          '<p class="muted">' + (isLogin ? 'Para comprar entradas necesitás iniciar sesión.' : 'Solo te pedimos un email y una contraseña.') + '</p>' +
          '<div class="tabs" role="tablist">' +
            '<button type="button" role="tab" aria-selected="' + isLogin + '" data-action="auth-tab" data-tab="login">Ingresar</button>' +
            '<button type="button" role="tab" aria-selected="' + !isLogin + '" data-action="auth-tab" data-tab="register">Crear cuenta</button>' +
          '</div>' +
          '<form id="auth-form" class="auth-form" novalidate>' +
            '<label class="field"><span>Email</span>' +
              '<input id="auth-email" name="email" type="email" autocomplete="email" inputmode="email" placeholder="nombre@dominio.com"' + inv('email') + '></label>' +
            errFor('email') +
            '<label class="field"><span>Contraseña</span>' +
              '<div class="pw-wrap"><input id="auth-password" name="password" type="password" autocomplete="' + (isLogin ? 'current-password' : 'new-password') + '" placeholder="Mínimo 6 caracteres"' + inv('password') + '>' +
              '<button type="button" class="pw-toggle" data-action="toggle-pw" aria-label="Mostrar contraseña">Ver</button></div></label>' +
            errFor('password') +
            (isLogin ? '' :
              '<label class="field"><span>Repetí la contraseña</span>' +
              '<input id="auth-confirm" name="confirm" type="password" autocomplete="new-password"' + inv('confirm') + '></label>' + errFor('confirm')) +
            '<button type="submit" class="btn btn--primary btn--block">' + (isLogin ? 'Ingresar' : 'Crear cuenta e ingresar') + '</button>' +
          '</form>' +
          (isLogin ?
            '<div class="demo-hint"><span>¿Querés probar rápido?</span>' +
            '<button type="button" class="link" data-action="fill-demo">Usar cuenta demo</button>' +
            '<code>' + C.auth.DEMO.email + ' · ' + C.auth.DEMO.password + '</code></div>' : '') +
        '</section>' +
      '</main>'
    );
  }

  /* ==========================================================
     SHELL (header, pasos, resumen de elecciones)
     ========================================================== */
  function viewHeader() {
    return (
      '<header class="topbar">' +
        '<button type="button" class="brand brand--btn" data-action="home" aria-label="Ir al inicio">CINE<b>APP</b></button>' +
        '<div class="user">' +
          '<span class="user-email" title="' + esc(S.user.email) + '">' + esc(S.user.email) + '</span>' +
          '<button type="button" class="btn btn--ghost btn--sm" data-action="logout">Salir</button>' +
        '</div>' +
      '</header>'
    );
  }

  function viewStepper() {
    const cur = stepIndex(S.step);
    const items = STEPS.map((s, i) => {
      const state = i < cur ? 'done' : i === cur ? 'current' : 'todo';
      const clickable = i < cur;
      return '<li class="step step--' + state + '">' +
        (clickable
          ? '<button type="button" data-action="goto" data-step="' + s.id + '"><i>' + (i + 1) + '</i><span>' + s.label + '</span></button>'
          : '<span class="step-inner"' + (state === 'current' ? ' aria-current="step"' : '') + '><i>' + (i + 1) + '</i><span>' + s.label + '</span></span>') +
        '</li>';
    }).join('');
    return (
      '<nav class="stepper" aria-label="Pasos de la compra">' +
        '<p class="stepper-mobile">Paso ' + (cur + 1) + ' de ' + STEPS.length + ' · <b>' + STEPS[cur].label + '</b></p>' +
        '<div class="stepper-bar"><span style="width:' + ((cur + 1) / STEPS.length * 100) + '%"></span></div>' +
        '<ol>' + items + '</ol>' +
      '</nav>'
    );
  }

  function viewChips() {
    const chips = [];
    if (S.cinema) chips.push(['cinema', 'Cine', S.cinema.name.replace('Cinemark ', '')]);
    if (S.movie) chips.push(['movie', 'Película', S.movie.title]);
    if (S.option) chips.push(['format', 'Formato', S.option.format + ' ' + S.option.lang]);
    if (S.date) chips.push(['day', 'Día', C.dayLabel(C.parseIso(S.date))]);
    if (S.show) chips.push(['time', 'Horario', S.show.time + ' h']);
    if (stepIndex(S.step) > stepIndex('qty')) chips.push(['qty', 'Entradas', S.qty]);
    if (!chips.length) return '';
    return '<div class="chips" aria-label="Tu selección">' + chips.map(([step, k, v]) =>
      '<button type="button" class="chip" data-action="goto" data-step="' + step + '" title="Cambiar ' + k.toLowerCase() + '">' +
      '<small>' + k + '</small><span>' + esc(v) + '</span></button>').join('') + '</div>';
  }

  function stepHead(title, sub) {
    const cur = stepIndex(S.step);
    return (
      '<div class="step-head">' +
        (cur > 0 ? '<button type="button" class="back" data-action="back" aria-label="Volver al paso anterior">← Volver</button>' : '') +
        '<h1 tabindex="-1">' + title + '</h1>' +
        (sub ? '<p class="muted">' + sub + '</p>' : '') +
      '</div>'
    );
  }

  function viewFooter() {
    return (
      '<footer class="foot">' +
        '<p>CineApp es un proyecto educativo ilustrativo, sin afiliación con Cinemark. Los horarios, salas y precios son simulados.</p>' +
        '<p>Datos de películas: <a href="https://www.themoviedb.org/" target="_blank" rel="noopener">TMDB</a>. This product uses the TMDB API but is not endorsed or certified by TMDB.</p>' +
      '</footer>'
    );
  }

  /* ==========================================================
     PASOS
     ========================================================== */
  function viewCinema() {
    const cards = C.CINEMAS.map(c =>
      '<button type="button" class="cinema-card" data-action="pick-cinema" data-id="' + c.id + '">' +
        '<span class="cinema-name">' + esc(c.name) + '</span>' +
        (c.former ? '<span class="cinema-former">' + esc(c.former) + '</span>' : '') +
        '<span class="cinema-place">' + esc(c.address ? c.address + ' · ' : '') + esc(c.place) + '</span>' +
        '<span class="cinema-area">' + esc(c.area) + '</span>' +
        '<span class="cinema-formats">' + c.formats.map(f => '<span class="fmt fmt--' + f + '">' + f + '</span>').join('') + '</span>' +
      '</button>').join('');
    return stepHead('¿A qué cine vas?', 'Elegí el complejo y te mostramos su cartelera.') +
      '<div class="cinema-grid">' + cards + '</div>';
  }

  function viewMovie() {
    if (!S.moviesReady) {
      return stepHead('Cartelera de ' + esc(S.cinema.name), 'Cargando películas…') +
        '<div class="movie-grid">' + '<div class="movie-card skeleton"></div>'.repeat(8) + '</div>';
    }
    const list = C.moviesForCinema(S.cinema, S.movies);
    const cards = list.map(m =>
      '<button type="button" class="movie-card" data-action="pick-movie" data-id="' + esc(m.id) + '">' +
        poster(m) +
        '<span class="movie-info"><span class="movie-title">' + esc(m.title) + '</span>' +
        '<span class="movie-meta">' + movieMeta(m) + '</span></span>' +
      '</button>').join('');
    const note = S.source === 'fallback'
      ? '<p class="source-note">Mostrando una cartelera de ejemplo porque no hay conexión con TMDB.</p>' : '';
    return stepHead('Cartelera de ' + esc(S.cinema.name), list.length + ' películas en cartel') + note +
      '<div class="movie-grid">' + cards + '</div>';
  }

  function movieHero() {
    const m = S.movie;
    return (
      '<div class="hero">' +
        poster(m, 'poster--hero') +
        '<div class="hero-body">' +
          '<h2 class="hero-title">' + esc(m.title) + '</h2>' +
          '<div class="movie-meta">' + movieMeta(m) + '</div>' +
          '<p class="hero-overview">' + esc(m.overview || 'Sinopsis no disponible.') + '</p>' +
          '<p class="hero-cinema">' + esc(S.cinema.name) + '</p>' +
        '</div>' +
      '</div>'
    );
  }

  function viewFormat() {
    const opts = C.formatOptions(S.cinema, S.movie);
    const cards = opts.map(o =>
      '<button type="button" class="format-card" data-action="pick-format" data-key="' + esc(o.key) + '">' +
        '<span class="format-name fmt--' + o.format + '">' + o.format + '</span>' +
        '<span class="format-body"><b>' + o.lang + '</b><small>' + esc(o.desc) + '</small></span>' +
        '<span class="format-price">' + C.money(o.price) + '<small>por entrada</small></span>' +
      '</button>').join('');
    return stepHead('Elegí el formato') + movieHero() + '<div class="format-list">' + cards + '</div>';
  }

  function viewDay() {
    const tiles = C.nextDays(7).map(d => {
      const iso = C.isoDate(d);
      const wd = C.dayLabel(d).split(' ')[0].replace(',', '');
      return '<button type="button" class="day-tile" data-action="pick-day" data-iso="' + iso + '" aria-label="' + esc(C.dayLabel(d, true)) + '">' +
        '<small>' + esc(wd) + '</small><b>' + d.getDate() + '</b><span>' + esc(d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')) + '</span></button>';
    }).join('');
    return stepHead('¿Qué día?', esc(S.movie.title) + ' · ' + S.option.format + ' ' + S.option.lang + ' · ' + esc(S.cinema.name)) +
      '<div class="day-grid">' + tiles + '</div>';
  }

  function viewTime() {
    const times = C.showtimes(S.cinema, S.movie, S.option, S.date);
    const available = times.filter(t => !t.past);
    const btns = times.map(t =>
      '<button type="button" class="time-btn" data-action="pick-time" data-time="' + t.time + '"' + (t.past ? ' disabled' : '') + '>' +
        '<b>' + t.time + '</b><small>' + (t.past ? 'Cerrada' : esc(t.sala)) + '</small></button>').join('');
    return stepHead('Elegí el horario', esc(C.dayLabel(C.parseIso(S.date), true)) + ' · ' + S.option.format + ' ' + S.option.lang) +
      (available.length ? '' : '<p class="empty">Ya no quedan funciones para hoy. Elegí otro día.</p>') +
      '<div class="time-grid">' + btns + '</div>';
  }

  function viewQty() {
    const total = unitPrice() * S.qty;
    return stepHead('¿Cuántas entradas?', 'Podés comprar hasta ' + C.MAX_TICKETS + ' entradas por función.') +
      '<div class="qty-card">' +
        '<div class="qty-row">' +
          '<div><b>Entrada general</b><small>' + S.option.format + ' ' + S.option.lang + ' · ' + C.money(unitPrice()) + ' c/u</small></div>' +
          '<div class="counter">' +
            '<button type="button" data-action="qty" data-d="-1" aria-label="Quitar una entrada"' + (S.qty <= 1 ? ' disabled' : '') + '>−</button>' +
            '<output id="qty-value" aria-live="polite">' + S.qty + '</output>' +
            '<button type="button" data-action="qty" data-d="1" aria-label="Agregar una entrada"' + (S.qty >= C.MAX_TICKETS ? ' disabled' : '') + '>+</button>' +
          '</div>' +
        '</div>' +
        (S.qty >= C.MAX_TICKETS ? '<p class="hint">Llegaste al máximo de ' + C.MAX_TICKETS + ' entradas.</p>' : '') +
        '<div class="total-row"><span>Total</span><b>' + C.money(total) + '</b></div>' +
        '<button type="button" class="btn btn--primary btn--block" data-action="to-seats">Elegir butacas</button>' +
      '</div>';
  }

  function viewSeats() {
    const room = C.buildRoom(S.option.format);
    const occupied = C.occupiedSeats(C.showKey(S), room);
    const missing = S.qty - S.seats.length;
    const sorted = C.sortSeats(S.seats);
    return stepHead('Elegí tus butacas', esc(S.show.sala) + ' · ' + S.show.time + ' h · ' + esc(S.movie.title)) +
      '<div class="seat-tools">' +
        '<ul class="legend">' +
          '<li>' + C.seatIcon('free') + 'Disponible</li>' +
          '<li>' + C.seatIcon('selected') + 'Seleccionada</li>' +
          '<li>' + C.seatIcon('taken') + 'Ocupada</li>' +
          '<li>' + C.seatIcon('accessible') + 'Movilidad reducida</li>' +
        '</ul>' +
        '<div class="zoom" role="group" aria-label="Zoom de la sala">' +
          '<button type="button" data-action="zoom" data-d="-1" aria-label="Alejar">−</button>' +
          '<button type="button" data-action="zoom" data-d="1" aria-label="Acercar">+</button>' +
        '</div>' +
      '</div>' +
      '<div class="room-scroll" style="--zoom:' + S.zoom + '">' + C.renderRoom(room, occupied, S.seats) + '</div>' +
      '<div class="seat-bar">' +
        '<div class="seat-bar-info">' +
          '<b>' + S.seats.length + ' de ' + S.qty + ' butacas</b>' +
          '<span>' + (sorted.length ? sorted.join(', ') : 'Tocá una butaca para elegirla') + '</span>' +
        '</div>' +
        '<div class="seat-bar-total">' + C.money(unitPrice() * S.qty) + '</div>' +
        '<button type="button" class="btn btn--primary" data-action="to-confirm"' + (missing ? ' disabled' : '') + '>' +
          (missing ? 'Faltan ' + missing : 'Continuar') + '</button>' +
      '</div>';
  }

  function viewConfirm() {
    const sorted = C.sortSeats(S.seats);
    const rows = [
      ['Película', esc(S.movie.title)],
      ['Cine', esc(S.cinema.name)],
      ['Formato', S.option.format + ' · ' + S.option.lang],
      ['Fecha', esc(C.dayLabel(C.parseIso(S.date), true))],
      ['Horario', S.show.time + ' h · ' + esc(S.show.sala)],
      ['Butacas', sorted.join(', ')],
      ['Entradas', S.qty + ' × ' + C.money(unitPrice())]
    ];
    return stepHead('Revisá tu compra', 'Si está todo bien, confirmá la reserva.') +
      '<div class="confirm">' +
        poster(S.movie, 'poster--confirm') +
        '<div class="confirm-card">' +
          '<dl>' + rows.map(([k, v]) => '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>').join('') + '</dl>' +
          '<div class="total-row"><span>Total</span><b>' + C.money(unitPrice() * S.qty) + '</b></div>' +
          '<button type="button" class="btn btn--primary btn--block" data-action="confirm">Confirmar compra</button>' +
          '<p class="muted small">Es una compra simulada: no se realiza ningún cobro.</p>' +
        '</div>' +
      '</div>';
  }

  function viewTicket() {
    const b = S.booking;
    const rows = [
      ['Cine', esc(b.cinema)], ['Sala', esc(b.sala)],
      ['Fecha', esc(b.dateLabel)], ['Horario', b.time + ' h'],
      ['Butacas', b.seats.join(', ')], ['Entradas', b.qty]
    ];
    return (
      '<section class="success">' +
        '<div class="success-head">' +
          '<span class="check" aria-hidden="true">✓</span>' +
          '<h1 tabindex="-1">¡Listo! Tu reserva está confirmada</h1>' +
          '<p class="muted">Te esperamos en ' + esc(b.cinema) + '. Mostrá el QR en boletería para retirar tus entradas.</p>' +
        '</div>' +
        '<article class="ticket" aria-label="Comprobante de reserva">' +
          '<div class="ticket-main">' +
            '<div class="ticket-top"><span class="brand brand--xs">CINE<b>APP</b></span><span class="ticket-code">' + esc(b.code) + '</span></div>' +
            '<h2 class="ticket-title">' + esc(b.movie) + '</h2>' +
            '<p class="ticket-format"><span class="fmt fmt--' + b.format + '">' + b.format + '</span> ' + esc(b.lang) + '</p>' +
            '<dl class="ticket-grid">' + rows.map(([k, v]) => '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>').join('') + '</dl>' +
            '<div class="ticket-total"><span>Total pagado</span><b>' + C.money(b.total) + '</b></div>' +
          '</div>' +
          '<div class="ticket-stub">' +
            '<div id="qr" class="qr" role="img" aria-label="Código QR de la reserva ' + esc(b.code) + '"></div>' +
            '<p class="ticket-code ticket-code--stub">' + esc(b.code) + '</p>' +
            '<small>Retirá tus entradas en boletería</small>' +
          '</div>' +
        '</article>' +
        '<div class="success-actions">' +
          '<button type="button" class="btn btn--primary" data-action="download">Descargar comprobante (PDF)</button>' +
          '<button type="button" class="btn btn--ghost" data-action="home">Volver al inicio</button>' +
        '</div>' +
        (window.CINEAPP_PREVIEW ? '<p class="preview-note">En esta vista previa el navegador bloquea las descargas. En tu app publicada en Vercel el PDF se descarga normalmente.</p>' : '') +
      '</section>'
    );
  }

  /* ==========================================================
     RENDER
     ========================================================== */
  const VIEWS = { cinema: viewCinema, movie: viewMovie, format: viewFormat, day: viewDay, time: viewTime, qty: viewQty, seats: viewSeats, confirm: viewConfirm };

  function render() {
    if (!S.user) {
      $app.innerHTML = viewLogin();
      return;
    }
    if (S.step === 'ticket') {
      $app.innerHTML = viewHeader() + '<main class="wrap">' + viewTicket() + '</main>' + viewFooter();
      C.drawQR(document.getElementById('qr'), S.booking).then(url => { S.qrDataUrl = url; });
      return;
    }
    $app.innerHTML =
      viewHeader() +
      '<main class="wrap">' + viewStepper() + viewChips() +
        '<section class="panel panel--' + S.step + '">' + VIEWS[S.step]() + '</section>' +
      '</main>' + viewFooter();
  }

  /* ==========================================================
     EVENTOS
     ========================================================== */
  $app.addEventListener('click', e => {
    const el = e.target.closest('[data-action], [data-seat]');
    if (!el || el.disabled) return;

    if (el.dataset.seat) return toggleSeat(el.dataset.seat);

    const a = el.dataset.action;
    switch (a) {
      case 'auth-tab':
        S.authTab = el.dataset.tab; S.authError = null; render();
        document.getElementById('auth-email').focus();
        break;
      case 'fill-demo':
        document.getElementById('auth-email').value = C.auth.DEMO.email;
        document.getElementById('auth-password').value = C.auth.DEMO.password;
        break;
      case 'toggle-pw': {
        const input = document.getElementById('auth-password');
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        el.textContent = show ? 'Ocultar' : 'Ver';
        el.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
        break;
      }
      case 'logout':
        C.auth.logout(); S.user = null; resetFrom('cinema'); S.step = 'cinema'; S.authTab = 'login'; render();
        break;
      case 'home':
        resetFrom('cinema'); S.booking = null; go('cinema');
        break;
      case 'back': {
        const i = stepIndex(S.step);
        if (i > 0) go(STEPS[i - 1].id);
        break;
      }
      case 'goto':
        go(el.dataset.step);
        break;
      case 'pick-cinema': {
        const c = C.CINEMAS.find(x => x.id === el.dataset.id);
        if (S.cinema !== c) { resetFrom('cinema'); S.cinema = c; }
        go('movie');
        break;
      }
      case 'pick-movie': {
        const m = S.movies.find(x => String(x.id) === el.dataset.id);
        if (S.movie !== m) { resetFrom('movie'); S.movie = m; }
        go('format');
        break;
      }
      case 'pick-format': {
        const o = C.formatOptions(S.cinema, S.movie).find(x => x.key === el.dataset.key);
        if (!S.option || S.option.key !== o.key) { resetFrom('option'); S.option = o; }
        go('day');
        break;
      }
      case 'pick-day':
        if (S.date !== el.dataset.iso) { resetFrom('date'); S.date = el.dataset.iso; }
        go('time');
        break;
      case 'pick-time': {
        const t = C.showtimes(S.cinema, S.movie, S.option, S.date).find(x => x.time === el.dataset.time);
        if (!S.show || S.show.time !== t.time) { resetFrom('show'); S.show = t; }
        go('qty');
        break;
      }
      case 'qty': {
        const n = Math.min(C.MAX_TICKETS, Math.max(1, S.qty + Number(el.dataset.d)));
        if (n !== S.qty) { S.qty = n; S.seats = []; }
        render();
        const same = $app.querySelector('[data-action="qty"][data-d="' + el.dataset.d + '"]');
        if (same && !same.disabled) same.focus();
        break;
      }
      case 'to-seats':
        go('seats');
        break;
      case 'zoom': {
        S.zoom = Math.min(1.5, Math.max(0.6, +(S.zoom + Number(el.dataset.d) * 0.15).toFixed(2)));
        const box = $app.querySelector('.room-scroll');
        if (box) box.style.setProperty('--zoom', S.zoom);
        break;
      }
      case 'to-confirm':
        go('confirm');
        break;
      case 'confirm':
        confirmBooking();
        break;
      case 'download': {
        const done = C.downloadTicketPDF(S.booking, S.qrDataUrl);
        toast(done.ok ? 'Comprobante descargado.' : done.error);
        break;
      }
    }
  });

  $app.addEventListener('submit', e => {
    if (e.target.id !== 'auth-form') return;
    e.preventDefault();
    const f = e.target;
    const email = f.email.value;
    const pw = f.password.value;
    const res = S.authTab === 'login'
      ? C.auth.login(email, pw)
      : C.auth.register(email, pw, f.confirm.value);
    if (!res.ok) {
      S.authError = res;
      render();
      const again = document.getElementById('auth-form');
      again.email.value = email;
      again.password.value = pw;
      const bad = document.getElementById('auth-' + res.field);
      if (bad) bad.focus();
      return;
    }
    S.user = res.user;
    S.authError = null;
    go('cinema');
  });

  function toggleSeat(id) {
    const i = S.seats.indexOf(id);
    if (i >= 0) {
      S.seats.splice(i, 1);
    } else {
      if (S.seats.length >= S.qty) {
        toast('Ya elegiste tus ' + S.qty + ' butacas. Tocá una seleccionada para liberarla.');
        return;
      }
      S.seats.push(id);
    }
    // re-render conservando el scroll horizontal de la sala
    const box = $app.querySelector('.room-scroll');
    const sx = box ? box.scrollLeft : 0;
    const sy = window.scrollY;
    render();
    const nb = $app.querySelector('.room-scroll');
    if (nb) nb.scrollLeft = sx;
    window.scrollTo(0, sy);
    const btn = $app.querySelector('[data-seat="' + id + '"]');
    if (btn) btn.focus({ preventScroll: true });
  }

  function confirmBooking() {
    const booking = {
      code: C.reservationCode(),
      showKey: C.showKey(S),
      email: S.user.email,
      movie: S.movie.title,
      cinema: S.cinema.name,
      sala: S.show.sala,
      format: S.option.format,
      lang: S.option.lang,
      date: S.date,
      dateLabel: C.dayLabel(C.parseIso(S.date), true),
      time: S.show.time,
      seats: C.sortSeats(S.seats),
      qty: S.qty,
      unitPrice: unitPrice(),
      total: unitPrice() * S.qty,
      createdAt: Date.now()
    };
    C.saveBooking(booking);
    S.booking = booking;
    go('ticket');
  }

  /* ---------- Inicio ---------- */
  render();
  C.loadMovies().then(({ movies, source }) => {
    S.movies = movies;
    S.source = source;
    S.moviesReady = true;
    if (S.user && S.step === 'movie') render();
  });
})(window.CineApp);
