// Caja de regalo en 3D (CSS) que se abre al tocar el lazo.
import { h, esperar, vibrar } from "../lib/ui.js";

/**
 * @param {any} regalo   config.regalo
 * @param {() => void} alTocar
 */
export function crearCaja(regalo, alTocar) {
  const caras = (prefijo, nombres) => nombres.map((n) => h(`div.cara.${prefijo}-${n}`));

  const tarjeta = h(
    "div.carta-salida",
    null,
    h("span.carta-emoji", null, regalo.emoji || "🎁"),
    h("small", null, "Tu regalo es…"),
    h("strong", null, regalo.nombre),
  );

  const lazo = h(
    "button.lazo",
    { "aria-label": "Tirar del lazo para abrir la caja", onclick: () => alTocar() },
    h("span.lazo-bucle.izq"),
    h("span.lazo-bucle.der"),
    h("span.lazo-cola.izq"),
    h("span.lazo-cola.der"),
    h("span.lazo-nudo"),
  );

  const escena = h(
    "div.escena-caja",
    null,
    h("div.rayos", { "aria-hidden": "true" }),
    h(
      "div.caja",
      null,
      h("div.cuerpo", null, caras("c", ["fondo", "detras", "izq", "der"]), h("div.luz-interior"), tarjeta, caras("c", ["frente"])),
      h("div.tapa", null, caras("t", ["arriba", "frente", "detras", "izq", "der"]), lazo),
    ),
    h("div.sombra-caja", { "aria-hidden": "true" }),
  );

  async function abrir() {
    escena.classList.add("desatando");
    vibrar(20);
    await esperar(700);
    escena.classList.add("abriendo");
    vibrar([30, 40, 30]);
    await esperar(650);
    escena.classList.add("saliendo-carta");
    await esperar(1300);
    escena.classList.add("revelada");
  }

  return { el: escena, abrir };
}
