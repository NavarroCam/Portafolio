# 🥗 Mi Plato - Seguimiento de comidas

Aplicación web para hacer seguimiento de lo que comés siguiendo las pautas de tu nutricionista, desarrollada con **HTML5**, **CSS3** y **JavaScript**. Le sacás una foto al plato y la app, con la API de **Gemini**, te dice si está bien o qué ajustar según tus pautas. Funciona en el celular y en la computadora, con tu cuenta guardada en la nube (**Supabase**).

🌐 **Ver app en vivo:** https://mi-plato-cmno.vercel.app/


## 🚀 Características

* **Cuenta en la nube:** Ingreso y registro con email y contraseña (Supabase Auth). Entrás desde cualquier dispositivo y ves los mismos datos; los cambios se sincronizan solos y, sin internet, se guardan y se suben cuando vuelve la conexión.
* **Apodo opcional:** si lo cargás, la app te saluda así.
* **Configuración inicial:** Condiciones de salud, alergias, datos de tu nutricionista y tu objetivo.
* **Pautas en PDF:** Subís varios PDFs a la vez (hasta 25 MB cada uno). El texto se extrae en el celular y Gemini los lee todos en un solo pedido para armar tus reglas, que podés editar. Si te equivocás de archivo, lo eliminás y se van también sus reglas.
* **Análisis por foto:** Cargás lo que vas a comer o ya comiste y la app te dice si "va bien" o "ajustalo", con la distribución del plato, lo que detectó y una sugerencia.
* **Agua diaria:** Seguimiento de los 2 L con vasos, recordatorios (cada 2 horas, con almuerzo y cena, y si vas atrasada) y festejo con confeti al cumplir la meta.
* **Mi semana:** Comidas "va bien" por día, límites semanales (papa, choclo, batata), actividad física y días con 2 L.
* **Exportar en PDF:** Resumen semanal con fotos para descargar o compartir con tu nutricionista.
* **Asistente:** Chat con Gemini para pedir recetas y consultar ingredientes, respondiendo según tus pautas.
* **Mi usuario:** Progreso de peso y medidas con gráfico, metas y acceso directo a tu nutricionista por WhatsApp o email.
* **Modo claro y oscuro:** Automático según el celular o elegido a mano.
* **Celular y escritorio:** En el celular, barra de navegación abajo; en la computadora, menú lateral, pantallas a dos columnas y arrastrar y soltar la foto del plato.


## 🛠️ Tecnologías Utilizadas

* **HTML5:** Estructura de una sola página (SPA) con navegación por hash.
* **CSS3:** Variables CSS para los temas, Flexbox, Grid, `prefers-color-scheme` y `prefers-reduced-motion`.
* **JavaScript (Vanilla):** DOM, eventos, `fetch` y `async/await`, `localStorage`, Canvas (fotos y confeti), Web Crypto, Notifications y Web Share.
* **Gemini API:** Análisis de fotos, lectura de pautas y chat. Si un modelo está saturado o sin cuota, la función prueba con otro.
* **Supabase:** Autenticación y base de datos Postgres con Row Level Security (cada usuario solo accede a lo suyo).
* **Vercel:** Publicación del sitio y funciones serverless que protegen la clave de Gemini.
* **IndexedDB:** Copia local de las fotos para que la app abra rápido y funcione sin conexión.
* **pdf.js:** Lectura de los PDFs de pautas en el navegador.
* **jsPDF:** Generación del resumen semanal en PDF.


## 📸 Vista Previa

![Vista previa de Mi Plato](vista-previa.png)


## 📁 Estructura

```
Mi-Plato/
├── index.html
├── css/styles.css
├── js/
│   ├── storage.js     # copia local de los datos, apodo y fechas
│   ├── nube.js        # cuenta y sincronización con Supabase
│   ├── fotos.js       # fotos de los platos (IndexedDB + nube)
│   ├── ui.js          # navegación, tema y utilidades
│   ├── api.js         # llamadas a /api/gemini, imágenes y PDFs
│   ├── auth.js        # ingreso, registro, salud, nutri y pautas
│   ├── hoy.js         # pantalla Hoy, agua, festejo y recordatorios
│   ├── comidas.js     # cargar foto y resultado
│   ├── semana.js      # semana y PDF
│   ├── chat.js        # asistente
│   ├── perfil.js      # mi usuario, progreso, metas y consultas
│   └── app.js         # arranque
├── api/gemini.js      # función serverless de Gemini (solo usuarios logueados)
├── api/config.js      # le pasa a la app la URL y la clave pública de Supabase
├── supabase.sql       # tablas y reglas de seguridad para Supabase
├── vercel.json        # tiempo máximo de la función
├── vista-previa.png
├── .env.example
└── .gitignore
```


## ▶️ Cómo usar

1. Crear una cuenta (con apodo, si querés) y completar salud, nutricionista y pautas en PDF.
2. En **Hoy**, tocar "Sacale una foto a tu plato", elegir la comida y analizar.
3. Marcar el agua que vas tomando y activar los recordatorios.
4. En **Semana**, revisar cómo venís y exportar el PDF para tu nutricionista.
5. En **Asistente**, pedir recetas o preguntar por un ingrediente.


## 🔑 Configuración

**Supabase (cuenta y datos)**
1. Crear un proyecto en [supabase.com](https://supabase.com).
2. En **SQL Editor**, pegar el contenido de `supabase.sql` y ejecutarlo.
3. En **Authentication › URL Configuration**, poner la URL de la app como *Site URL*.
4. Opcional: en **Authentication › Sign In / Providers › Email**, desactivar *Confirm email* para entrar sin confirmar el mail.
5. En **Project Settings › API Keys**, copiar la URL del proyecto y la clave pública (*publishable* / *anon*).

**Gemini**
1. Crear una clave en [Google AI Studio](https://aistudio.google.com/apikey).

**Vercel** (Settings › Environment Variables) y después **Redeploy**:

| Variable | Valor |
|---|---|
| `GEMINI_API_KEY` | clave de Gemini (Secret) |
| `SUPABASE_URL` | URL del proyecto de Supabase |
| `SUPABASE_ANON_KEY` | clave pública de Supabase |

Root Directory del proyecto en Vercel: `Mi-Plato`. Para probar en tu compu: copiar `.env.example` como `.env.local`, completar y correr `vercel dev`.

**Diagnóstico:** abrí [`/api/gemini`](https://mi-plato-cmno.vercel.app/api/gemini) en el navegador para ver si Gemini y Supabase están configurados (no muestra las claves).


## 📌 Nota

Proyecto con fines educativos. Los datos (incluida la salud) se guardan en la cuenta de Supabase de cada usuario, protegidos para que solo esa persona pueda verlos. Las respuestas de la IA son orientativas y no reemplazan la indicación de un profesional.
