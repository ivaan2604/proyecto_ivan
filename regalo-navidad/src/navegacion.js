// Cambio de pantalla con transición suave.
import { esperar } from "./lib/ui.js";

/** @type {Record<string, (params: any) => HTMLElement>} */
const pantallas = {};
let actual = "";

/** @param {string} nombre @param {(params: any) => HTMLElement} fn */
export function registrar(nombre, fn) {
  pantallas[nombre] = fn;
}

export const pantallaActual = () => actual;

/** Ejecuta `fn` cuando la pantalla `el` se quite (para parar temporizadores, etc.) */
export function alDesmontar(el, fn) {
  el.addEventListener("desmontar", fn, { once: true });
}

let enCurso = Promise.resolve();

/** Pantallas "raíz": no dejan entrada en el historial del navegador */
const RAIZ = ["mapa", "entrada"];

/** @param {string} nombre @param {any} [params] */
export function ir(nombre, params = {}) {
  // Así el botón "atrás" del móvil vuelve al mapa en vez de salir de la web
  if (!RAIZ.includes(nombre)) history.pushState({ p: nombre }, "");
  enCurso = enCurso.then(async () => {
    const app = /** @type {HTMLElement} */ (document.getElementById("app"));
    const vieja = /** @type {HTMLElement | null} */ (app.firstElementChild);
    if (vieja) {
      vieja.classList.add("saliendo");
      await esperar(230);
      vieja.dispatchEvent(new Event("desmontar"));
      vieja.remove();
    }
    actual = nombre;
    const nueva = pantallas[nombre](params);
    nueva.classList.add("pantalla", "entrando");
    nueva.dataset.pantalla = nombre;
    app.append(nueva);
    window.scrollTo(0, 0);
    requestAnimationFrame(() => requestAnimationFrame(() => nueva.classList.remove("entrando")));
  });
  return enCurso;
}

/** Botón "atrás": cierra capas abiertas y vuelve al mapa */
export function activarBotonAtras(puedeIrAlMapa) {
  window.addEventListener("popstate", () => {
    document.querySelector(".capa")?.remove();
    if (puedeIrAlMapa() && !RAIZ.includes(actual)) ir("mapa");
  });
}
