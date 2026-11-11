// Envoltorio común de cada nivel: cabecera, zona de juego, ayudas y comodín.
import { fallosDe, sesion, sumarFallo } from "../estado.js";
import { alDesmontar, ir } from "../navegacion.js";
import { marcarSuperado, niveles, porcentaje } from "../progreso.js";
import { confetiPequeno } from "../efectos/confeti.js";
import { h, vibrar } from "../lib/ui.js";
import { quiz } from "../juegos/quiz.js";
import { memory } from "../juegos/memory.js";
import { donde } from "../juegos/donde.js";
import { rasca } from "../juegos/rasca.js";
import { puzzle } from "../juegos/puzzle.js";

const JUEGOS = { quiz, memory, donde, rasca, puzzle };

/** A partir de estos fallos aparece el comodín para saltar la prueba */
const FALLOS_COMODIN = 5;

/**
 * Lo que recibe cada minijuego.
 * @typedef {Object} ContextoJuego
 * @property {import('../tipos.js').Nivel} nivel
 * @property {() => number} fallo           registra un fallo; devuelve el total del nivel
 * @property {() => number} fallos
 * @property {(texto?: string) => void} mostrarAyuda
 * @property {() => void} superar
 * @property {(fn: () => void) => void} alSalir   limpieza (temporizadores…)
 */

/** @param {{ indice: number }} params */
export function pantallaNivel({ indice }) {
  const n = niveles[indice];
  const zonaAyuda = h("div.zona-ayuda", { "aria-live": "polite" });
  const zonaJuego = h(`div.juego.juego-${n.tipo}`);
  let terminado = false;

  const pantalla = h(
    "section.nivel",
    null,
    h(
      "header.nivel-cabecera",
      null,
      h("button.volver", { onclick: () => ir("mapa"), "aria-label": "Volver al mapa" }, "← Mapa"),
      h("span.etiqueta", null, `Nivel ${indice + 1} de ${niveles.length}`),
    ),
    h("div.nivel-titulo.aparece", null, h("span.nivel-emoji", { "aria-hidden": "true" }, n.emoji), h("h1", null, n.titulo)),
    n.intro ? h("p.lead.aparece", { style: "--i:1" }, n.intro) : null,
    h("div.aparece", { style: "--i:2" }, zonaJuego),
    zonaAyuda,
  );

  const comodin = h(
    "button.enlace",
    {
      onclick: () => {
        comodin.disabled = true;
        ctx.superar();
      },
    },
    "Vale, te la regalo… pero me debes un beso 😘 (saltar prueba)",
  );

  /** @type {ContextoJuego} */
  const ctx = {
    nivel: n,
    fallo() {
      const total = sumarFallo(n.id);
      if (total >= FALLOS_COMODIN && (n.tipo === "quiz" || n.tipo === "donde") && !comodin.isConnected) zonaAyuda.append(comodin);
      return total;
    },
    fallos: () => fallosDe(n.id),
    mostrarAyuda(texto = n.ayuda?.texto) {
      if (!texto || zonaAyuda.querySelector(".pista")) return;
      zonaAyuda.prepend(h("div.pista", null, h("span", null, "💡"), h("span", null, texto)));
    },
    superar() {
      if (terminado) return;
      terminado = true;
      const desde = porcentaje();
      marcarSuperado(n.id);
      vibrar([30, 50, 80]);
      confetiPequeno();
      setTimeout(() => ir("recompensa", { indice, desde }), 650);
    },
    alSalir: (fn) => alDesmontar(pantalla, fn),
  };

  JUEGOS[n.tipo](zonaJuego, ctx);

  if (sesion.tester)
    pantalla.append(h("div.tester", null, h("button", { onclick: () => ctx.superar() }, "⏭ Superar nivel (tester)")));

  return pantalla;
}
