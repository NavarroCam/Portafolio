/* ==========================================================
   api.js — Carga de películas
   Pide la cartelera a /api/movies (función de Vercel que
   habla con TMDB usando el token guardado como variable
   de entorno). Si falla, usa la cartelera de respaldo.
   ========================================================== */
window.CineApp = window.CineApp || {};

(function (C) {
  'use strict';

  const TIMEOUT_MS = 7000;

  C.loadMovies = async function () {
    if (window.CINEAPP_PREVIEW) {
      return { movies: C.FALLBACK_MOVIES, source: 'fallback' };
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch('/api/movies', { headers: { accept: 'application/json' }, signal: ctrl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (!Array.isArray(data.movies) || data.movies.length < 3) throw new Error('Cartelera vacía');
      return { movies: data.movies, source: 'tmdb' };
    } catch (err) {
      console.warn('[CineApp] No se pudo cargar TMDB, uso la cartelera de respaldo:', err.message);
      return { movies: C.FALLBACK_MOVIES, source: 'fallback' };
    } finally {
      clearTimeout(timer);
    }
  };
})(window.CineApp);
