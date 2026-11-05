"""Carga y limpieza del CSV exportado de Hevy (formato de fecha en español)."""
import json
import re
from pathlib import Path

import pandas as pd

BASE = Path(__file__).resolve().parent.parent
MESES = {"ene": 1, "feb": 2, "mar": 3, "abr": 4, "may": 5, "jun": 6, "jul": 7,
         "ago": 8, "sep": 9, "sept": 9, "oct": 10, "nov": 11, "dic": 12}
SERIES_EFECTIVAS = {"normal", "failure", "dropset"}


def parse_fecha(txt):
    """'6 oct 2026, 17:07' -> Timestamp. También acepta formatos ISO/inglés."""
    m = re.match(r"(\d{1,2}) ([a-zé]+)\.? (\d{4}), (\d{1,2}):(\d{2})", str(txt).strip().lower())
    if m and m.group(2) in MESES:
        d, mes, a, h, mi = m.groups()
        return pd.Timestamp(int(a), MESES[mes], int(d), int(h), int(mi))
    return pd.to_datetime(txt)


def cargar_mapeo():
    with open(BASE / "scripts" / "mapeo_ejercicios.json", encoding="utf-8") as f:
        mapeo = json.load(f)
    mapeo.pop("_doc", None)
    return mapeo


def cargar(csv_path=None):
    """Devuelve todas las series con columnas extra: inicio, fin, fecha, sesion_id, efectiva, e1rm."""
    if csv_path is None:
        csvs = sorted((BASE / "datos" / "hevy").glob("*.csv"))
        csv_path = csvs[-1]
    df = pd.read_csv(csv_path)
    df["inicio"] = df["start_time"].map(parse_fecha)
    df["fin"] = df["end_time"].map(parse_fecha)
    df["fecha"] = df["inicio"].dt.normalize()
    df["sesion_id"] = df["inicio"].rank(method="dense").astype(int)
    df["efectiva"] = df["set_type"].isin(SERIES_EFECTIVAS)
    df["e1rm"] = df["weight_kg"] * (1 + df["reps"] / 30)  # Epley
    sin_mapeo = sorted(set(df["exercise_title"]) - set(cargar_mapeo()))
    if sin_mapeo:
        print("AVISO: ejercicios sin mapear (añadir a mapeo_ejercicios.json):", sin_mapeo)
    return df.sort_values(["inicio", "exercise_title", "set_index"]).reset_index(drop=True)
