"""
La boca de Jarvis: convierte texto en voz con edge-tts (voces neuronales de
Microsoft, gratis) y lo reproduce por los parlantes.

Habla oración por oración en segundo plano: mientras dice la primera, el
cerebro ya está generando la siguiente. Así la espera se siente mucho menor.

Necesita internet para generar la voz.
"""

import asyncio
import io
import os
import queue
import threading
import time

import edge_tts
import sounddevice as sd
import soundfile as sf

# Algunas voces en español para probar (cambialas en el .env con TTS_VOICE):
#   es-AR-TomasNeural (Argentina, hombre)   es-AR-ElenaNeural (Argentina, mujer)
#   es-ES-AlvaroNeural (España, hombre)     es-MX-JorgeNeural (México, hombre)
DEFAULT_VOICE = "es-AR-TomasNeural"

# Cuántas veces intenta generar la voz antes de rendirse
RETRIES = 3


class Mouth:
    def __init__(self):
        self.voice = os.getenv("TTS_VOICE", DEFAULT_VOICE)
        self.rate = os.getenv("TTS_RATE", "+0%")  # velocidad: "+10%", "-10%", etc.
        self._queue: queue.Queue[str] = queue.Queue()
        threading.Thread(target=self._worker, daemon=True).start()

    def say(self, text: str) -> None:
        """Agrega una frase a la fila para decirla en cuanto se pueda."""
        text = text.strip()
        if text:
            self._queue.put(text)

    def wait(self) -> None:
        """Espera a que Jarvis termine de hablar."""
        self._queue.join()

    # --- Por dentro ----------------------------------------------------------

    def _worker(self) -> None:
        while True:
            text = self._queue.get()
            try:
                audio, sample_rate = self._synthesize(text)
                sd.play(audio, sample_rate)
                sd.wait()
            except Exception as error:
                print(f"\n[Voz] No pude hablar: {error}")
            finally:
                self._queue.task_done()

    def _synthesize(self, text: str):
        """Genera el audio con edge-tts y lo decodifica para reproducirlo."""

        async def fetch() -> bytes:
            mp3 = b""
            communicate = edge_tts.Communicate(text, self.voice, rate=self.rate)
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    mp3 += chunk["data"]
            return mp3

        # El servicio de voz a veces falla de forma momentánea: reintentamos
        for attempt in range(1, RETRIES + 1):
            try:
                mp3_bytes = asyncio.run(fetch())
                return sf.read(io.BytesIO(mp3_bytes), dtype="float32")
            except edge_tts.exceptions.NoAudioReceived:
                if attempt == RETRIES:
                    raise
                time.sleep(0.5 * attempt)
