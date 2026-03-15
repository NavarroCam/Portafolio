function agregar(valor){

document.getElementById("pantalla").value += valor;

}

function calcular(){

let expresion = document.getElementById("pantalla").value;

let resultado = eval(expresion);

document.getElementById("pantalla").value = resultado;

}

function limpiar(){

document.getElementById("pantalla").value = "";

}