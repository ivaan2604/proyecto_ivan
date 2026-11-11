// PUZZLE DESLIZANTE con una foto (3×3 por defecto).
import { rutaFoto } from "../lib/fotos.js";
import { h, vibrar } from "../lib/ui.js";

/** @param {HTMLElement} cont @param {import('../pantallas/nivel.js').ContextoJuego} ctx */
export function puzzle(cont, ctx) {
  const d = ctx.nivel.datos;
  const N = d.tamano ?? 3;
  const celdas = N * N;
  const movsAyuda = ctx.nivel.ayuda?.tras ?? 150;
  const segsRendirse = d.segundosParaRendirse ?? 150;

  // pos[pieza] = celda que ocupa. La pieza N*N-1 es el hueco.
  let pos = Array.from({ length: celdas }, (_, i) => i);
  let movimientos = 0;
  let resuelto = false;

  const tablero = h("div.puzzle", { style: `--n:${N}` });
  const vista = h("img.puzzle-vista", { alt: "", src: "" });
  tablero.append(vista);
  const marcador = h("p.memory-marcador", null, "Movimientos: 0");
  const botonRendirse = h("button.boton.fantasma.pequeno", { hidden: true, onclick: () => resolverSolo() }, "Resuélvelo tú, que me canso 🙄");
  const botonVer = h(
    "button.boton.fantasma.pequeno",
    {
      onpointerdown: () => tablero.classList.add("viendo"),
      onpointerup: () => tablero.classList.remove("viendo"),
      onpointerleave: () => tablero.classList.remove("viendo"),
      onclick: () => {},
    },
    "👁 Mantén para ver la foto",
  );
  const final = h("div");

  const piezas = Array.from({ length: celdas - 1 }, (_, i) =>
    h("button.pieza", {
      "aria-label": `Pieza ${i + 1}`,
      onclick: () => tocar(i),
      style: { backgroundPosition: `${((i % N) / (N - 1)) * 100}% ${(Math.floor(i / N) / (N - 1)) * 100}%` },
    }),
  );
  const ultima = h("div.pieza.ultima", {
    style: { backgroundPosition: "100% 100%" },
  });
  tablero.append(...piezas, ultima);

  // Recorte cuadrado de la foto (sirve para cualquier proporción)
  const img = new Image();
  img.onload = () => {
    const lado = Math.min(img.naturalWidth, img.naturalHeight);
    const c = document.createElement("canvas");
    c.width = c.height = Math.min(900, lado);
    /** @type {CanvasRenderingContext2D} */ (c.getContext("2d")).drawImage(
      img, (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado, 0, 0, c.width, c.height,
    );
    const url = c.toDataURL("image/jpeg", 0.85);
    tablero.style.setProperty("--foto", `url(${url})`);
    vista.src = url;
  };
  img.src = rutaFoto(d.foto);

  const hueco = () => pos[celdas - 1];
  const fila = (c) => Math.floor(c / N);
  const col = (c) => c % N;

  function colocar() {
    pos.forEach((celda, pieza) => {
      const el = pieza === celdas - 1 ? ultima : piezas[pieza];
      el.style.transform = `translate(${col(celda) * 100}%, ${fila(celda) * 100}%)`;
    });
  }

  /** mueve la pieza que está en `celda` al hueco (deben ser vecinas) */
  function mover(celda) {
    const pieza = pos.indexOf(celda);
    pos[pieza] = hueco();
    pos[celdas - 1] = celda;
  }

  function tocar(pieza) {
    if (resuelto) return;
    const c = pos[pieza], e = hueco();
    // Si está en la misma fila o columna que el hueco, se desliza todo el tramo
    if (fila(c) !== fila(e) && col(c) !== col(e)) {
      piezas[pieza].classList.remove("no");
      void piezas[pieza].offsetWidth;
      piezas[pieza].classList.add("no");
      return;
    }
    const paso = fila(c) === fila(e) ? Math.sign(c - e) : Math.sign(c - e) * N;
    while (hueco() !== c) mover(hueco() + paso);
    movimientos++;
    marcador.textContent = `Movimientos: ${movimientos}`;
    vibrar(8);
    colocar();
    if (movimientos >= movsAyuda) {
      botonRendirse.hidden = false;
      ctx.mostrarAyuda();
    }
    if (pos.every((c2, i) => c2 === i)) terminar();
  }

  function barajar() {
    let anterior = -1;
    do {
      for (let k = 0; k < 60 * N; k++) {
        const e = hueco();
        const vecinas = [e - N, e + N, col(e) > 0 ? e - 1 : -1, col(e) < N - 1 ? e + 1 : -1].filter((v) => v >= 0 && v < celdas && v !== anterior);
        const v = vecinas[Math.floor(Math.random() * vecinas.length)];
        anterior = e;
        mover(v);
      }
    } while (pos.every((c, i) => c === i));
  }

  function resolverSolo() {
    pos = pos.map((_, i) => i);
    colocar();
    terminar();
  }

  function terminar() {
    resuelto = true;
    botonRendirse.hidden = true;
    botonVer.hidden = true;
    clearTimeout(temporizador);
    setTimeout(() => tablero.classList.add("resuelto"), 300);
    final.replaceChildren(h("button.boton.ancho.aparece", { style: "--i:3", onclick: () => ctx.superar() }, "¡Encajado! ✨"));
  }

  const temporizador = setTimeout(() => {
    if (!resuelto) botonRendirse.hidden = false;
  }, segsRendirse * 1000);
  ctx.alSalir(() => clearTimeout(temporizador));

  barajar();
  colocar();
  cont.replaceChildren(tablero, h("div.fila.centrada", null, botonVer, botonRendirse), marcador, final);
}
