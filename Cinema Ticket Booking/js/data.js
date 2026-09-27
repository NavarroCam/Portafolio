/* ==========================================================
   data.js — Cines, formatos, precios, salas y horarios
   Todo lo que NO viene de TMDB se arma acá, de forma
   determinística (siempre da el mismo resultado para la
   misma función), así los datos no cambian al recargar.
   ========================================================== */
window.CineApp = window.CineApp || {};

(function (C) {
  'use strict';

  /* ---------- Cines (nombres reales, datos ilustrativos) ---------- */
  C.CINEMAS = [
    { id: 'san-justo',     name: 'Cinemark San Justo',     place: 'San Justo Shopping',      area: 'La Matanza, Buenos Aires', formats: ['2D', '3D'] },
    { id: 'plaza-oeste',   name: 'Cinemark Plaza Oeste',   place: 'Plaza Oeste Shopping',    area: 'Morón, Buenos Aires',      formats: ['2D', '3D', '4D'], former: 'ex Hoyts Morón', address: 'J. M. de Rosas 658' },
    { id: 'nine-moreno',   name: 'Cinemark Nine Moreno',   place: 'Nine Shopping',           area: 'Moreno, Buenos Aires',     formats: ['2D', '3D'],       former: 'ex Hoyts Moreno', address: 'Av. Victorica 1128' },
    { id: 'unicenter',     name: 'Cinemark Unicenter',     place: 'Unicenter Shopping',      area: 'Martínez, Buenos Aires',   formats: ['2D', '3D', '4D'], former: 'ex Hoyts Unicenter' },
    { id: 'abasto',        name: 'Cinemark Abasto',        place: 'Shopping Abasto',         area: 'CABA',                     formats: ['2D', '3D', 'IMAX'], former: 'ex Hoyts Abasto' },
    { id: 'palermo',       name: 'Cinemark Palermo',       place: 'A una cuadra del Alto Palermo', area: 'CABA',               formats: ['2D', '3D', '4D'], address: 'Beruti 3399' },
    { id: 'puerto-madero', name: 'Cinemark Puerto Madero', place: 'Dique 1, Puerto Madero',  area: 'CABA',                     formats: ['2D', '3D', 'IMAX'], address: 'Av. Alicia Moreau de Justo 1920' }
  ];

  /* ---------- Formatos y precios (ARS, ilustrativos) ---------- */
  C.FORMATS = {
    '2D':   { id: '2D',   price: 11500, desc: 'Proyección digital estándar',     langs: ['Castellano', 'Subtitulada'] },
    '3D':   { id: '3D',   price: 13800, desc: 'Incluye anteojos 3D',              langs: ['Castellano'] },
    '4D':   { id: '4D',   price: 19900, desc: 'Butacas con movimiento y efectos', langs: ['Castellano'] },
    'IMAX': { id: 'IMAX', price: 17500, desc: 'Pantalla gigante y sonido IMAX',   langs: ['Subtitulada'] }
  };

  C.MAX_TICKETS = 8;

  /* ---------- Salas: distribución de butacas por formato ----------
     blocks = cantidad de butacas por bloque, separados por pasillos */
  C.ROOMS = {
    '2D':   { rows: 10, blocks: [4, 8, 4] },
    '3D':   { rows: 10, blocks: [4, 8, 4] },
    '4D':   { rows: 6,  blocks: [5, 5] },
    'IMAX': { rows: 12, blocks: [5, 10, 5] }
  };

  /* ---------- Utilidades determinísticas ---------- */
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function rng(seed) {
    let a = typeof seed === 'number' ? seed : hash(seed);
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  C.hash = hash;
  C.rng = rng;

  function pickSubset(list, seed, min, ratio) {
    const r = rng(seed);
    const out = list.filter(() => r() < ratio);
    let i = 0;
    while (out.length < Math.min(min, list.length)) {
      const cand = list[i++ % list.length];
      if (!out.includes(cand)) out.push(cand);
    }
    return list.filter(x => out.includes(x)); // conserva el orden original
  }

  /* ---------- Cartelera de cada cine ---------- */
  C.moviesForCinema = function (cinema, movies) {
    if (movies.length <= 6) return movies.slice();
    return pickSubset(movies, 'cartelera|' + cinema.id, 6, 0.72);
  };

  /* ---------- Formatos disponibles para una película en un cine ---------- */
  C.formatOptions = function (cinema, movie) {
    const all = [];
    cinema.formats.forEach(fid => {
      C.FORMATS[fid].langs.forEach(lang => {
        all.push({ key: fid + '|' + lang, format: fid, lang, price: C.FORMATS[fid].price, desc: C.FORMATS[fid].desc });
      });
    });
    const r = rng('formatos|' + cinema.id + '|' + movie.id);
    // 2D Castellano siempre está; el resto aparece según la película
    return all.filter(o => (o.format === '2D' && o.lang === 'Castellano') || r() < 0.7);
  };

  /* ---------- Próximos 7 días ---------- */
  C.nextDays = function (n = 7) {
    const days = [];
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    for (let i = 0; i < n; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      days.push(d);
    }
    return days;
  };
  C.isoDate = function (d) {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  };
  C.parseIso = function (iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  /* ---------- Horarios de una función ---------- */
  const TIME_POOL = ['12:40', '13:30', '14:15', '15:10', '16:00', '16:45', '17:40', '18:30', '19:15', '20:10', '21:00', '21:50', '22:40', '23:30'];

  C.showtimes = function (cinema, movie, option, iso) {
    const r = rng(['horarios', cinema.id, movie.id, option.key, iso].join('|'));
    const weekend = [0, 5, 6].includes(C.parseIso(iso).getDay());
    const target = (option.format === '2D' ? 4 : 2) + (weekend ? 1 : 0);
    const times = TIME_POOL.filter(() => r() < target / TIME_POOL.length * 1.1);
    while (times.length < 2) {
      const t = TIME_POOL[Math.floor(r() * TIME_POOL.length)];
      if (!times.includes(t)) times.push(t);
    }
    times.sort();
    const now = new Date();
    const isToday = iso === C.isoDate(now);
    return times.map(t => {
      const [h, m] = t.split(':').map(Number);
      const when = C.parseIso(iso); when.setHours(h, m, 0, 0);
      const salaNum = 1 + (hash(cinema.id + movie.id + option.key + t) % 10);
      const sala = option.format === 'IMAX' ? 'Sala IMAX' : option.format === '4D' ? 'Sala 4D' : 'Sala ' + salaNum;
      // una función de hoy que empieza en menos de 15 minutos ya no se vende
      const past = isToday && when.getTime() - now.getTime() < 15 * 60 * 1000;
      return { time: t, sala, past };
    });
  };

  /* ---------- Clave única de una función ---------- */
  C.showKey = function (s) {
    return [s.cinema.id, s.movie.id, s.option.key, s.date, s.show.time].join('|');
  };

  /* ---------- Butacas ocupadas (simuladas + compradas por el usuario) ---------- */
  C.buildRoom = function (formatId) {
    const room = C.ROOMS[formatId];
    const letters = 'ABCDEFGHIJKLMNOP'.slice(0, room.rows).split('');
    const perRow = room.blocks.reduce((a, b) => a + b, 0);
    return { ...room, letters, perRow };
  };

  C.occupiedSeats = function (key, room) {
    const r = rng('ocupadas|' + key);
    const occupancy = 0.18 + r() * 0.3; // entre 18% y 48% de la sala
    const set = new Set();
    room.letters.forEach((L, ri) => {
      // las filas del medio se llenan más, como en la vida real
      const middle = 1 - Math.abs(ri - room.rows * 0.6) / room.rows;
      for (let n = 1; n <= room.perRow; n++) {
        if (r() < occupancy * (0.6 + middle)) set.add(L + n);
      }
    });
    C.bookedSeats(key).forEach(s => set.add(s));
    return set;
  };

  /* Butacas para movilidad reducida: extremos de la última fila */
  C.isAccessible = function (room, letter, n) {
    return letter === room.letters[room.letters.length - 1] && (n <= 2 || n > room.perRow - 2);
  };

  /* ---------- Almacenamiento local seguro ---------- */
  C.store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
      catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* sin almacenamiento */ }
    },
    remove(key) {
      try { localStorage.removeItem(key); } catch (e) { /* sin almacenamiento */ }
    }
  };

  C.bookedSeats = function (key) {
    const all = C.store.get('cineapp.bookings', []);
    return all.filter(b => b.showKey === key).flatMap(b => b.seats);
  };

  C.saveBooking = function (booking) {
    const all = C.store.get('cineapp.bookings', []);
    all.push(booking);
    C.store.set('cineapp.bookings', all.slice(-50));
  };

  /* Ordena butacas: A1, A2 ... A10, B1 (no alfabético puro) */
  C.sortSeats = function (list) {
    return list.slice().sort((a, b) => a[0] === b[0] ? parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10) : a.localeCompare(b));
  };

  /* ---------- Formatos de texto ---------- */
  C.money = n => '$' + n.toLocaleString('es-AR');
  C.dayLabel = function (d, long) {
    const today = C.isoDate(new Date());
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const iso = C.isoDate(d);
    const pretty = d.toLocaleDateString('es-AR', long
      ? { weekday: 'long', day: 'numeric', month: 'long' }
      : { weekday: 'short', day: 'numeric', month: 'short' });
    if (iso === today) return long ? 'Hoy, ' + pretty : 'Hoy';
    if (iso === C.isoDate(tomorrow)) return long ? 'Mañana, ' + pretty : 'Mañana';
    return pretty.charAt(0).toUpperCase() + pretty.slice(1);
  };

  C.reservationCode = function () {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    const buf = new Uint32Array(6);
    try { crypto.getRandomValues(buf); } catch (e) { for (let i = 0; i < 6; i++) buf[i] = Math.random() * 1e9; }
    buf.forEach(v => { code += chars[v % chars.length]; });
    return 'CA-' + code;
  };
})(window.CineApp);
