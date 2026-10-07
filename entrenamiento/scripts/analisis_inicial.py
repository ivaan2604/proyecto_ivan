"""Análisis inicial del historial de Hevy. Uso: python scripts/analisis_inicial.py [csv]
Genera tablas en analisis/datos-inicial/ y gráficas en analisis/."""
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

from hevy_utils import BASE, cargar, cargar_mapeo

OUT = BASE / "analisis" / "datos-inicial"
OUT.mkdir(parents=True, exist_ok=True)
GRAF = BASE / "analisis"

df = cargar(sys.argv[1] if len(sys.argv) > 1 else None)
mapeo = cargar_mapeo()
ef = df[df["efectiva"]].copy()

# ---------- 1. Sesiones, frecuencia y duración ----------
ses = df.groupby("sesion_id").agg(inicio=("inicio", "first"), fin=("fin", "first"), titulo=("title", "first"),
                                  series_efectivas=("efectiva", "sum"), ejercicios=("exercise_title", "nunique"))
ses["duracion_min"] = (ses["fin"] - ses["inicio"]).dt.total_seconds() / 60
ses["dia_semana"] = ses["inicio"].dt.day_name(locale=None)
ses["hora"] = ses["inicio"].dt.strftime("%H:%M")

def musculos_sesion(g):
    s = {}
    for ex, n in g.groupby("exercise_title").size().items():
        for m in mapeo.get(ex, {}).get("primarios", []):
            s[m] = s.get(m, 0) + n
    return s

def tipo_sesion(g):
    pat = g.groupby(g["exercise_title"].map(lambda e: mapeo.get(e, {}).get("patron", "?"))).size()
    pierna = pat.reindex(["pierna_cuad", "pierna_isquio", "pierna_otros"]).fillna(0).sum()
    emp, trac = pat.get("empuje", 0), pat.get("traccion", 0)
    tot = pat.sum()
    if pierna / tot >= 0.5: return "pierna"
    if pierna / tot >= 0.2: return "mixta/fullbody"
    if emp and trac and min(emp, trac) / tot >= 0.25: return "torso"
    return "empuje" if emp >= trac else "traccion"

ses["tipo"] = ef.groupby("sesion_id").apply(tipo_sesion, include_groups=False)
ses.to_csv(OUT / "sesiones.csv")

semanas = pd.period_range(ses["inicio"].min().to_period("W-SUN"), ses["inicio"].max().to_period("W-SUN"), freq="W-SUN")
por_semana = ses.groupby(ses["inicio"].dt.to_period("W-SUN")).size().reindex(semanas, fill_value=0)
por_semana.to_csv(OUT / "sesiones_por_semana.csv", header=["sesiones"])
por_mes = ses.groupby(ses["inicio"].dt.to_period("M")).size()
por_mes.to_csv(OUT / "sesiones_por_mes.csv", header=["sesiones"])
gaps = ses["inicio"].diff().dt.days
huecos = ses.loc[gaps >= 10, ["inicio"]].assign(dias_sin_entrenar=gaps[gaps >= 10])

# ---------- 2. Series efectivas por músculo y semana ----------
filas = []
for _, r in ef.iterrows():
    info = mapeo.get(r["exercise_title"], {})
    for m in info.get("primarios", []):
        filas.append((r["inicio"].to_period("W-SUN"), r["sesion_id"], m, 1.0))
    for m in info.get("secundarios", []):
        filas.append((r["inicio"].to_period("W-SUN"), r["sesion_id"], m, 0.5))
