// MEMORY: parejas de fotos.
import { rutaFoto } from "../lib/fotos.js";
import { barajar, h, vibrar, precargar } from "../lib/ui.js";

/** @param {HTMLElement} cont @param {import('../pantallas/nivel.js').ContextoJuego} ctx */
export function memory(cont, ctx) {
  const { fotos, comentarios = [] } = ctx.nivel.datos;
  const total = fotos.length;
  const cartas = barajar([...fotos, ...fotos]);
  const columnas = cartas.length === 12 || cartas.length === 6 ? 3 : cartas.length <= 4 ? 2 : 4;
  precargar(fotos.map((f) => rutaFoto(f, true)));

  let abiertas = /** @type {HTMLElement[]} */ ([]);
  let bloqueado = false;
  let parejas = 0;
  let intentos = 0;

  const marcador = h("p.memory-marcador");
  const final = h("div.memory-final");
  const actualizar = () => (marcador.textContent = `Parejas: ${parejas}/${total} · Intentos: ${intentos}`);

  const elementos = cartas.map((foto, k) => {
    const carta = h(
      "button.carta",
      { "aria-label": `Carta ${k + 1}`, onclick: () => girar(carta) },
      h("span.carta-interior", null, h("span.carta-dorso", { "aria-hidden": "true" }, "✦"), h("span.carta-cara", null, h("img", { src: rutaFoto(foto, true), alt: "", draggable: false }))),
    );
    carta.dataset.foto = foto;
    return carta;
  });

  function girar(carta) {
    if (bloqueado || carta.classList.contains("girada")) return;
    carta.classList.add("girada");
    abiertas.push(carta);
    if (abiertas.length < 2) return;
    intentos++;
    const [a, b] = abiertas;
    abiertas = [];
    if (a.dataset.foto === b.dataset.foto) {
      parejas++;
      vibrar(25);
      setTimeout(() => [a, b].forEach((c) => c.classList.add("pareja")), 350);
      actualizar();
      if (parejas === total) terminar();
    } else {
      bloqueado = true;
      actualizar();
      setTimeout(() => {
        a.classList.remove("girada");
        b.classList.remove("girada");
        bloqueado = false;
      }, 950);
    }
  }

  function terminar() {
    const c = comentarios.find((x) => intentos <= x.hasta);
    final.replaceChildren(
      h("p.mensaje.ok.aparece", null, c?.texto || "¡Todas las parejas!"),
      h("button.boton.ancho.aparece", { style: "--i:1", onclick: () => ctx.superar() }, "¡Hecho! ✨"),
    );
  }

  actualizar();
  cont.replaceChildren(h("div.tablero-memory", { style: `--columnas:${columnas}` }, elementos), marcador, final);
}
