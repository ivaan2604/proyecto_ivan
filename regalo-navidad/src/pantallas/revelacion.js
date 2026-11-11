// La gran revelación: caja 3D o sobre lacrado (según config.revelacion).
import config from "../../contenido/config.js";
import { estado, guardar } from "../estado.js";
import { ir } from "../navegacion.js";
import { crearCaja } from "../efectos/caja.js";
import { crearSobre } from "../efectos/sobre.js";
import { confetiFinal } from "../efectos/confeti.js";
import { h } from "../lib/ui.js";

/** @param {{ tipo?: "caja"|"sobre", demo?: boolean }} params */
export function pantallaRevelacion({ tipo = config.revelacion, demo = false } = {}) {
  const r = config.regalo;
  let abriendo = false;
  const instruccion = h("p.lead.instruccion", null, tipo === "caja" ? "Toca el lazo para abrirla 👆" : "Rompe el sello para abrirlo 👆");
  const despues = h("div.despues");

  const alTocar = async () => {
    if (abriendo) return;
    abriendo = true;
    instruccion.classList.add("oculta");
    await escena.abrir();
    confetiFinal();
    if (!demo) {
      estado.abierto = true;
      guardar();
    }
    despues.replaceChildren(
      h("p.subtitulo-regalo.aparece", null, r.subtitulo),
      h("button.boton.oro.ancho.aparece", { style: "--i:1", onclick: () => ir("regalo", { demo }) }, "Ver todos los detalles →"),
      demo
        ? h(
            "div.fila.centrada.aparece",
            { style: "--i:2" },
            h("button.boton.fantasma.pequeno", { onclick: () => ir("revelacion", { tipo, demo }) }, "↺ Repetir"),
            h("button.boton.fantasma.pequeno", { onclick: () => ir("revelacion", { tipo: tipo === "caja" ? "sobre" : "caja", demo }) }, tipo === "caja" ? "Ver el sobre ✉️" : "Ver la caja 🎁"),
          )
        : null,
    );
  };

  const escena = tipo === "sobre" ? crearSobre(r, (config.ella || "♥")[0].toUpperCase(), alTocar) : crearCaja(r, alTocar);

  return h(
    "section.revelacion.centrada",
    null,
    h("p.etiqueta.aparece", null, demo ? `Vista previa · ${tipo}` : "Lo has conseguido"),
    h("h1.aparece", { style: "--i:1" }, `Tu regalo, ${config.ella}`),
    h("div.zona-escena", null, escena.el),
    instruccion,
    despues,
  );
}
