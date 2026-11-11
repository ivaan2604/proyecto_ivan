// Sobre con sello de lacre que se rompe al tocarlo.
import { h, esperar, vibrar } from "../lib/ui.js";

/**
 * @param {any} regalo   config.regalo
 * @param {string} inicial  letra del sello
 * @param {() => void} alTocar
 */
export function crearSobre(regalo, inicial, alTocar) {
  const carta = h(
    "div.carta-sobre",
    null,
    h("span.carta-emoji", null, regalo.emoji || "🎁"),
    h("small", null, "Tu regalo es…"),
    h("strong", null, regalo.nombre),
  );
  const sello = h(
    "button.sello",
    { "aria-label": "Romper el sello para abrir el sobre", onclick: () => alTocar() },
    h("span.sello-mitad.izq", null, h("span", null, inicial)),
    h("span.sello-mitad.der", null, h("span", null, inicial)),
  );
  const escena = h(
    "div.escena-sobre",
    null,
    h("div.rayos", { "aria-hidden": "true" }),
    h("div.sobre", null, h("div.sobre-fondo"), carta, h("div.sobre-frente"), h("div.solapa"), sello),
  );

  async function abrir() {
    escena.classList.add("roto");
    vibrar([40, 30, 20]);
    await esperar(600);
    escena.classList.add("abierto");
    await esperar(800);
    escena.classList.add("saliendo-carta");
    await esperar(900);
    escena.classList.add("carta-delante");
    await esperar(60);
    escena.classList.add("revelada");
    await esperar(700);
  }

  return { el: escena, abrir };
}
