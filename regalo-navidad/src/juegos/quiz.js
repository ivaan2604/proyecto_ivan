// QUIZ: preguntas con varias opciones, una a una.
import { h, sacudir, vibrar } from "../lib/ui.js";

/** @param {HTMLElement} cont @param {import('../pantallas/nivel.js').ContextoJuego} ctx */
export function quiz(cont, ctx) {
  const { preguntas } = ctx.nivel.datos;
  const ayuda = ctx.nivel.ayuda;
  let i = 0;

  function pintar() {
    const p = preguntas[i];
    let fallosAqui = 0;
    const mensaje = h("p.mensaje", { "aria-live": "polite" });
    const siguiente = h("button.boton.ancho", { hidden: true, onclick: avanzar }, i === preguntas.length - 1 ? "¡Terminar! ✨" : "Siguiente →");

    const opciones = p.opciones.map((texto, j) =>
      h("button.opcion", { onclick: () => elegir(j) }, h("span.opcion-letra", null, "ABCDEFG"[j]), h("span", null, texto)),
    );

    function elegir(j) {
      const btn = opciones[j];
      if (j === p.correcta) {
        btn.classList.add("bien");
        opciones.forEach((o) => (o.disabled = true));
        mensaje.className = "mensaje ok";
        mensaje.textContent = p.siAcierta || "¡Correcto!";
        vibrar(25);
        siguiente.hidden = false;
        siguiente.classList.add("aparece");
        return;
      }
      btn.classList.add("mal");
      btn.disabled = true;
      sacudir(btn);
      mensaje.className = "mensaje error";
      mensaje.textContent = p.siFalla || "¡Nop!";
      fallosAqui++;
      ctx.fallo();
      if (ayuda && fallosAqui >= ayuda.tras) {
        // Descarta opciones incorrectas hasta dejar solo dos
        const quedan = opciones.filter((o, k) => k !== p.correcta && !o.disabled);
        const quitar = quedan.slice(0, Math.max(0, quedan.length - 1));
        quitar.forEach((o) => {
          o.disabled = true;
          o.classList.add("descartada");
        });
        if (quitar.length) ctx.mostrarAyuda();
      }
    }

    cont.replaceChildren(
      h(
        "div.tarjeta.quiz",
        null,
        h(
          "div.quiz-progreso",
          null,
          preguntas.map((_, k) => h(`span.punto${k < i ? ".hecho" : ""}${k === i ? ".actual" : ""}`)),
          h("small", null, `Pregunta ${i + 1} de ${preguntas.length}`),
        ),
        h("h3.quiz-pregunta", null, p.pregunta),
        h("div.opciones", null, opciones),
        mensaje,
        siguiente,
      ),
    );
  }

  function avanzar() {
    i++;
    if (i >= preguntas.length) ctx.superar();
    else pintar();
  }

  pintar();
}
