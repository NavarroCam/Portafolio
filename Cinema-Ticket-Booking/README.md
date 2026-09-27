# 🎬 CineApp - Cinema Ticket Booking

Aplicación web para reservar entradas de cine, desarrollada con **HTML5**, **CSS3** y **JavaScript**. Simula el proceso completo de compra de una ticketera real: desde elegir el cine hasta obtener el comprobante con código QR. Las películas se obtienen en tiempo real desde la API de **TMDB**.


## 🚀 Características

* **Inicio de sesión:** Acceso con email y contraseña, con validación del formato del email.
* **Compra paso a paso:** Cine ➜ Película ➜ Formato ➜ Día ➜ Horario ➜ Entradas ➜ Butacas ➜ Confirmación.
* **Cines reales:** Complejos de Cinemark en CABA y GBA, cada uno con sus formatos (2D, 3D, 4D e IMAX).
* **Cartelera real:** Películas en cines de Argentina obtenidas desde TMDB, con póster, sinopsis, duración y género.
* **Selector de butacas:** Mapa de la sala con pantalla, filas y butacas numeradas, con referencias de disponible, seleccionada, ocupada y movilidad reducida.
* **Límite de entradas:** Hasta 8 entradas por función.
* **Comprobante con QR:** Código de reserva y QR para retirar las entradas en boletería, descargable en PDF.
* **Diseño Responsive:** Adaptado para computadora y celular.


## 🛠️ Tecnologías Utilizadas

* **HTML5:** Estructura de la aplicación de una sola página (SPA).
* **CSS3:** CSS Grid, Flexbox, variables CSS y diseño responsive.
* **JavaScript (Vanilla):** Manejo del DOM, eventos, `fetch` y `async/await`, y `localStorage`.
* **TMDB API:** Fuente de datos de las películas.
* **Vercel:** Publicación del sitio y función serverless que protege la clave de la API.
* **QRCode.js y jsPDF:** Generación del código QR y del comprobante en PDF.


## 📸 Vista Previa

![alt text](vista-previa.png)


## ▶️ Cómo usar:

1. Iniciar sesión con email y contraseña (o crear una cuenta).
2. Elegir el cine, la película, el formato, el día y el horario.
3. Indicar la cantidad de entradas y seleccionar las butacas en el mapa de la sala.
4. Confirmar la compra y descargar el comprobante con el QR.


## 📌 Nota

Proyecto con fines educativos. Los horarios, salas y precios son simulados. Datos de películas provistos por [TMDB](https://www.themoviedb.org/).
