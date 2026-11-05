"""
Las manos de Jarvis: herramientas que consiguen datos reales.

Funciona como un "router": revisa lo que dijiste, y si detecta palabras
clave (clima, hora, fecha...), ejecuta la herramienta correspondiente y le
pasa el resultado al cerebro para que lo diga con su estilo.

Para agregar una herramienta nueva:
  1. Escribí una función que reciba el texto y devuelva un string con el dato.
  2. Agregala a la lista TOOLS con las palabras que la activan.
"""

import os
import re
import shutil
import subprocess
import sys
from collections.abc import Callable
from datetime import date, datetime, timedelta

import requests

DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
         "agosto", "septiembre", "octubre", "noviembre", "diciembre"]


# --- Hora y fecha ------------------------------------------------------------

def get_time(_: str) -> str:
    return f"Hora actual: {datetime.now():%H:%M}."


def get_date(_: str) -> str:
    now = datetime.now()
    return f"Fecha de hoy: {DIAS[now.weekday()]} {now.day} de {MESES[now.month - 1]} de {now.year}."


# --- Clima (Open-Meteo: gratis y sin API key) --------------------------------

# Códigos de clima de Open-Meteo (estándar WMO) traducidos al español
WEATHER_CODES = {
    0: "despejado", 1: "mayormente despejado", 2: "parcialmente nublado", 3: "nublado",
    45: "con niebla", 48: "con niebla",
    51: "con llovizna leve", 53: "con llovizna", 55: "con llovizna intensa",
    61: "con lluvia leve", 63: "con lluvia", 65: "con lluvia intensa",
    66: "con lluvia helada", 67: "con lluvia helada intensa",
    71: "con nevadas leves", 73: "con nieve", 75: "con nevadas intensas", 77: "con granizo fino",
    80: "con chaparrones leves", 81: "con chaparrones", 82: "con chaparrones fuertes",
    85: "con nevadas", 86: "con nevadas fuertes",
    95: "con tormenta", 96: "con tormenta y granizo", 99: "con tormenta fuerte y granizo",
}

# Busca un lugar escrito con mayúscula después de "en" o "de": "en Córdoba", "de Buenos Aires"
CITY_PATTERN = re.compile(r"\b(?:en|de)\s+([A-ZÁÉÍÓÚÑ][\wáéíóúñü]+(?:\s+(?:del?\s+)?[A-ZÁÉÍÓÚÑ][\wáéíóúñü]+)*)")


def _find_city(text: str) -> tuple[str, float, float] | None:
    """Busca las coordenadas de una ciudad por nombre."""
    response = requests.get(
        "https://geocoding-api.open-meteo.com/v1/search",
        params={"name": text, "count": 1, "language": "es"},
        timeout=10,
    )
    results = response.json().get("results")
    if not results:
        return None
    place = results[0]
    return place["name"], place["latitude"], place["longitude"]


def get_weather(text: str) -> str:
    default_city = os.getenv("CITY", "Buenos Aires")
    match = CITY_PATTERN.search(text)
    note = ""
    city = _find_city(match.group(1)) if match else None
    if match and not city:
        note = f"No encontré la ciudad '{match.group(1)}', así que doy el clima de {default_city}. "
    city = city or _find_city(default_city)
    if not city:
        return "No pude encontrar esa ciudad."
    name, lat, lon = city

    data = requests.get(
        "https://api.open-meteo.com/v1/forecast",
        params={
            "latitude": lat,
            "longitude": lon,
            "current": "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m",
            "daily": "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
            "timezone": "auto",
            "forecast_days": 1,
        },
        timeout=10,
    ).json()
    now, today = data["current"], data["daily"]

    sky = WEATHER_CODES.get(now["weather_code"], "con condiciones variables")
    return note + (
        f"Clima actual en {name}: {round(now['temperature_2m'])} grados, {sky}, "
        f"sensación térmica de {round(now['apparent_temperature'])} grados, "
        f"humedad del {now['relative_humidity_2m']} por ciento, "
        f"viento de {round(now['wind_speed_10m'])} kilómetros por hora. "
        f"Hoy: mínima de {round(today['temperature_2m_min'][0])} y máxima de "
        f"{round(today['temperature_2m_max'][0])} grados, "
        f"probabilidad de lluvia del {today['precipitation_probability_max'][0]} por ciento."
    )


