async function buscarPokemon() {
    const input = document.getElementById("pokemonInput");
    const nombre = input.value.toLowerCase().trim();
    const resultado = document.getElementById("resultado");

    if (!nombre) return;

    resultado.innerHTML = "<p class='loading'>Consultando base de datos...</p>";

    try {
        const respuesta = await fetch(`https://pokeapi.co/api/v2/pokemon/${nombre}`);
        if (!respuesta.ok) throw new Error("Pokémon no encontrado");

        const datos = await respuesta.json();

        const peso = datos.weight / 10; 
        const altura = datos.height / 10; 
        const tipos = datos.types.map(t => t.type.name).join(", ");
        
        const hp = datos.stats[0].base_stat;
        const ataque = datos.stats[1].base_stat;
        const defensa = datos.stats[2].base_stat;


        const arteOficial = datos.sprites.other['official-artwork'].front_default;
        const imagenShiny = datos.sprites.other['official-artwork'].front_shiny || datos.sprites.front_shiny;

        resultado.innerHTML = `
            <div class="pokemon-card">
                <h2>${datos.name.toUpperCase()}</h2>
                
                <div class="image-comparison">
                    <div class="img-box">
                        <p>VERSIÓN NORMAL</p>
                        <img src="${arteOficial}" class="main-img">
                    </div>
                    <div class="img-box">
                        <p>VERSIÓN SHINY ✨</p>
                        <img src="${imagenShiny}" class="main-img">
                    </div>
                </div>
                
                <div class="info-grid">
                    <div class="info-item"><strong>Tipo:</strong> ${tipos}</div>
                    <div class="info-item"><strong>Peso:</strong> ${peso} kg</div>
                    <div class="info-item"><strong>Altura:</strong> ${altura} m</div>
                </div>

                <div class="stats-container">
                    <p><strong>Estadísticas Base:</strong></p>
                    <div class="stat-bar"><span style="width: ${hp}%">HP: ${hp}</span></div>
                    <div class="stat-bar"><span style="width: ${ataque}%">ATK: ${ataque}</span></div>
                    <div class="stat-bar"><span style="width: ${defensa}%">DEF: ${defensa}</span></div>
                </div>
            </div>
        `;

    } catch (error) {
        resultado.innerHTML = "<p class='error'>❌ No se encontró el Pokémon.</p>";
    }
}