let registros = [];
let periodoActual = "diario";
const graficas = {};

const menuLateral = document.getElementById("menuLateral");
const fondoMenu = document.getElementById("fondoMenu");
const contraerMenu = document.getElementById("contraerMenu");

document.getElementById("abrirMenu").addEventListener("click", () => {
  menuLateral.classList.remove("-translate-x-full");
  fondoMenu.classList.remove("hidden");
});

fondoMenu.addEventListener("click", () => {
  menuLateral.classList.add("-translate-x-full");
  fondoMenu.classList.add("hidden");
});

contraerMenu.addEventListener("click", () => {
  const contraido = menuLateral.classList.toggle("contraido");
  contraerMenu.textContent = contraido ? "›" : "‹";
  contraerMenu.setAttribute("aria-label", contraido ? "Expandir menú" : "Contraer menú");
});

document.querySelectorAll(".enlace-menu").forEach(enlace => {
  enlace.addEventListener("click", () => {
    document.querySelectorAll(".enlace-menu").forEach(item => item.classList.remove("activo"));
    enlace.classList.add("activo");
    if (window.innerWidth < 768) {
      menuLateral.classList.add("-translate-x-full");
      fondoMenu.classList.add("hidden");
    }
  });
});

const colores = {
  marino: "#173557",
  cielo: "#3DB2DE",
  verde: "#22A06B",
  cuadricula: "#E2E8F0",
  texto: "#64748B"
};

function opcionesGrafica(unidad, minimo, periodo) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: colores.marino,
        padding: 12,
        displayColors: false,
        callbacks: { label: contexto => `${contexto.parsed.y} ${unidad}` }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { autoSkip: false, maxRotation: 90, minRotation: 0,
          color: colores.texto,
          callback: function(valor) {
            const fecha = this.getLabelForValue(valor);
            const partes = fecha.split("-");
            if (periodo === "diario" && partes.length === 3) return `${partes[2]}/${partes[1]}`;
            if (periodo === "mensual" && partes.length === 2) return `${partes[1]}/${partes[0]}`;
            return fecha;
          }
        }
      },
      y: {
        beginAtZero: minimo === 0,
        suggestedMin: minimo,
        grid: { color: colores.cuadricula },
        ticks: { color: colores.texto, callback: valor => `${valor} ${unidad}` }
      }
    }
  };
}

function crearGrafica(id, tipo, datos, valores, etiqueta, unidad, color, minimo, relleno = false) {
  if (graficas[id]) graficas[id].destroy();
  graficas[id] = new Chart(document.getElementById(id), {
    type: tipo,
    data: {
      labels: datos.map(registro => registro.fecha),
      datasets: [{
        label: etiqueta,
        data: valores,
        borderColor: color,
        backgroundColor: tipo === "bar" ? color : `${color}20`,
        borderWidth: tipo === "bar" ? 0 : 2.5,
        borderRadius: tipo === "bar" ? 4 : 0,
        pointRadius: datos.length > 35 ? 0 : 2,
        pointHoverRadius: 5,
        fill: relleno,
        tension: 0.3
      }]
    },
    options: opcionesGrafica(unidad, minimo, periodoActual)
  });
}

function agruparRegistros(periodo) {
  if (periodo === "diario") return registros;

  const grupos = {};
  registros.forEach(registro => {
    const clave = periodo === "mensual" ? registro.fecha.slice(0, 7) : registro.fecha.slice(0, 4);
    if (!grupos[clave]) grupos[clave] = { fecha: clave, temperaturas: [], precipitacion: 0, humedades: [] };
    grupos[clave].temperaturas.push(Number(registro.temperatura));
    grupos[clave].precipitacion += Number(registro.precipitacion);
    grupos[clave].humedades.push(Number(registro.humedad));
  });

  return Object.values(grupos).map(grupo => ({
    fecha: grupo.fecha,
    temperatura: Number((grupo.temperaturas.reduce((a, b) => a + b, 0) / grupo.temperaturas.length).toFixed(1)),
    precipitacion: Number(grupo.precipitacion.toFixed(1)),
    humedad: Number((grupo.humedades.reduce((a, b) => a + b, 0) / grupo.humedades.length).toFixed(1))
  }));
}

