"""
Los oídos de Jarvis: graban tu voz desde el micrófono y la pasan a texto
con faster-whisper. Corre 100% local en tu PC, gratis y sin internet.

La primera vez descarga el modelo de Whisper (unos cientos de MB) y queda
guardado para las siguientes.
"""

import os

import numpy as np
import sounddevice as sd
from faster_whisper import WhisperModel

SAMPLE_RATE = 16000  # Whisper trabaja con audio de 16 kHz en mono


class Ears:
    def __init__(self):
        # Tamaños: "tiny" < "base" < "small" < "medium". Más grande = entiende
        # mejor pero tarda más. "small" es buen equilibrio para el procesador.
        model_size = os.getenv("WHISPER_MODEL", "small")
        print(f"Cargando oídos (Whisper {model_size})... la primera vez tarda un poco.")
        # device="cpu" + int8: la forma más liviana de correrlo sin placa de video
        self.model = WhisperModel(model_size, device="cpu", compute_type="int8")

    def listen(self) -> str:
        """Graba hasta que la usuaria presione Enter y devuelve lo que dijo."""
        frames: list[np.ndarray] = []

        def callback(indata, frame_count, time_info, status):
            frames.append(indata.copy())

        with sd.InputStream(samplerate=SAMPLE_RATE, channels=1, dtype="float32", callback=callback):
            input("🎙️  Escuchando... (presioná Enter cuando termines)")

        if not frames:
            return ""

        audio = np.concatenate(frames).flatten()
        if len(audio) < SAMPLE_RATE * 0.3:  # menos de 0,3 segundos: no hay nada
            return ""

        segments, _ = self.model.transcribe(
            audio,
            language="es",
            vad_filter=True,  # ignora los silencios
            beam_size=1,      # más rápido, casi igual de preciso
            # Le da contexto a Whisper para que entienda mejor cómo hablás
            initial_prompt="Conversación en español de Argentina con Jarvis, un asistente personal. "
                           "Preguntas sobre el clima, la hora, tareas y el día a día.",
        )
        return " ".join(segment.text.strip() for segment in segments).strip()