# --- Abrir programas y páginas ----------------------------------------------

# Lista blanca: Jarvis SOLO abre lo que está acá. Agregá los tuyos así:
#   "nombre que decís": ("Nombre lindo", "comando, programa o página")
APPS: dict[str, tuple[str, str]] = {
    "google chrome": ("Google Chrome", "chrome"),
    "chrome": ("Google Chrome", "chrome"),
    "crome": ("Google Chrome", "chrome"),
    "cromo": ("Google Chrome", "chrome"),
    "navegador": ("Google Chrome", "chrome"),
    "edge": ("Microsoft Edge", "msedge"),
    "visual studio code": ("Visual Studio Code", "code"),
    "vs code": ("Visual Studio Code", "code"),
    "vscode": ("Visual Studio Code", "code"),
    "visual studio": ("Visual Studio Code", "code"),
    "spotify": ("Spotify", "spotify:"),
    "spotifai": ("Spotify", "spotify:"),
    "whatsapp": ("WhatsApp", "whatsapp:"),
    "explorador": ("el Explorador de archivos", "explorer"),
    "archivos": ("el Explorador de archivos", "explorer"),
    "calculadora": ("la Calculadora", "calc"),
    "bloc de notas": ("el Bloc de notas", "notepad"),
    "word": ("Word", "winword"),
    "excel": ("Excel", "excel"),
    "powerpoint": ("PowerPoint", "powerpnt"),
    "configuración": ("la Configuración de Windows", "ms-settings:"),
    "youtube": ("YouTube", "https://www.youtube.com"),
    "gmail": ("Gmail", "https://mail.google.com"),
    "github": ("GitHub", "https://github.com/NavarroCam"),
    "portafolio": ("tu portafolio", "https://portafolio-navarro-camila.vercel.app/"),
    "google": ("Google", "https://www.google.com"),
}


def _launch(target: str) -> None:
    """Abre un programa, una página o un enlace del sistema. Si falla, lanza un error."""
    print(f"\n[Abriendo: {target}]")
    if sys.platform == "win32":
        # Si el programa está en el PATH (como "code"), usamos su ruta completa.
        # Si no, Windows lo busca entre los programas instalados (como "chrome").
        os.startfile(shutil.which(target) or target)
    else:
        subprocess.Popen(["xdg-open", target])


def open_app(text: str) -> str:
    lowered = text.lower()
    # Buscamos primero los nombres más largos ("visual studio code" antes que "code")
    found = []
    for key in sorted(APPS, key=len, reverse=True):
        pattern = rf"\b{re.escape(key)}\b"
        if re.search(pattern, lowered):
            found.append(key)
            # Borramos lo encontrado para que "google chrome" no abra también "google"
            lowered = re.sub(pattern, " ", lowered)
    if not found:
        available = ", ".join(sorted({name for name, _ in APPS.values()}))
        return f"No reconocí qué programa abrir. Puede abrir: {available}."

    opened = []
    for key in found:
        name, target = APPS[key]
        if name in opened:
            continue
        try:
            _launch(target)
            opened.append(name)
        except Exception as error:
            print(f"[Error al abrir {target}: {error}]")
            return f"Intentó abrir {name} pero NO se pudo: Windows no lo encontró. Debe decir que no pudo abrirlo."
    return "Se abrió " + " y ".join(opened) + " correctamente."


# --- Agenda (Google Calendar por dirección secreta iCal) ---------------------

NO_AGENDA = ("Jarvis NO tiene acceso a la agenda de la usuaria todavía (falta configurar "
             "CALENDAR_ICAL_URL en el .env). Debe decirlo y NO inventar tareas, reuniones, "
             "proyectos ni nombres.")

_calendar_cache: dict = {"time": None, "data": None}


def _load_calendar(url: str):
    """Descarga el calendario (y lo guarda 5 minutos para no pedirlo a cada rato)."""
    import icalendar  # se importan acá para que el resto funcione sin estas librerías

    cached_at = _calendar_cache["time"]
    if cached_at is None or datetime.now() - cached_at > timedelta(minutes=5):
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        _calendar_cache["data"] = icalendar.Calendar.from_ical(response.content)
        _calendar_cache["time"] = datetime.now()
    return _calendar_cache["data"]


