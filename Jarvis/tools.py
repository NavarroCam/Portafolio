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
from collections.abc import Callable
from datetime import datetime

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


# --- Registro de herramientas ------------------------------------------------

# (nombre, palabras que la activan, función)
TOOLS: list[tuple[str, re.Pattern, Callable[[str], str]]] = [
    ("hora", re.compile(r"\bqu[eé] hora\b|\bla hora\b|\bhora es\b", re.I), get_time),
    ("fecha", re.compile(r"\bfecha\b|\bqu[eé] d[ií]a\b|\bd[ií]a es hoy\b", re.I), get_date),
    ("clima", re.compile(
        r"\b(clima|temperatura|grados|pron[oó]stico|llueve|llover|lluvia|paraguas|"
        r"calor|fr[ií]o|humedad|qu[eé] tiempo hace|viento)\b", re.I), get_weather),
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
