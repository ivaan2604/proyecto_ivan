// Bienvenida + "contraseña" (fecha o nombre vuestro).
import config from "../../contenido/config.js";
import { estado, guardar } from "../estado.js";
import { h, normalizar, rotar, sacudir, vibrar } from "../lib/ui.js";

/** @param {{ alEntrar: () => void }} params */
export function pantallaEntrada({ alEntrar }) {
  const en = config.entrada;
  let fallos = 0;

  const mensaje = h("p.mensaje", { "aria-live": "polite" });
  const zonaPista = h("div");
  const campo = /** @type {HTMLInputElement} */ (
    en.tipo === "fecha"
      ? h("input.campo", { type: "date", "aria-label": en.pregunta, required: true })
      : h("input.campo", { type: "text", autocomplete: "off", autocapitalize: "off", placeholder: "Escribe aquí…", "aria-label": en.pregunta })
  );

  const tarjeta = h(
    "form.tarjeta.candado-entrada",
    { onsubmit: comprobar, hidden: true },
    h("div.icono-candado", { "aria-hidden": "true" }, "🔒"),
    h("p.etiqueta", null, "Solo para ti"),
    h("h3", null, en.pregunta),
    campo,
    h("button.boton.ancho", { type: "submit" }, "Entrar"),
    mensaje,
    zonaPista,
  );

  const portada = h(
    "div.portada",
    null,
    h("div.ornamento.aparece", { style: "--i:0" }, h("span", null, "✦")),
    h("h1.aparece", { style: "--i:1" }, en.titulo, " ", h("span.emoji-titulo", null, en.emoji)),
    h("p.lead.aparece", { style: "--i:2" }, en.texto),
    h("button.boton.aparece", { style: "--i:3", onclick: empezar }, en.boton, " →"),
  );

  function empezar() {
    portada.classList.add("plegada");
    tarjeta.hidden = false;
    tarjeta.classList.add("aparece");
    setTimeout(() => campo.focus({ preventScroll: true }), 350);
  }

  /** @param {Event} ev */
  function comprobar(ev) {
    ev.preventDefault();
    const valor = campo.value.trim();
    if (!valor) {
      mensaje.className = "mensaje error";
      mensaje.textContent = en.tipo === "fecha" ? "Elige una fecha 📅" : "Escribe algo, aunque sea a voleo 😄";
      return;
    }
    const ok =
      en.tipo === "fecha"
        ? en.respuestas.includes(valor)
        : en.respuestas.some((r) => normalizar(r) === normalizar(valor));
    if (ok) {
      mensaje.className = "mensaje ok";
      mensaje.textContent = "¡Correcto! Adelante…";
      tarjeta.querySelector(".icono-candado").textContent = "🔓";
      vibrar([20, 40, 60]);
      estado.dentro = true;
      guardar();
      setTimeout(alEntrar, 700);
      return;
    }
    mensaje.className = "mensaje error";
    mensaje.textContent = rotar(en.mensajesFallo, fallos);
    fallos++;
    sacudir(tarjeta);
    if (fallos >= (en.fallosParaPista ?? 2) && en.pista && !zonaPista.firstChild)
      zonaPista.append(h("div.pista", null, h("span", null, "💡"), h("span", null, en.pista)));
  }

  return h("section.entrada.centrada", null, portada, tarjeta);
}
