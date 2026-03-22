function agregarTarea() {
    let input = document.getElementById("tareaInput");
    let texto = input.value;

    if (texto === "") return;

    let li = document.createElement("li");

    let izquierda = document.createElement("div");
    izquierda.classList.add("izquierda");

    let checkbox = document.createElement("input");
    checkbox.type = "checkbox";

    let span = document.createElement("span");
    span.textContent = texto;

    checkbox.addEventListener("change", function () {
        span.classList.toggle("completada");
    });

    izquierda.appendChild(checkbox);
    izquierda.appendChild(span);

    let borrar = document.createElement("button");
    borrar.textContent = "🗑️";

    borrar.addEventListener("click", function () {
        li.remove();
    });

    li.appendChild(izquierda);
    li.appendChild(borrar);

    document.getElementById("listaTareas").appendChild(li);

    input.value = "";
}