def _which_days(text: str) -> tuple[date, int, str]:
    """Entiende si preguntás por hoy, mañana, pasado mañana o la semana."""
    lowered = text.lower()
    today = date.today()
    if "pasado mañana" in lowered:
        return today + timedelta(days=2), 1, "pasado mañana"
    # "mañana" como día, no como "a la mañana" / "por la mañana"
    if re.search(r"(?<!la )\bmañana\b", lowered):
        return today + timedelta(days=1), 1, "mañana"
    if "semana" in lowered:
        return today, 7, "los próximos 7 días"
    return today, 1, "hoy"


def _describe_event(event, show_day: bool) -> str:
    title = str(event.get("SUMMARY", "Sin título"))
    start = event.get("DTSTART").dt
    end = event.get("DTEND").dt if event.get("DTEND") else None
    day = ""
    if show_day:
        d = start.astimezone().date() if isinstance(start, datetime) else start
        day = f"el {DIAS[d.weekday()]} {d.day}, "
    if not isinstance(start, datetime):  # evento de todo el día
        return f"{day}todo el día: {title}"
    start = start.astimezone()  # a la hora de tu PC
    hours = f"de {start:%H:%M} a {end.astimezone():%H:%M}" if isinstance(end, datetime) else f"a las {start:%H:%M}"
    place = f" (en {event.get('LOCATION')})" if event.get("LOCATION") else ""
    return f"{day}{hours}: {title}{place}"


def get_agenda(text: str) -> str:
    url = os.getenv("CALENDAR_ICAL_URL", "").strip()
    if not url:
        return NO_AGENDA

    import recurring_ical_events

    first_day, days, label = _which_days(text)
    calendar = _load_calendar(url)
    events = recurring_ical_events.of(calendar).between(first_day, first_day + timedelta(days=days))

    def sort_key(event):
        start = event.get("DTSTART").dt
        return start.astimezone() if isinstance(start, datetime) else datetime.combine(start, datetime.min.time()).astimezone()

    events = sorted(events, key=sort_key)
    if not events:
        return f"Agenda de {label}: no hay ningún evento en el calendario. No inventes ninguno."
    lines = "; ".join(_describe_event(e, show_day=days > 1) for e in events)
    return (f"Agenda de {label} según Google Calendar ({len(events)} eventos): {lines}. "
            "Esta es la lista completa: no agregues nada más.")


# --- Registro de herramientas ------------------------------------------------

# (nombre, palabras que la activan, función)
TOOLS: list[tuple[str, re.Pattern, Callable[[str], str]]] = [
    ("hora", re.compile(r"\bqu[eé] hora\b|\bla hora\b|\bhora es\b", re.I), get_time),
    ("fecha", re.compile(r"\bfecha\b|\bqu[eé] d[ií]a\b|\bd[ií]a es hoy\b", re.I), get_date),
    ("clima", re.compile(
        r"\b(clima|temperatura|grados|pron[oó]stico|llueve|llover|lluvia|paraguas|"
        r"calor|fr[ií]o|humedad|qu[eé] tiempo hace|viento)\b", re.I), get_weather),
    ("abrir", re.compile(
        r"\b(abr[ií]|abre|abrir|abrime|[aá]breme|ejecut[aá]|inici[aá]|lanz[aá])\b", re.I), open_app),
    ("agenda", re.compile(
        r"\b(tareas?|agenda|pendientes?|reuni[oó]n(es)?|protocolo|calendario|"
        r"recordatorios?|eventos?|qu[eé] tengo (para|que|hoy|ma[ñn]ana)|tengo (algo|que hacer))\b", re.I), get_agenda),
]


def run_tools(text: str) -> str:
    """Ejecuta las herramientas que correspondan y devuelve sus resultados."""
    results = []
    for name, pattern, function in TOOLS:
        if pattern.search(text):
            try:
                results.append(function(text))
            except Exception as error:
                results.append(f"La herramienta de {name} falló ({error}). Avisale a la usuaria.")
    return " ".join(results)
