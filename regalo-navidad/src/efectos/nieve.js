// Nieve muy suave de fondo. Se apaga si el móvil pide menos animaciones
// o si la pestaña no está visible (para no gastar batería).
import { movimientoReducido } from "../lib/ui.js";

export function iniciarNieve() {
  const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("nieve"));
  if (!canvas || movimientoReducido()) return;
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = 0, hgt = 0;
  const copos = [];

  function medir() {
    w = canvas.clientWidth;
    hgt = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = hgt * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const objetivo = Math.round(Math.min(70, (w * hgt) / 9000));
    while (copos.length < objetivo) copos.push(nuevo(true));
    copos.length = objetivo;
  }
  function nuevo(enCualquierSitio = false) {
    const r = 0.8 + Math.random() * 2.4;
    return {
      x: Math.random() * w,
      y: enCualquierSitio ? Math.random() * hgt : -10,
      r,
      v: 0.25 + r * 0.18,
      fase: Math.random() * Math.PI * 2,
      a: 0.25 + Math.random() * 0.45,
    };
  }
  let ultimo = performance.now();
  function frame(t) {
    const dt = Math.min(50, t - ultimo) / 16.7;
    ultimo = t;
    ctx.clearRect(0, 0, w, hgt);
    for (const c of copos) {
      c.y += c.v * dt;
      c.fase += 0.012 * dt;
      c.x += Math.sin(c.fase) * 0.3 * dt;
      if (c.y > hgt + 10) Object.assign(c, nuevo());
      ctx.globalAlpha = c.a;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
    }
    if (!document.hidden) requestAnimationFrame(frame);
  }
  medir();
  window.addEventListener("resize", medir);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      ultimo = performance.now();
      requestAnimationFrame(frame);
    }
  });
  requestAnimationFrame(frame);
}