mus = pd.DataFrame(filas, columns=["semana", "sesion_id", "musculo", "series"])
sem_mus = mus.pivot_table(index="semana", columns="musculo", values="series", aggfunc="sum").reindex(semanas).fillna(0)
activas = por_semana[por_semana > 0].index
inicio_actual = pd.Timestamp("2026-08-25")  # vuelta tras el verano
sem_actual = [s for s in activas if s.start_time >= inicio_actual]
resumen_mus = pd.DataFrame({
    "media_todas_semanas": sem_mus.mean(),
    "media_semanas_con_entreno": sem_mus.loc[activas].mean(),
    "media_desde_25ago": sem_mus.loc[sem_actual].mean(),
}).round(1).sort_values("media_semanas_con_entreno", ascending=False)
# frecuencia: nº de sesiones/semana en que el músculo recibe >=2 series directas
directas = mus[mus["series"] == 1].groupby(["semana", "musculo", "sesion_id"])["series"].sum()
freq = (directas[directas >= 2].groupby(["semana", "musculo"]).size().unstack(fill_value=0)
        .reindex(activas).fillna(0).mean().round(2))
resumen_mus["frecuencia_media_semana_activa"] = freq
resumen_mus.to_csv(OUT / "series_por_musculo.csv")

# ---------- 3. Equilibrios ----------
ef["patron"] = ef["exercise_title"].map(lambda e: mapeo.get(e, {}).get("patron", "?"))
pat = ef.groupby("patron").size()
pat_actual = ef[ef["inicio"] >= inicio_actual].groupby("patron").size()
equilibrio = pd.DataFrame({"total": pat, "desde_25ago": pat_actual}).fillna(0).astype(int)
equilibrio.to_csv(OUT / "series_por_patron.csv")

# ---------- 4. e1RM de ejercicios principales y estancamientos ----------
principales = [e for e, i in mapeo.items() if i.get("principal")]
con_carga = ef[ef["weight_kg"].notna() & (ef["weight_kg"] > 0) & ef["reps"].notna()]
best = (con_carga.groupby(["exercise_title", "sesion_id"])
        .agg(fecha=("fecha", "first"), e1rm=("e1rm", "max"), peso_max=("weight_kg", "max"),
             tonelaje=("weight_kg", lambda w: (w * con_carga.loc[w.index, "reps"]).sum()))
        .reset_index())
best.to_csv(OUT / "e1rm_por_sesion.csv", index=False)
filas = []
for ex, g in best.groupby("exercise_title"):
    g = g.sort_values("fecha")
    if len(g) < 3:
        continue
    ult4 = g.tail(4)
    previo = g.iloc[:-4] if len(g) > 4 else g.iloc[:1]
    pr_fecha = g.loc[g["e1rm"].idxmax(), "fecha"]
    filas.append({
        "ejercicio": ex, "principal": ex in principales, "sesiones": len(g),
        "primera": g["fecha"].iloc[0].date(), "ultima": g["fecha"].iloc[-1].date(),
        "e1rm_primero": round(g["e1rm"].iloc[0], 1), "e1rm_max": round(g["e1rm"].max(), 1),
        "fecha_max": pr_fecha.date(), "e1rm_ultimo": round(g["e1rm"].iloc[-1], 1),
        "cambio_total_%": round((g["e1rm"].iloc[-1] / g["e1rm"].iloc[0] - 1) * 100, 1),
        "ult4_vs_previo_%": round((ult4["e1rm"].max() / previo["e1rm"].max() - 1) * 100, 1),
        "sesiones_desde_record": int((g["fecha"] > pr_fecha).sum()),
        "dias_desde_record": (g["fecha"].iloc[-1] - pr_fecha).days,
    })
prog = pd.DataFrame(filas).sort_values(["principal", "sesiones"], ascending=False)
prog.to_csv(OUT / "progresion_e1rm.csv", index=False)

# ---------- 5. Rangos de repeticiones, tipos de serie, RPE ----------
reps = con_carga["reps"]
rangos = pd.cut(reps, [0, 5, 8, 12, 15, 20, 100], labels=["1-5", "6-8", "9-12", "13-15", "16-20", ">20"]).value_counts().sort_index()
rangos.to_csv(OUT / "rangos_reps.csv", header=["series"])

