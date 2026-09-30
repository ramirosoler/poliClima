from pathlib import Path
import pandas as pd
from flask import Flask, jsonify, render_template, request

BASE_DIR = Path(__file__).resolve().parent
app = Flask(__name__)
COLUMNAS = ["fecha", "temperatura", "precipitacion", "humedad"]


def procesar(df):
    df.columns = [str(c).strip().lower() for c in df.columns]
    df = df.rename(columns={"precipitación": "precipitacion"})
    faltan = [c for c in COLUMNAS if c not in df.columns]
    if faltan:
        raise ValueError("Faltan columnas: " + ", ".join(faltan))

    df = df[COLUMNAS].copy()
    total = len(df)
    
    # Lee fechas en formato 2024-02-27, 27/02/2024 o fecha de Excel
    texto = df["fecha"].astype(str).str.strip()
    fechas = pd.to_datetime(texto, errors="coerce", format="mixed", dayfirst=True)
    iso = texto.str.match(r"^\d{4}-\d{2}-\d{2}")
    fechas[iso] = pd.to_datetime(texto[iso].str[:10], errors="coerce")
    df["fecha"] = fechas.dt.normalize()
    
    for columna in COLUMNAS[1:]:
        df[columna] = pd.to_numeric(
            df[columna].astype(str).str.replace(",", ".", regex=False), errors="coerce"
        )

    df = df.dropna(subset=["fecha"])
    if df.empty:
        raise ValueError("El archivo no contiene fechas válidas")
    validos = int(df[COLUMNAS[1:]].notna().all(axis=1).sum())

    # Un registro por día: promedio de temperatura/humedad y suma de lluvia
    df = df.groupby("fecha").agg(
        temperatura=("temperatura", "mean"),
        precipitacion=("precipitacion", "sum"),
        humedad=("humedad", "mean"),
    )
    
    # Todos los días del calendario, sin excepción; los faltantes se interpolan
    df = df.reindex(pd.date_range(df.index.min(), df.index.max(), freq="D"))
    df = df.interpolate(limit_direction="both").round(1).reset_index()
    df.columns = COLUMNAS

    return {
        "resumen": {
            "temperatura": round(df["temperatura"].mean(), 1),
            "precipitacion": round(df["precipitacion"].sum(), 1),
            "humedad": round(df["humedad"].mean(), 1),
            "calidad": round(validos / total * 100, 1) if total else 0,
            "total": total,
            "validos": validos,
        },
        "registros": [
            {
                "fecha": fecha.strftime("%Y-%m-%d"),
                "temperatura": temperatura,
                "precipitacion": precipitacion,
                "humedad": humedad,
            }
            for fecha, temperatura, precipitacion, humedad in df.itertuples(index=False)
        ],
    }


def leer_csv(archivo):
    try:
        return pd.read_csv(archivo, sep=None, engine="python")
    except UnicodeDecodeError:
        if hasattr(archivo, "seek"):
            archivo.seek(0)
        return pd.read_csv(archivo, sep=None, engine="python", encoding="latin-1")


@app.route("/")
def inicio():
    return render_template("index.html")


@app.route("/api/demo")
def demo():
    try:
        ruta_ejemplo = BASE_DIR / "datos" / "ejemplo.csv"
        
        # Si el archivo no existe en el servidor de Render, se generan datos de prueba
        if not ruta_ejemplo.is_file():
            fechas_demo = pd.date_range("2026-03-01", "2026-03-05", freq="D")
            df_backup = pd.DataFrame({
                "fecha": fechas_demo.strftime("%Y-%m-%d"),
                "temperatura": [18.2, 19.0, 17.5, 18.8, 19.2],
                "precipitacion": [0.0, 3.2, 12.0, 1.5, 0.0],
                "humedad": [72, 75, 88, 80, 71]
            })
            return jsonify(procesar(df_backup))

        df = pd.read_csv(ruta_ejemplo)
        return jsonify(procesar(df))
    except Exception as error:
        return jsonify({"error": f"Error al cargar la demo: {str(error)}"}), 500


@app.route("/api/subir", methods=["POST"])
def subir():
    archivo = request.files.get("archivo")
    if not archivo or archivo.filename == "":
        return jsonify({"error": "No seleccionaste ningún archivo"}), 400

    nombre = archivo.filename.lower()
    try:
        if nombre.endswith(".csv"):
            df = leer_csv(archivo)
        elif nombre.endswith(".xlsx"):
            df = pd.read_excel(archivo, engine="openpyxl")
        else:
            return jsonify({"error": "Solo se aceptan archivos .csv o .xlsx"}), 400
        return jsonify(procesar(df))
    except Exception as error:
        return jsonify({"error": str(error)}), 400


if __name__ == "__main__":
    print("PoliClima está listo en http://127.0.0.1:5000")
    app.run(debug=True)
