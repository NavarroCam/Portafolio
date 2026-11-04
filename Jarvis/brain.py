"""
El cerebro de Jarvis: recibe texto, se lo pasa a un modelo de lenguaje (LLM)
local con Ollama y devuelve la respuesta. También guarda el historial de la
conversación para que Jarvis "se acuerde" de lo que hablaron.

Todo corre en tu PC: es gratis, funciona sin internet y tus datos no salen
de tu máquina.
"""

import json
import os
from collections.abc import Iterator

import requests

from personality import build_system_prompt

# Cuántos mensajes del historial se le mandan al modelo.
# Más mensajes = más memoria de la charla, pero respuestas más lentas.
MAX_HISTORY = 20

# Segundos máximos de espera ENTRE palabra y palabra (no para la respuesta
# completa). La primera vez puede tardar más porque el modelo se carga en RAM.
READ_TIMEOUT = 300


class Brain:
    def __init__(self, user_name: str):
        self.system_prompt = build_system_prompt(user_name)
        self.history: list[dict] = []
        self.ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434")
        self.model = os.getenv("OLLAMA_MODEL", "qwen3:4b")

    def think(self, user_text: str) -> Iterator[str]:
        """
        Recibe lo que dijo el usuario y va devolviendo la respuesta de a
        pedacitos (streaming), a medida que el modelo la genera.
        """
        self.history.append({"role": "user", "content": user_text})
        recent = self.history[-MAX_HISTORY:]

        payload = {
            "model": self.model,
            "messages": [{"role": "system", "content": self.system_prompt}] + recent,
            "stream": True,
            # Los modelos qwen3 "razonan" antes de responder. Lo apagamos
            # para que Jarvis conteste mucho más rápido.
            "think": False,
        }

        answer = ""
        try:
            with requests.post(
                f"{self.ollama_url}/api/chat",
                json=payload,
                stream=True,
                timeout=(10, READ_TIMEOUT),
            ) as response:
                response.raise_for_status()
                for line in response.iter_lines():
                    if not line:
                        continue
                    data = json.loads(line)
                    # Solo mostramos la respuesta, no el razonamiento interno.
                    chunk = data.get("message", {}).get("content", "")
                    if chunk:
                        answer += chunk
                        yield chunk
                    if data.get("done"):
                        break
        except requests.ConnectionError:
            self.history.pop()  # el mensaje no llegó: no lo guardamos
            raise RuntimeError("No encuentro a Ollama. ¿Está abierto? (ejecutá 'ollama serve')")
        except requests.Timeout:
            self.history.pop()
            raise RuntimeError("Ollama tardó demasiado en responder. Probá con un modelo más liviano.")

        self.history.append({"role": "assistant", "content": answer.strip()})

    def forget(self) -> None:
        """Borra la memoria de la conversación actual."""
        self.history.clear()
