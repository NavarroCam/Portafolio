"""
El cerebro de Jarvis: recibe texto, se lo pasa a un modelo de lenguaje (LLM)
local con Ollama y devuelve la respuesta. También guarda el historial de la
conversación para que Jarvis "se acuerde" de lo que hablaron.

Todo corre en tu PC: es gratis, funciona sin internet y tus datos no salen
de tu máquina.
"""

import json
import os
import re
from collections.abc import Iterator

import requests

from personality import build_system_prompt

# Cuántos mensajes del historial se le mandan al modelo.
# Más mensajes = más memoria de la charla, pero respuestas más lentas.
MAX_HISTORY = 20

# Segundos máximos de espera ENTRE palabra y palabra (no para la respuesta
# completa). La primera vez puede tardar más porque el modelo se carga en RAM.
READ_TIMEOUT = 300

# Límite de largo de cada respuesta (en "tokens", aprox. 3/4 de palabra).
# Evita que el modelo se vaya por las ramas y, de paso, responde más rápido.
MAX_TOKENS = 400

# Algunos modelos escriben su razonamiento entre <think> y </think>.
# Esto lo detecta (incluso si el bloque todavía no se cerró) para ocultarlo.
THINK_BLOCK = re.compile(r"<think>.*?(</think>|$)", re.DOTALL)


def _visible_text(raw: str) -> str:
    """Devuelve el texto sin los bloques de razonamiento."""
    text = THINK_BLOCK.sub("", raw)
    # Si el texto termina en un "<thi..." a medio llegar, lo guardamos para después
    for i in range(len("<think>") - 1, 0, -1):
        if text.endswith("<think>"[:i]):
            return text[:-i]
    return text


class Brain:
    def __init__(self, user_name: str):
        self.system_prompt = build_system_prompt(user_name)
        self.history: list[dict] = []
        self.ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434")
        self.model = os.getenv("OLLAMA_MODEL", "gemma3:4b")

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
            "options": {"num_predict": MAX_TOKENS},
        }
        # Los modelos que "razonan" (como qwen3) aceptan que les apaguemos el
        # razonamiento. A los demás no hay que mandarles este parámetro.
        if self.model.startswith(("qwen3", "deepseek-r1")):
            payload["think"] = False

        raw = ""    # todo lo que mandó el modelo
        shown = ""  # lo que ya mostramos en pantalla
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
                    # Ignoramos el campo "thinking": solo nos interesa la respuesta
                    raw += data.get("message", {}).get("content", "")
                    visible = _visible_text(raw).lstrip()
                    if len(visible) > len(shown):
                        new_text = visible[len(shown):]
                        shown = visible
                        yield new_text
                    if data.get("done"):
                        break
        except requests.ConnectionError:
            self.history.pop()  # el mensaje no llegó: no lo guardamos
            raise RuntimeError("No encuentro a Ollama. ¿Está abierto? (ejecutá 'ollama serve')")
        except requests.Timeout:
            self.history.pop()
            raise RuntimeError("Ollama tardó demasiado en responder. Probá con un modelo más liviano.")

        self.history.append({"role": "assistant", "content": _visible_text(raw).strip()})

    def forget(self) -> None:
        """Borra la memoria de la conversación actual."""
        self.history.clear()
