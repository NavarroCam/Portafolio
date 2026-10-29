# 🥗 Mi Plato - Seguimiento de comidas

Aplicación web para hacer seguimiento de lo que comés siguiendo las pautas de tu nutricionista, desarrollada con **HTML5**, **CSS3** y **JavaScript**. Le sacás una foto al plato y la app, con la API de **Gemini**, te dice si está bien o qué ajustar según tus pautas.

🌐 **Ver app en vivo:** [link de Vercel]


## 🚀 Características

* **Ingreso y registro:** Cuenta con email y contraseña (guardada como hash SHA-256).
* **Configuración inicial:** Condiciones de salud, alergias, datos de tu nutricionista y tu objetivo.
* **Pautas en PDF:** Subís los PDFs de tu nutricionista y Gemini los convierte en reglas que podés editar.
* **Análisis por foto:** Cargás lo que vas a comer o ya comiste y la app te dice si "va bien" o "ajustalo", con la distribución del plato y una sugerencia.
* **Agua diaria:** Seguimiento de los 2 L con vasos y recordatorios (cada 2 horas, con almuerzo y cena, y si vas atrasada).
* **Mi semana:** Comidas "va bien" por día, límites semanales (papa, choclo, batata), actividad física y días con 2 L.
* **Exportar en PDF:** Resumen semanal con fotos para compartir con tu nutricionista.
* **Asistente:** Chat con Gemini para pedir recetas y consultar ingredientes, respondiendo según tus pautas.
* **Mi usuario:** Progreso de peso y medidas con gráfico, metas y acceso directo a tu nutricionista por WhatsApp o email.
* **Modo claro y oscuro:** Automático según el celular o elegido a mano.
* **Diseño Responsive:** Pensada para el celular (también funciona en computadora).


## 🛠️ Tecnologías Utilizadas

* **HTML5:** Estructura de una sola página (SPA) con navegación por hash.
* **CSS3:** Variables CSS para los temas, Flexbox, Grid y `prefers-color-scheme`.
* **JavaScript (Vanilla):** DOM, eventos, `fetch` y `async/await`, `localStorage`, Canvas (para achicar fotos), Web Crypto, Notifications y Web Share.
* **Gemini API:** Análisis de fotos, lectura de PDFs y chat.
* **Vercel:** Publicación del sitio y función serverless que protege la clave de la API.
* **jsPDF:** Generación del resumen semanal en PDF.


## 📸 Vista Previa

![Vista previa de Mi Plato](vista-previa.png)


## 📁 Estructura

```
Mi-Plato/
├── index.html
├── css/styles.css
├── js/
│   ├── storage.js     # datos en localStorage y fechas
│   ├── ui.js          # navegación, tema y utilidades
│   ├── api.js         # llamadas a /api/gemini e imágenes
│   ├── auth.js        # ingreso, registro, salud, nutri y pautas
│   ├── hoy.js         # pantalla Hoy, agua y recordatorios
│   ├── comidas.js     # cargar foto y resultado
│   ├── semana.js      # semana y PDF
│   ├── chat.js        # asistente
│   ├── perfil.js      # mi usuario, progreso, metas y consultas
│   └── app.js         # arranque
├── api/gemini.js      # función serverless (Vercel)
├── vista-previa.png
├── .env.example
└── .gitignore
```


## ▶️ Cómo usar

1. Crear una cuenta y completar salud, nutricionista y pautas (podés subir los PDFs).
2. En **Hoy**, tocar "Sacale una foto a tu plato", elegir la comida y analizar.
3. Marcar el agua que vas tomando y activar los recordatorios.
4. En **Semana**, revisar cómo venís y exportar el PDF para tu nutricionista.


## 🔑 Configuración

1. Crear una clave en [Google AI Studio](https://aistudio.google.com/apikey).
2. En Vercel: **Settings › Environment Variables** → agregar `GEMINI_API_KEY`.
3. Para probar en tu compu: copiar `.env.example` como `.env.local`, pegar la clave y correr `vercel dev`.


## 📌 Nota

Proyecto con fines educativos. Los datos (incluida la salud) se guardan solo en el navegador del dispositivo. Las respuestas de la IA son orientativas y no reemplazan la indicación de un profesional.
