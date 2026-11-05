# J.A.R.V.I.S.

Mi asistente personal, construido desde cero. 100% gratis y local: corre en mi PC, sin APIs pagas.

## Hoja de ruta

- [x] **Fase 1** – Chat en texto con personalidad propia
- [x] **Fase 2** – Voz (escuchar con faster-whisper y hablar con edge-tts)
- [ ] **Fase 3** – Herramientas: ✅ hora, ✅ fecha, ✅ clima, ✅ abrir programas, ✅ agenda (lectura) · ⏳ n8n…
- [ ] **Fase 4** – Palabra de activación ("Jarvis") y memoria persistente
- [ ] **Fase 5** – Interfaz visual

## Estructura

```
jarvis/
├── main.py          # Bucle principal: lee lo que escribís y muestra la respuesta
├── brain.py         # Habla con el LLM local (Ollama) y guarda el historial
├── ears.py          # Graba el micrófono y lo pasa a texto (faster-whisper, local)
├── mouth.py         # Convierte texto en voz y lo reproduce (edge-tts)
├── tools.py         # Herramientas: hora, fecha, clima (Open-Meteo) y abrir programas
├── probar_voces.py  # Para escuchar y elegir la voz de Jarvis
├── personality.py   # El prompt de sistema: quién es Jarvis y cómo habla
├── requirements.txt
└── .env.example     # Plantilla de configuración
```

## Cómo correrlo

```bash
python -m venv venv
venv\Scripts\activate        # Windows  (en Linux/Mac: source venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env       # Windows  (en Linux/Mac: cp .env.example .env)
python main.py
```

Antes, instalá **Ollama** desde https://ollama.com y descargá el modelo:

```bash
ollama pull gemma3:4b     # o gemma3:1b si tu PC tiene poca RAM
```

## Cómo usarlo

- **Enter sin escribir nada** → Jarvis te escucha. Hablá y presioná Enter de nuevo al terminar.
- **Escribir un mensaje** → funciona como chat de texto.
- Jarvis responde hablando, oración por oración, mientras va pensando el resto.

Todo se configura en el `.env` (voz, velocidad, modelo de Whisper, activar o desactivar la voz).
La primera vez que se ejecuta, descarga el modelo de Whisper (unos cientos de MB).
