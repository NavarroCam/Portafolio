"""
El cerebro de Jarvis: recibe texto, se lo pasa a un modelo de lenguaje (LLM)
local con Ollama y devuelve la respuesta. También guarda el historial de la
conversación para que Jarvis "se acuerde" de lo que hablaron.

Todo corre en tu PC: es gratis, funciona sin internet y tus datos no salen
de tu máquina.
"""

import os

import requests

from personality import build_system_prompt

# Cuántos mensajes del historial se le mandan al modelo.
# Más mensajes = más memoria de la charla, pero respuestas más lentas.
MAX_HISTORY = 20


class Brain:
    def __init__(self, user_name: str):
        self.system_prompt = build_system_prompt(user_name)
        self.history: list[dict] = []
        self.ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434")
        self.model = os.getenv("OLLAMA_MODEL", "qwen3:4b")

    def think(self, user_text: str) -> str:
        """Recibe lo que dijo el usuario y devuelve la respuesta de Jarvis."""
        self.history.append({"role": "user", "content": user_text})
        recent = self.history[-MAX_HISTORY:]

        payload = {
            "model": self.model,
            "messages": [{"role": "system", "content": self.system_prompt}] + recent,
            "stream": False,
            "think": False,  # los modelos qwen3 "piensan" antes de responder; lo apagamos para que sea más rápido
        }
        try:
            response = requests.post(f"{self.ollama_url}/api/chat", json=payload, timeout=120)
        except requests.ConnectionError:
            self.history.pop()
            raise RuntimeError("No encuentro a Ollama. ¿Está abierto? (ejecutá 'ollama serve')")
        response.raise_for_status()

        answer = response.json()["message"]["content"].strip()
        self.history.append({"role": "assistant", "content": answer})
        return answer

    def forget(self) -> None:
        """Borra la memoria de la conversación actual."""
        self.history.clear()
