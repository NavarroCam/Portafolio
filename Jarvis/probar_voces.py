"""
Probador de voces para Jarvis.

Reproduce una frase de muestra con cada voz en español disponible en edge-tts,
para que elijas la que más te guste.

Ejecutar con:  python probar_voces.py
Solo voces de Argentina:  python probar_voces.py es-AR
"""

import asyncio
import io
import sys

import edge_tts
import sounddevice as sd
import soundfile as sf

SAMPLE = "Buenas noches, Cam. Todos los sistemas funcionan correctamente. ¿En qué puedo ayudarla?"


async def speak(text: str, voice: str) -> None:
    mp3 = b""
    async for chunk in edge_tts.Communicate(text, voice).stream():
        if chunk["type"] == "audio":
            mp3 += chunk["data"]
    audio, sample_rate = sf.read(io.BytesIO(mp3), dtype="float32")
    sd.play(audio, sample_rate)
    sd.wait()


async def main() -> None:
    prefix = sys.argv[1] if len(sys.argv) > 1 else "es-"
    voices = [v for v in await edge_tts.list_voices() if v["ShortName"].startswith(prefix)]
    voices.sort(key=lambda v: v["ShortName"])

    print(f"Encontré {len(voices)} voces. Enter = escuchar la siguiente, 'q' = salir.\n")
    for voice in voices:
        name = voice["ShortName"]
        gender = "hombre" if voice["Gender"] == "Male" else "mujer"
        if input(f"{name}  ({gender})  ").strip().lower() == "q":
            break
        try:
            await speak(SAMPLE, name)
        except Exception as error:
            print(f"   No pude reproducirla: {error}")

    print("\nCuando elijas una, ponela en tu .env así:  TTS_VOICE=nombre-de-la-voz")


if __name__ == "__main__":
    asyncio.run(main())
