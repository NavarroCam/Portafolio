"""
Punto de entrada de Jarvis (fase 2: voz).

Ejecutar con:  python main.py

- Presioná Enter (sin escribir nada) para hablarle por el micrófono.
- O escribí un mensaje y presioná Enter, como antes.
"""

import os
import re

from dotenv import load_dotenv

from brain import Brain

EXIT_WORDS = {"salir", "chau", "adiós", "adios", "exit"}

# Detecta el final de una oración: . ! ? o … seguido de un espacio o salto de línea
SENTENCE_END = re.compile(r"([.!?…]+)\s+")


def env_flag(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "si", "sí", "yes"}


def main() -> None:
    load_dotenv()  # lee las variables del archivo .env

    user_name = os.getenv("USER_NAME", "señorita")
    brain = Brain(user_name=user_name)

    # Se importan solo si están activados, así el modo texto funciona sin ellos
    ears = None
    mouth = None
    if env_flag("VOICE_INPUT", True):
        from ears import Ears
        ears = Ears()
    if env_flag("VOICE_OUTPUT", True):
        from mouth import Mouth
        mouth = Mouth()

    print(f"\nJ.A.R.V.I.S. en línea (cerebro local: {brain.model})")
    if ears:
        print("Presioná Enter para hablar, o escribí un mensaje.")
    print("Escribí 'olvidar' para borrar la memoria o 'salir' para terminar.\n")

    if mouth:
        mouth.say(f"En línea, {user_name}.")
        mouth.wait()  # que termine de hablar antes de abrir el micrófono

    while True:
        try:
            user_text = input("Vos: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nJarvis: Hasta luego.")
            break

        # Enter sin texto = hablar por el micrófono
        if not user_text:
            if not ears:
                continue
            user_text = ears.listen()
            if not user_text:
                print("(No escuché nada)\n")
                continue
            print(f"Vos (voz): {user_text}")

        if user_text.lower().strip(" .!¡") in EXIT_WORDS:
            farewell = "Hasta luego. Estaré aquí cuando me necesite."
            print(f"Jarvis: {farewell}")
            if mouth:
                mouth.say(farewell)
                mouth.wait()
            break
        if user_text.lower().strip(" .") == "olvidar":
            brain.forget()
            print("Jarvis: Memoria de la conversación borrada.\n")
            continue

        print("Jarvis: ", end="", flush=True)
        pending = ""  # texto que todavía no se mandó a la voz
        try:
            for chunk in brain.think(user_text):
                print(chunk, end="", flush=True)
                if not mouth:
                    continue
                pending += chunk
                # Cada vez que se completa una oración, la empieza a decir
                while match := SENTENCE_END.search(pending):
                    mouth.say(pending[: match.end()])
                    pending = pending[match.end():]
            if mouth:
                mouth.say(pending)  # lo que quedó al final
                mouth.wait()
            print("\n")
        except Exception as error:  # mostramos el error y seguimos
            print(f"\n[Error] {error}\n")


if __name__ == "__main__":
    main()
