// Inventario: hoja inferior con pistas, letras y recuerdos conseguidos.
import config from "../../contenido/config.js";
import { letras, nivelesSuperados, niveles } from "../progreso.js";
import { rutaFoto } from "../lib/fotos.js";
import { h } from "../lib/ui.js";

/** @param {"pistas"|"letras"|"recuerdos"} [pestana] */
export function abrirInventario(pestana = "pistas") {
  const conseguidos = nivelesSuperados();
  const lts = letras();

  const contenidos = {
    pistas: () =>
      conseguidos.length
        ? h(
            "ol.lista-pistas",
            null,
            conseguidos.map((n, i) => h("li.aparece", { style: `--i:${i}` }, h("span.num", null, i + 1), h("span", null, n.recompensa.pista))),
          )
        : vacio("Todavía no tienes pistas. Supera un nivel para conseguir la primera."),
    letras: () =>
      h(
        "div",
        null,
        h(
          "div.fichas",
          null,
          lts.map((l, i) => ficha(l, i)),
          Array.from({ length: config.palabraFinal.length - lts.length }, () => h("span.ficha.hueco", { "aria-hidden": "true" }, "?")),
        ),
        h(
          "p.suave.centrado",
          null,
          lts.length === config.palabraFinal.length
            ? "¡Las tienes todas! Ve al final del mapa para usarlas."
            : `${lts.length} de ${config.palabraFinal.length} letras. Forman una palabra secreta… pero no en este orden 😉`,
        ),
      ),
    recuerdos: () =>
      conseguidos.length
        ? h(
            "div.album",
            null,
            conseguidos.map((n, i) =>
              h(
                "button.polaroid.mini.aparece",
                { style: `--i:${i}; --giro:${i % 2 ? 2 : -2}deg`, onclick: () => verRecuerdo(n) },
                h("img", { src: rutaFoto(n.recompensa.foto, true), alt: n.recompensa.frase, loading: "lazy" }),
                h("span.pie", null, n.recompensa.fecha),
              ),
            ),
          )
        : vacio("Aquí irán apareciendo nuestros recuerdos."),
  };

  const cuerpo = h("div.hoja-cuerpo");
  const pestanas = /** @type {const} */ (["pistas", "letras", "recuerdos"]);
  const botones = pestanas.map((p) =>
    h("button.pestana", { role: "tab", onclick: () => mostrar(p) }, { pistas: "🔎 Pistas", letras: "🔤 Letras", recuerdos: "📸 Recuerdos" }[p]),
  );

  function mostrar(p) {
    botones.forEach((b, i) => b.setAttribute("aria-selected", String(pestanas[i] === p)));
    cuerpo.replaceChildren(contenidos[p]());
  }

  const fondo = h("div.hoja-fondo", { onclick: cerrar });
  const hoja = h(
    "div.hoja",
    { role: "dialog", "aria-modal": "true", "aria-label": "Inventario" },
    h("div.hoja-asa", { "aria-hidden": "true" }),
    h("div.hoja-cabecera", null, h("h2", null, "Inventario"), h("button.cerrar", { onclick: cerrar, "aria-label": "Cerrar" }, "✕")),
    h("div.pestanas", { role: "tablist" }, botones),
    cuerpo,
    h("p.suave.hoja-pie", null, `${conseguidos.length}/${niveles.length} niveles superados`),
  );
  const capa = h("div.capa", null, fondo, hoja);

  function cerrar() {
    capa.classList.remove("abierta");
    document.removeEventListener("keydown", tecla);
    setTimeout(() => capa.remove(), 350);
  }
  const tecla = (e) => e.key === "Escape" && cerrar();
  document.addEventListener("keydown", tecla);

  mostrar(pestana);
  document.body.append(capa);
  requestAnimationFrame(() => requestAnimationFrame(() => capa.classList.add("abierta")));
}

const vacio = (txt) => h("p.vacio", null, txt);

export function ficha(letra, i = 0) {
  // Puntuación tipo Scrabble, solo decorativa
  const puntos = { A: 1, E: 1, O: 1, S: 1, R: 1, N: 1, L: 1, U: 1, I: 1, T: 1, D: 2, G: 2, C: 3, B: 3, M: 3, P: 3, H: 4, F: 4, V: 4, Y: 4, Q: 5, J: 8, Ñ: 8, X: 8, Z: 10, K: 10, W: 10 };
  return h("span.ficha.aparece", { style: `--i:${i}` }, letra, h("sub", null, puntos[letra] ?? 1));
}

/** Recuerdo a pantalla completa */
export function verRecuerdo(n) {
  const capa = h(
    "div.capa.visor",
    { onclick: () => cerrar() },
    h(
      "figure.polaroid.grande",
      null,
      h("img", { src: rutaFoto(n.recompensa.foto), alt: "" }),
      h("figcaption", null, h("span.pie", null, n.recompensa.frase), h("small", null, n.recompensa.fecha)),
    ),
  );
  function cerrar() {
    capa.classList.remove("abierta");
    setTimeout(() => capa.remove(), 300);
  }
  document.body.append(capa);
  requestAnimationFrame(() => requestAnimationFrame(() => capa.classList.add("abierta")));
}
