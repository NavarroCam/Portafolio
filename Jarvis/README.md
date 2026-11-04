# J.A.R.V.I.S.

Mi asistente personal, construido desde cero. 100% gratis y local: corre en mi PC, sin APIs pagas.

## Hoja de ruta

- [x] **Fase 1** – Chat en texto con personalidad propia
- [ ] **Fase 2** – Voz (escuchar con Whisper y hablar con TTS)
- [ ] **Fase 3** – Herramientas (hora, clima, abrir apps, n8n…)
- [ ] **Fase 4** – Palabra de activación ("Jarvis") y memoria persistente
- [ ] **Fase 5** – Interfaz visual

## Estructura

```
jarvis/
├── main.py          # Bucle principal: lee lo que escribís y muestra la respuesta
├── brain.py         # Habla con el LLM local (Ollama) y guarda el historial
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
