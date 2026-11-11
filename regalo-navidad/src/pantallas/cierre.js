// Carta final.
import config from "../../contenido/config.js";
import { ir } from "../navegacion.js";
import { h } from "../lib/ui.js";
import { abrirInventario } from "./inventario.js";

export function pantallaCierre() {
  const c = config.cierre;
  return h(
    "section.cierre",
    null,
    h("p.etiqueta.centrado.aparece", null, c.titulo),
    h(
      "article.carta-final.despliega",
      null,
      c.carta.map((p, i) => h("p.aparece", { style: `--i:${i + 3}` }, p)),
      h("p.firma.aparece", { style: `--i:${c.carta.length + 4}` }, c.firma, " ♥"),
    ),
    h(
      "div.fila.centrada.aparece",
      { style: `--i:${c.carta.length + 5}` },
      h("button.boton.fantasma.pequeno", { onclick: () => abrirInventario("recuerdos") }, "📸 Nuestros recuerdos"),
      h("button.boton.fantasma.pequeno", { onclick: () => ir("regalo") }, "🎁 Mi regalo"),
    ),
  );
}
