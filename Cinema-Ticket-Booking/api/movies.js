/* ==========================================================
   /api/movies — Función serverless de Vercel
   Pide a TMDB las películas en cines de Argentina y devuelve
   solo los datos que usa la app. El token queda guardado en
   la variable de entorno TMDB_TOKEN (nunca en el código).
   ========================================================== */

const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/';

function certificationAR(details) {
  const results = (details.release_dates && details.release_dates.results) || [];
  const ar = results.find(r => r.iso_3166_1 === 'AR');
  if (!ar) return null;
  const withCert = ar.release_dates.find(d => d.certification && d.certification.trim());
  return withCert ? withCert.certification.trim() : null;
}

module.exports = async function handler(req, res) {
  const token = process.env.TMDB_TOKEN;
  if (!token) {
    res.status(500).json({ error: 'Falta configurar la variable de entorno TMDB_TOKEN en Vercel.' });
    return;
  }

  const headers = { Authorization: 'Bearer ' + token, accept: 'application/json' };

  try {
    const np = await fetch(BASE + '/movie/now_playing?language=es-AR&region=AR&page=1', { headers });
    if (!np.ok) throw new Error('TMDB respondió ' + np.status);
    const data = await np.json();

    const list = (data.results || [])
      .filter(m => m.poster_path)
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 16);

    // Detalles: duración, géneros y clasificación argentina
    const details = await Promise.all(list.map(async m => {
      try {
        const r = await fetch(BASE + '/movie/' + m.id + '?language=es-AR&append_to_response=release_dates', { headers });
        return r.ok ? await r.json() : null;
      } catch (e) {
        return null;
      }
    }));

    const movies = list.map((m, i) => {
      const d = details[i] || {};
      return {
        id: m.id,
        title: m.title,
        overview: m.overview || d.overview || '',
        poster: IMG + 'w500' + m.poster_path,
        backdrop: m.backdrop_path ? IMG + 'w1280' + m.backdrop_path : null,
        runtime: d.runtime || null,
        genres: (d.genres || []).map(g => g.name),
        rating: certificationAR(d),
        releaseDate: m.release_date || null,
        vote: m.vote_average || null
      };
    });

    // Cache en el CDN de Vercel por 6 horas
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    res.status(200).json({ source: 'tmdb', updated: new Date().toISOString(), movies });
  } catch (err) {
    res.status(502).json({ error: 'No se pudo obtener la cartelera de TMDB.', detail: String(err.message || err) });
  }
};