function actualizarGraficas() {
  const datos = agruparRegistros(periodoActual);
  const nombres = { diario: "diarias", mensual: "mensuales", anual: "anuales" };
  const unidadNombre = { diario: "diaria", mensual: "mensual", anual: "anual" };
  const nombre = nombres[periodoActual];
  const unidad = unidadNombre[periodoActual];

  document.getElementById("tituloGraficas").textContent = `Gráficas climáticas ${nombre}`;
  document.getElementById("descripcionPeriodo").textContent = periodoActual === "diario" ? "Un punto por cada fecha del archivo" : `Datos agrupados por período ${unidad}`;
  document.getElementById("tituloTemperatura").textContent = `Temperatura ${unidad}`;
  document.getElementById("tituloPrecipitacion").textContent = `Precipitación ${unidad}`;
  document.getElementById("tituloHumedad").textContent = `Humedad ${unidad}`;

  crearGrafica("graficaTemperatura", "line", datos, datos.map(x => x.temperatura), "Temperatura", "°C", colores.cielo, undefined, true);
  crearGrafica("graficaPrecipitacion", "bar", datos, datos.map(x => x.precipitacion), "Precipitación", "mm", colores.marino, 0);
  crearGrafica("graficaHumedad", "line", datos, datos.map(x => x.humedad), "Humedad", "%", colores.verde, 0, true);
}

document.querySelectorAll(".boton-periodo").forEach(boton => {
  boton.addEventListener("click", () => {
    periodoActual = boton.dataset.periodo;
    document.querySelectorAll(".boton-periodo").forEach(item => item.classList.remove("activo"));
    boton.classList.add("activo");
    actualizarGraficas();
  });
});

function mostrar(datos) {
  const resumen = datos.resumen;
  registros = datos.registros;

  document.getElementById("temp").textContent = resumen.temperatura;
  document.getElementById("prec").textContent = resumen.precipitacion;
  document.getElementById("hum").textContent = resumen.humedad;
  document.getElementById("cal").textContent = resumen.calidad;
  document.getElementById("barra").style.width = `${resumen.calidad}%`;
  document.getElementById("cantidad").textContent = `${registros.length} registros`;

  document.getElementById("filas").innerHTML = registros.slice().reverse().map(registro => `
    <tr class="border-b border-slate-100 last:border-0 hover:bg-slate-50">
      <td class="px-5 py-3 font-semibold">${registro.fecha}</td>
      <td class="px-5 py-3">${registro.temperatura} °C</td>
      <td class="px-5 py-3">${registro.precipitacion} mm</td>
      <td class="px-5 py-3">${registro.humedad} %</td>
    </tr>`).join("");

  actualizarGraficas();
}

function estado(texto, error = false) {
  const elemento = document.getElementById("estado");
  elemento.textContent = texto;
  elemento.className = `mt-1 text-sm ${error ? "text-red-600" : "text-slate-500"}`;
}

async function cargarDemo() {
  try {
    const respuesta = await fetch("/api/demo");
    const datos = await respuesta.json();
    if (!respuesta.ok || datos.error) throw new Error(datos.error || "No se pudo cargar el ejemplo");
    mostrar(datos);
    estado(`Ejemplo cargado: ${datos.resumen.validos} filas válidas`);
  } catch (error) {
    estado(error.message, true);
  }
}

document.getElementById("archivo").addEventListener("change", async evento => {
  const archivo = evento.target.files[0];
  if (!archivo) return;

  const formulario = new FormData();
  formulario.append("archivo", archivo);
  estado(`Procesando ${archivo.name}...`);

  try {
    const respuesta = await fetch("/api/subir", { method: "POST", body: formulario });
    const datos = await respuesta.json();
    if (!respuesta.ok || datos.error) throw new Error(datos.error || "No se pudo procesar el archivo");
    mostrar(datos);
    estado(`${archivo.name}: ${datos.resumen.validos} de ${datos.resumen.total} filas válidas`);
  } catch (error) {
    estado(error.message, true);
  } finally {
    evento.target.value = "";
  }
});

document.getElementById("exportar").addEventListener("click", () => {
  if (!registros.length) return estado("No hay datos para exportar", true);
  const texto = "fecha,temperatura,precipitacion,humedad\n" + registros.map(x => `${x.fecha},${x.temperatura},${x.precipitacion},${x.humedad}`).join("\n");
  const url = URL.createObjectURL(new Blob([texto], { type: "text/csv;charset=utf-8" }));
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = "policlima_datos_procesados.csv";
  enlace.click();
  URL.revokeObjectURL(url);
});

cargarDemo();
