// RASCA Y GANA: capa dorada que se rasca con el dedo para descubrir un mensaje.
import { h, vibrar } from "../lib/ui.js";

/** @param {HTMLElement} cont @param {import('../pantallas/nivel.js').ContextoJuego} ctx */
export function rasca(cont, ctx) {
  const d = ctx.nivel.datos;
  const umbral = d.umbral ?? 0.55;
  let destapado = false;

  const canvas = /** @type {HTMLCanvasElement} */ (h("canvas.rasca-capa", { "aria-label": "Zona para rascar" }));
  const caja = h("div.rasca", null, h("div.rasca-mensaje", null, h("span.rasca-premio", null, "🎉"), h("p", null, d.mensaje)), canvas);
  const final = h("div");
  const ayuda = h("button.enlace", { hidden: true, onclick: destapar }, "No me deja rascar, ¡destápalo!");
  const temporizador = setTimeout(() => (ayuda.hidden = false), 15000);
  ctx.alSalir(() => clearTimeout(temporizador));

  let g = /** @type {CanvasRenderingContext2D | null} */ (null);
  let dpr = 1;

  function preparar() {
    const r = caja.getBoundingClientRect();
    if (!r.width) return requestAnimationFrame(preparar);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = r.width * dpr;
    canvas.height = r.height * dpr;
    g = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
    g.scale(dpr, dpr);
    // lámina dorada
    const grad = g.createLinearGradient(0, 0, r.width, r.height);
    grad.addColorStop(0, "#b8893f");
    grad.addColorStop(0.35, "#ecd59b");
    grad.addColorStop(0.55, "#c8a15a");
    grad.addColorStop(0.8, "#f1dfaa");
    grad.addColorStop(1, "#a97c35");
    g.fillStyle = grad;
    g.fillRect(0, 0, r.width, r.height);
    // brillos y estrellitas
    g.fillStyle = "rgba(255,255,255,.35)";
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * r.width, y = Math.random() * r.height;
      g.font = `${8 + Math.random() * 10}px serif`;
      g.fillText("✦", x, y);
    }
    g.fillStyle = "#5b3f12";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `600 ${Math.min(30, r.width / 10)}px "Fraunces Variable", Georgia, serif`;
    g.fillText(d.portada || "Rasca aquí", r.width / 2, r.height / 2);
    g.globalCompositeOperation = "destination-out";
    g.lineCap = g.lineJoin = "round";
    g.lineWidth = 42;
  }

  let ultimo = /** @type {{x:number,y:number}|null} */ (null);
  let trazos = 0;
  const punto = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  canvas.addEventListener("pointerdown", (e) => {
    if (destapado || !g) return;
    canvas.setPointerCapture(e.pointerId);
    ultimo = punto(e);
    g.beginPath();
    g.arc(ultimo.x, ultimo.y, 21, 0, Math.PI * 2);
    g.fill();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!ultimo || !g || destapado) return;
    const p = punto(e);
    g.beginPath();
    g.moveTo(ultimo.x, ultimo.y);
    g.lineTo(p.x, p.y);
    g.stroke();
    ultimo = p;
    if (++trazos % 12 === 0) {
      vibrar(5);
      comprobar();
    }
  });
  const soltar = () => {
    ultimo = null;
    comprobar();
  };
  canvas.addEventListener("pointerup", soltar);
  canvas.addEventListener("pointercancel", soltar);

  function comprobar() {
    if (!g || destapado) return;
    const { width: w, height: hh } = canvas;
    const datos = g.getImageData(0, 0, w, hh).data;
    let vacios = 0, total = 0;
    const salto = 4 * Math.max(4, Math.round(6 * dpr));
    for (let i = 3; i < datos.length; i += salto) {
      total++;
      if (datos[i] < 30) vacios++;
    }
    if (vacios / total >= umbral) destapar();
  }

  function destapar() {
    if (destapado) return;
    destapado = true;
    ayuda.hidden = true;
    canvas.classList.add("fuera");
    caja.classList.add("destapada");
    vibrar([20, 40, 20]);
    final.replaceChildren(h("button.boton.ancho.aparece", { onclick: () => ctx.superar() }, "¡Me lo quedo! ✨"));
  }

  cont.replaceChildren(caja, ayuda, final);
  requestAnimationFrame(preparar);
}
