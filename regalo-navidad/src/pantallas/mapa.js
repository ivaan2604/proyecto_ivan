// Mapa: camino con los niveles, barra de progreso y acceso al inventario.
import config from "../../contenido/config.js";
import { estado } from "../estado.js";
import { ir } from "../navegacion.js";
import { disponible, letras, niveles, porcentaje, siguiente, superado, todosSuperados } from "../progreso.js";
import { h, aviso } from "../lib/ui.js";
import { abrirInventario } from "./inventario.js";

/** @param {{ desde?: number }} params  porcentaje anterior (para animar la barra) */
export function pantallaMapa({ desde } = {}) {
  const pct = porcentaje();
  const proximo = siguiente();
  const hechos = niveles.filter((n) => superado(n.id)).length;
  const nLetras = letras().length;

  const relleno = h("div.barra-relleno", { style: { width: `${desde ?? pct}%` } });
  const cifra = h("strong", null, `${desde ?? pct}%`);
  requestAnimationFrame(() =>
    setTimeout(() => {
      relleno.style.width = `${pct}%`;
      animarCifra(cifra, desde ?? pct, pct);
    }, 450),
  );

  const cabecera = h(
    "header.mapa-cabecera",
    null,
    h("div", null, h("p.etiqueta", null, `Hola, ${config.ella}`), h("h2", null, "Tu regalo te espera")),
    h(
      "button.boton-inventario",
      { onclick: () => abrirInventario(), "aria-label": `Inventario: ${nLetras} letras` },
      h("span", { "aria-hidden": "true" }, "🎒"),
      nLetras ? h("span.insignia", null, nLetras) : null,
    ),
  );

  const progreso = h(
    "div.progreso.tarjeta",
    null,
    h("div.progreso-texto", null, h("span", null, "Regalo desbloqueado"), cifra),
    h("div.barra", { role: "progressbar", "aria-valuenow": pct, "aria-valuemin": 0, "aria-valuemax": 100 }, relleno),
    h("p.suave.progreso-detalle", null, `${hechos} de ${niveles.length} pruebas · ${nLetras} ${nLetras === 1 ? "letra" : "letras"} conseguidas`),
  );

  const paradas = niveles.map((n, i) => {
    const hecho = superado(n.id);
    const libre = disponible(i);
    const actual = i === proximo;
    const estadoTxt = hecho ? "Superado ✓" : libre ? "¡Juega!" : config.modo === "tesoro" ? "Busca su tarjeta 🔎" : "Bloqueado";
    return h(
      `button.parada${hecho ? ".hecha" : ""}${libre && !hecho ? ".libre" : ""}${actual ? ".actual" : ""}${i % 2 ? ".derecha" : ""}`,
      {
        style: `--i:${i}`,
        onclick: () => {
          if (libre) ir("nivel", { indice: i });
          else if (config.modo === "tesoro") aviso("Este nivel está escondido en algún sitio de casa… 🔎");
          else aviso(`Primero supera “${niveles[i - 1].titulo}” 😉`);
        },
        "aria-label": `Nivel ${i + 1}: ${n.titulo}. ${estadoTxt}`,
      },
      h("span.parada-circulo", null, hecho ? "✓" : libre ? n.emoji : "🔒"),
      h("span.parada-texto", null, h("small", null, `Nivel ${i + 1}`), h("b", null, libre || hecho ? n.titulo : "???"), h("em", null, estadoTxt)),
    );
  });

  const finalLibre = todosSuperados();
  const final = h(
    `button.parada.parada-final${finalLibre ? ".libre.actual" : ""}`,
    {
      style: `--i:${niveles.length}`,
      onclick: () => {
        if (estado.abierto) ir("regalo");
        else if (finalLibre) ir("candado");
        else aviso(`Te faltan ${niveles.length - hechos} pruebas para llegar aquí 🎁`);
      },
    },
    h("span.parada-circulo", null, "🎁"),
    h(
      "span.parada-texto",
      null,
      h("small", null, "Final"),
      h("b", null, estado.abierto ? config.regalo.nombre : "El último candado"),
      h("em", null, estado.abierto ? "Abierto ✓ · Ver regalo" : finalLibre ? "¡Ya puedes abrirlo!" : "Bloqueado"),
    ),
  );

  return h(
    "section.mapa",
    null,
    cabecera,
    progreso,
    h("nav.camino", { "aria-label": "Niveles" }, paradas, final),
  );
}

function animarCifra(el, de, a) {
  if (de === a) return;
  const t0 = performance.now();
  const dur = 1100;
  (function paso(t) {
    const k = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = `${Math.round(de + (a - de) * e)}%`;
    if (k < 1) requestAnimationFrame(paso);
  })(t0);
}
