/* ==========================================================
   /api/config — Función serverless de Vercel
   Le pasa a la app la URL y la clave PÚBLICA de Supabase
   (publishable / anon). Esta clave puede estar en el navegador:
   lo que protege los datos son las reglas de Row Level Security
   (ver supabase.sql). La clave secreta NUNCA va acá.
   ========================================================== */

module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.status(200).json({
    supabaseUrl: (process.env.SUPABASE_URL || '').trim(),
    supabaseKey: (process.env.SUPABASE_ANON_KEY || '').trim()
  });
};
