// Recompensa tras superar un nivel: recuerdo + pista + letra(s).
import { ir } from "../navegacion.js";
import { niveles, todosSuperados } from "../progreso.js";
import { rutaFoto } from "../lib/fotos.js";
import { h } from "../lib/ui.js";
import { ficha } from "./inventario.js";

const TITULOS = ["¡Bien hecho!", "¡Lo has clavado!", "¡Así se hace!", "¡Toma ya!", "¡Impecable!"];

/** @param {{ indice: number, desde: number }} params */
export function pantallaRecompensa({ indice, desde }) {
  const n = niveles[indice];
  const r = n.recompensa;
  const letras = [...r.letras.toUpperCase()];
  const ultimo = todosSuperados();

  return h(
    "section.recompensa",
    null,
    h("div.centrado", null, h("p.etiqueta.aparece", null, `Nivel ${indice + 1} superado`), h("h1.aparece", { style: "--i:1" }, TITULOS[indice % TITULOS.length])),
    h(
      "figure.polaroid.cae",
      { style: `--giro:${indice % 2 ? 2.5 : -2.5}deg` },
      h("img", { src: rutaFoto(r.foto), alt: r.frase }),
      h("figcaption", null, h("span.pie", null, r.frase), r.fecha ? h("small", null, r.fecha) : null),
    ),
    h(
      "div.tarjeta.premio.aparece",
      { style: "--i:4" },
      h("p.etiqueta", null, "🔎 Pista sobre tu regalo"),
      h("p.premio-texto", null, r.pista),
    ),
    h(
      "div.tarjeta.premio.aparece",
      { style: "--i:5" },
      h("p.etiqueta", null, letras.length > 1 ? "🔤 Has ganado estas letras" : "🔤 Has ganado una letra"),
      h("div.fichas.grandes", null, letras.map((l, i) => ficha(l, i + 7))),
    ),
    h(
      "button.boton.ancho.aparece",
      { style: "--i:6", onclick: () => ir("mapa", { desde }) },
      ultimo ? "¡Al último candado! 🎁" : "Continuar →",
    ),
  );
}
