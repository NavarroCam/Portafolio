# 🥗 Mi Plato - Seguimiento de comidas

Aplicación web para hacer seguimiento de lo que comés siguiendo las pautas de tu nutricionista, desarrollada con **HTML5**, **CSS3** y **JavaScript**. Le sacás una foto al plato y la app, con la API de **Gemini**, te dice si está bien o qué ajustar según tus pautas. Pensada para usarse desde el celular.

🌐 **Ver app en vivo:** https://mi-plato-cmno.vercel.app/


## 🚀 Características

* **Ingreso y registro:** Cuenta con email y contraseña (guardada como hash SHA-256) y apodo opcional: si lo cargás, la app te saluda así.
* **Configuración inicial:** Condiciones de salud, alergias, datos de tu nutricionista y tu objetivo.
* **Pautas en PDF:** Subís varios PDFs a la vez (hasta 25 MB cada uno). El texto se extrae en el celular y Gemini los lee todos en un solo pedido para armar tus reglas, que podés editar. Si te equivocás de archivo, lo eliminás y se van también sus reglas.
* **Análisis por foto:** Cargás lo que vas a comer o ya comiste y la app te dice si "va bien" o "ajustalo", con la distribución del plato, lo que detectó y una sugerencia.
* **Agua diaria:** Seguimiento de los 2 L con vasos, recordatorios (cada 2 horas, con almuerzo y cena, y si vas atrasada) y festejo con confeti al cumplir la meta.
* **Mi semana:** Comidas "va bien" por día, límites semanales (papa, choclo, batata), actividad física y días con 2 L.
* **Exportar en PDF:** Resumen semanal con fotos para descargar o compartir con tu nutricionista.
* **Asistente:** Chat con Gemini para pedir recetas y consultar ingredientes, respondiendo según tus pautas.
* **Mi usuario:** Progreso de peso y medidas con gráfico, metas y acceso directo a tu nutricionista por WhatsApp o email.
* **Modo claro y oscuro:** Automático según el celular o elegido a mano.
* **Diseño mobile first:** Respeta la barra de estado y la del navegador, y los formularios se apilan en pantallas chicas.


## 🛠️ Tecnologías Utilizadas

* **HTML5:** Estructura de una sola página (SPA) con navegación por hash.
* **CSS3:** Variables CSS para los temas, Flexbox, Grid, `prefers-color-scheme` y `prefers-reduced-motion`.
* **JavaScript (Vanilla):** DOM, eventos, `fetch` y `async/await`, `localStorage`, Canvas (fotos y confeti), Web Crypto, Notifications y Web Share.
* **Gemini API:** Análisis de fotos, lectura de pautas y chat. Si un modelo está saturado o sin cuota, la función prueba con otro.
* **Vercel:** Publicación del sitio y función serverless que protege la clave de la API.
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
│   ├── storage.js     # datos en localStorage, apodo y fechas
│   ├── ui.js          # navegación, tema y utilidades
│   ├── api.js         # llamadas a /api/gemini, imágenes y PDFs
│   ├── auth.js        # ingreso, registro, salud, nutri y pautas
│   ├── hoy.js         # pantalla Hoy, agua, festejo y recordatorios
│   ├── comidas.js     # cargar foto y resultado
│   ├── semana.js      # semana y PDF
│   ├── chat.js        # asistente
│   ├── perfil.js      # mi usuario, progreso, metas y consultas
│   └── app.js         # arranque
├── api/gemini.js      # función serverless (Vercel)
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

1. Crear una clave en [Google AI Studio](https://aistudio.google.com/apikey).
2. En Vercel: **Settings › Environment Variables** → agregar `GEMINI_API_KEY` (tipo Secret) y hacer **Redeploy**.
3. Root Directory del proyecto en Vercel: `Mi-Plato`.
4. Para probar en tu compu: copiar `.env.example` como `.env.local`, pegar la clave y correr `vercel dev`.

**Diagnóstico:** abrí [`/api/gemini`](https://mi-plato-cmno.vercel.app/api/gemini) en el navegador para ver si la clave está configurada y si Gemini responde (no muestra la clave).


## 📌 Nota

Proyecto con fines educativos. Los datos (incluida la salud) se guardan solo en el navegador del dispositivo. Las respuestas de la IA son orientativas y no reemplazan la indicación de un profesional.