# ---------- Informe en texto ----------
L = []
p = L.append
p(f"Periodo: {ses['inicio'].min().date()} -> {ses['inicio'].max().date()} ({len(semanas)} semanas)")
p(f"Sesiones: {len(ses)} | semanas con >=1 sesión: {len(activas)}/{len(semanas)}")
p(f"Media sesiones/semana (todas): {por_semana.mean():.2f} | (semanas activas): {por_semana[por_semana>0].mean():.2f}")
p(f"Distribución sesiones/semana: {por_semana.value_counts().sort_index().to_dict()}")
p(f"Sesiones por mes:\n{por_mes.to_string()}")
p(f"Huecos >=10 días:\n{huecos.to_string()}")
p(f"Duración (min): media {ses['duracion_min'].mean():.0f}, mediana {ses['duracion_min'].median():.0f}, min {ses['duracion_min'].min():.0f}, max {ses['duracion_min'].max():.0f}")
p(f"Series efectivas/sesión: media {ses['series_efectivas'].mean():.1f}")
p(f"Tipos de sesión: {ses['tipo'].value_counts().to_dict()}")
p(f"Tipos de serie: {df['set_type'].value_counts().to_dict()} | RPE registrado: {df['rpe'].notna().sum()} series")
p(f"Hora de inicio: {ses['inicio'].dt.hour.value_counts().sort_index().to_dict()}")
p(f"\nSeries por músculo/semana:\n{resumen_mus.to_string()}")
p(f"\nSeries por patrón:\n{equilibrio.to_string()}")
p(f"\nRangos de reps (series con carga):\n{rangos.to_string()}")
p(f"\nProgresión e1RM (>=3 sesiones):\n{prog.to_string(index=False)}")
p(f"\nSesiones:\n{ses[['inicio','titulo','tipo','duracion_min','series_efectivas']].to_string()}")
(OUT / "resumen.txt").write_text("\n".join(L), encoding="utf-8")
print("\n".join(L))

# ---------- Gráficas ----------
plt.rcParams.update({"figure.dpi": 110, "axes.spines.top": False, "axes.spines.right": False})
fig, ax = plt.subplots(figsize=(11, 3.6))
x = [s.start_time for s in por_semana.index]
ax.bar(x, por_semana.values, width=5, color="#4C72B0")
ax.axhline(3, color="#C44E52", ls="--", lw=1, label="Objetivo: 3 sesiones/semana")
ax.set_title("Sesiones por semana (Hevy)"); ax.set_ylabel("sesiones"); ax.legend(frameon=False)
fig.tight_layout(); fig.savefig(GRAF / "grafica-sesiones-semana.png"); plt.close(fig)

fig, ax = plt.subplots(figsize=(9, 4.5))
r = resumen_mus.drop(index=[m for m in ["antebrazo", "lumbar"] if m in resumen_mus.index])
r = r.sort_values("media_semanas_con_entreno")
ax.barh(r.index, r["media_semanas_con_entreno"], color="#4C72B0", label="Semanas con entreno")
ax.axvspan(10, 20, color="#55A868", alpha=0.12, label="Rango orientativo 10–20")
ax.set_title("Series efectivas por músculo y semana"); ax.set_xlabel("series/semana (secundarios = 0,5)")
ax.legend(frameon=False, loc="lower right")
fig.tight_layout(); fig.savefig(GRAF / "grafica-series-musculo.png"); plt.close(fig)

top = prog[prog["principal"]].nlargest(8, "sesiones")["ejercicio"]
fig, axs = plt.subplots(2, 4, figsize=(14, 6), sharex=True)
for ax, ex in zip(axs.flat, top):
    g = best[best["exercise_title"] == ex].sort_values("fecha")
    ax.plot(g["fecha"], g["e1rm"], marker="o", ms=3, color="#4C72B0")
    ax.set_title(ex, fontsize=9); ax.tick_params(labelsize=7, axis="x", rotation=45)
fig.suptitle("e1RM (Epley) por sesión — ejercicios principales")
fig.tight_layout(); fig.savefig(GRAF / "grafica-e1rm.png"); plt.close(fig)
