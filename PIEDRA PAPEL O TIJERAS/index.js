// Declaramos nuestras variables
// Guardaremos en variables todos los elementos que veamos necesarios utilizar
let jugador = document.querySelector("#emojiJugador")
let computadora = document.querySelector("#emojiComputadora")
let resultado = document.querySelector("#textoResultado")
let boton_jugar = document.querySelector(".boton-jugar")
let opciones = document.querySelectorAll(".boton-opcion")
let versus = document.querySelector("#versus")

let puntosJugador = 0
let puntosComputadora = 0

let marcadorJugador = document.querySelector("#puntosJugador")
let marcadorComputadora = document.querySelector("#puntosComputadora")



// Ahora empezamos agregando funcionalidad cuando damos click en jugar
boton_jugar.addEventListener("click", () => {
    opciones.forEach((opcion) => {
        opcion.removeAttribute("disabled")
    })

    jugador.textContent = "?"
    computadora.textContent = "?"
})

// Luego creemos la funcionalidad cuando seleccionemos una opcion

let mi_opcion = ''

let emojis = {
    piedra: "✊",
    papel: "✋",
    tijeras: "✌️"
}

let opciones_computadora = ["piedra", "papel", "tijeras"]

opciones.forEach((opcion) => {
    opcion.addEventListener("click", () => {
        mi_opcion = opcion.getAttribute("id")
        jugador.textContent = emojis[mi_opcion]

        // Al final agregaremos la funcionalidad cuando la computadora piensa
        let numero_aleatorio = Math.floor(Math.random() * 3)

        let eleccion_computadora = opciones_computadora[numero_aleatorio]
        
        computadora.textContent = emojis[eleccion_computadora]   
        
        versus.style.display = 'none'

        if (mi_opcion == eleccion_computadora) {
            resultado.textContent = "EMPATE 🤝"
        }else if ((mi_opcion == "piedra" && eleccion_computadora == "tijeras") || 
                (mi_opcion == "tijeras" && eleccion_computadora == "papel") || 
                (mi_opcion == "papel" && eleccion_computadora == "piedra"))
            {
                resultado.textContent = "GANASTE 👏"
                puntosJugador++
            }else{
                resultado.textContent = "PERDISTE 🤏"
                puntosComputadora++
            }
        marcadorJugador.textContent = puntosJugador
        marcadorComputadora.textContent = puntosComputadora
    })
    
})





