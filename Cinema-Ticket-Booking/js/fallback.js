/* ==========================================================
   fallback.js — Cartelera de respaldo
   Se usa solo si la función /api/movies no responde
   (por ejemplo, abriendo la app sin Vercel o sin token).
   Los posters se generan con CSS porque no hay conexión a TMDB.
   ========================================================== */
window.CineApp = window.CineApp || {};

window.CineApp.FALLBACK_MOVIES = [
  {
    id: 'fb-odisea',
    title: 'La Odisea',
    overview: 'Christopher Nolan adapta el poema épico de Homero: el largo regreso de Odiseo a Ítaca después de la guerra de Troya.',
    genres: ['Aventura', 'Drama'],
    poster: null, runtime: null, rating: null
  },
  {
    id: 'fb-spiderman',
    title: 'Spider-Man: Un nuevo día',
    overview: 'Peter Parker vuelve a ponerse el traje en una nueva etapa de su vida como el amigable vecino Spider-Man.',
    genres: ['Acción', 'Aventura'],
    poster: null, runtime: null, rating: null
  },
  {
    id: 'fb-toystory5',
    title: 'Toy Story 5',
    overview: 'Woody, Buzz y el resto de los juguetes se enfrentan a un rival nuevo: las pantallas y la tecnología.',
    genres: ['Animación', 'Familia'],
    poster: null, runtime: null, rating: null
  },
  {
    id: 'fb-parque-lezama',
    title: 'Parque Lezama',
    overview: 'Juan José Campanella dirige a Luis Brandoni y Eduardo Blanco como dos octogenarios que discuten sobre la vida en un banco del parque.',
    genres: ['Comedia', 'Drama'],
    poster: null, runtime: null, rating: null
  },
  {
    id: 'fb-casaca',
    title: 'La casaca de Dios',
    overview: 'Drama argentino dirigido por Fernán Mirás, con Natalia Oreiro y Jorge Marrale.',
    genres: ['Drama'],
    poster: null, runtime: null, rating: null
  },
  {
    id: 'fb-mario',
    title: 'Super Mario Galaxy: La película',
    overview: 'Mario y Luigi dejan el Reino Champiñón y salen al espacio en una nueva aventura.',
    genres: ['Animación', 'Aventura'],
    poster: null, runtime: null, rating: null
  },
  {
    id: 'fb-avatar',
    title: 'Avatar: Fuego y cenizas',
    overview: 'Jake Sully y Neytiri enfrentan una nueva amenaza en Pandora: un clan Na’vi que vive entre volcanes.',
    genres: ['Ciencia ficción', 'Aventura'],
    poster: null, runtime: null, rating: null
  },
  {
    id: 'fb-zootopia2',
    title: 'Zootopia 2',
    overview: 'Judy Hopps y Nick Wilde vuelven a formar equipo para resolver un caso nuevo en la ciudad de los animales.',
    genres: ['Animación', 'Comedia'],
    poster: null, runtime: null, rating: null
  }
];
