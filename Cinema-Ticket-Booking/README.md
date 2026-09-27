# CineApp 🎬

Ticketera de cine hecha con **HTML, CSS y JavaScript** (sin frameworks), publicada en **Vercel**.
Las películas vienen de la API de **TMDB**; cines, formatos, horarios, salas y precios son simulados.

> Proyecto educativo ilustrativo, sin afiliación con Cinemark ni con TMDB.

---

## Flujo de la app

```
Login → Cine → Película → Formato → Día → Horario → Entradas (1 a 8) → Butacas → Confirmar → Comprobante con QR
```

- **Login simulado** con email y contraseña. Se valida que el email tenga formato real (`nombre@dominio.com`) y que la contraseña tenga al menos 6 caracteres. Cuenta demo: `demo@cineapp.com` / `cine1234`.
- **Cines reales** del AMBA (Cinemark San Justo, Plaza Oeste, Nine Moreno, Unicenter, Abasto, Palermo y Puerto Madero), cada uno con sus formatos.
- **Formatos** 2D, 3D, 4D e IMAX, en castellano o subtitulada, con precio por entrada.
- **Mapa de sala** con pantalla, filas con letra, butacas numeradas con forma de butaca y referencias: disponible, seleccionada, ocupada y movilidad reducida. Tiene zoom y scroll horizontal en el celular.
- **Comprobante** con código de reserva (`CA-XXXXXX`), QR y descarga en PDF.
- Las butacas que comprás quedan **ocupadas** para esa función (se guardan en el navegador).

---

## Estructura

```
cinema-ticket-booking/
├── index.html          ← página única (SPA)
├── css/styles.css      ← estilos (paleta negro / rojo / blanco)
├── js/
│   ├── data.js         ← cines, formatos, precios, salas, horarios
│   ├── fallback.js     ← cartelera de respaldo si TMDB no responde
│   ├── api.js          ← pide la cartelera a /api/movies
│   ├── auth.js         ← login simulado + validación de email
│   ├── seats.js        ← dibujo de la sala y las butacas
│   ├── ticket.js       ← comprobante, QR y PDF
│   └── app.js          ← navegación entre pasos y pantallas
├── api/movies.js       ← función de Vercel que habla con TMDB (oculta el token)
├── .env.example        ← ejemplo de variable de entorno
└── README.md
```

---

## 1. Obtener el token de TMDB

1. Iniciá sesión en [themoviedb.org](https://www.themoviedb.org/) (desde la compu).
2. Ícono de tu perfil → **Settings** → **API**.
3. En **Request an API Key** hacé clic en *click here*, elegí **Developer**, aceptá los términos y completá el formulario.
4. Copiá el **API Read Access Token**: es el largo que empieza con `eyJ`.

⚠️ **No subas el token al repo ni lo compartas en capturas.** Si se expuso, regeneralo desde esa misma página.

---

## 2. Subir a GitHub y publicar en Vercel

1. Descomprimí el zip y subí el contenido a tu repo `Cinema-Ticket-Booking`.
2. En Vercel, importá el repo (si ya está vinculado, se despliega solo con cada push).
   - Framework preset: **Other**. No hace falta comando de build.
3. En Vercel: **Project → Settings → Environment Variables**
   - Name: `TMDB_TOKEN`
   - Value: tu API Read Access Token
   - Environments: Production, Preview y Development
4. Hacé un **Redeploy** para que tome la variable.
5. Abrí la URL pública: la cartelera ya debería mostrar películas reales con posters.

Para comprobar que la API funciona, abrí `https://TU-APP.vercel.app/api/movies`: tiene que devolver un JSON con `"source": "tmdb"`.

---

## 3. Probar en tu compu

**Opción A — con películas reales (recomendada):**

```bash
npm i -g vercel
vercel login
vercel link          # vincula la carpeta con tu proyecto de Vercel
vercel env pull      # descarga TMDB_TOKEN a un archivo .env.local (ya está en .gitignore)
vercel dev           # abre http://localhost:3000
```

**Opción B — rápida, sin TMDB:**

```bash
npx serve .
```

Como no hay función `/api/movies`, la app usa la cartelera de respaldo (posters generados). Todo el resto del flujo funciona igual.

> Abrir `index.html` con doble clic también funciona, pero algunos navegadores limitan `localStorage` en archivos locales.

---

## Criterios de aceptación del MVP

| Historia | Criterio | Estado |
|---|---|---|
| HU1 | Se muestran al menos 3 películas con título y horarios | ✅ |
| HU1 | El usuario puede seleccionar una película | ✅ |
| HU2 | Al elegir una película se muestran horarios disponibles | ✅ (después de formato y día) |
| HU2 | El usuario puede elegir un horario | ✅ |
| HU3 | El usuario puede indicar cantidad de entradas (mínimo 1) | ✅ (1 a 8) |
| HU3 | Al confirmar aparece un mensaje de éxito con resumen | ✅ comprobante con QR |
| General | La app funciona sin errores en la demo | ✅ con respaldo si TMDB falla |
| General | Publicada en Vercel con URL pública | ⏳ al hacer el deploy |

Extras sumados: login, selección de cine y formato, mapa de butacas, películas reales (TMDB) y comprobante descargable.

---

## Próximos pasos

- **QR con reserva real:** hoy el QR contiene los datos de la reserva en texto. La idea es que apunte a una URL (`/api/reserva/CA-XXXXXX`) que devuelva un archivo con la reserva real. El cambio está preparado en `js/ticket.js` (`QR_CONFIG.mode = 'url'`). Faltaría crear `api/reserva/[code].js` y guardar las reservas en una base de datos (por ejemplo Supabase o Vercel KV).
- Login real con Firebase Auth o Supabase.
- Butacas ocupadas compartidas entre usuarios (hoy se guardan solo en el navegador).
- Sección "Mis reservas".

---

## Créditos

Datos de películas: [TMDB](https://www.themoviedb.org/).
This product uses the TMDB API but is not endorsed or certified by TMDB.
