"""
Punto de entrada de Jarvis (fase 1: modo texto).

Ejecutar con:  python main.py
"""

import os

from dotenv import load_dotenv

from brain import Brain

EXIT_WORDS = {"salir", "chau", "adiós", "adios", "exit"}


def main() -> None:
    load_dotenv()  # lee las variables del archivo .env

    user_name = os.getenv("USER_NAME", "señorita")
    brain = Brain(user_name=user_name)

    print(f"J.A.R.V.I.S. en línea (cerebro local: {brain.model})")
    print("Escribí 'olvidar' para borrar la memoria o 'salir' para terminar.\n")

    while True:
        try:
            user_text = input("Vos: ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nJarvis: Hasta luego.")
            break

        if not user_text:
            continue
        if user_text.lower() in EXIT_WORDS:
            print("Jarvis: Hasta luego. Estaré aquí cuando me necesite.")
            break
        if user_text.lower() == "olvidar":
            brain.forget()
            print("Jarvis: Memoria de la conversación borrada.\n")
            continue

        try:
            answer = brain.think(user_text)
            print(f"Jarvis: {answer}\n")
        except Exception as error:  # en la fase 1 mostramos el error y seguimos
            print(f"[Error] {error}\n")


if __name__ == "__main__":
    main()
