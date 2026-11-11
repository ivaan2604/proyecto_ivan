// Confeti en los colores de la paleta (oro, arándano, crema).
import confetti from "canvas-confetti";
import { movimientoReducido } from "../lib/ui.js";

const colores = ["#c8a15a", "#e5cb8f", "#a3263b", "#f5eee1", "#2f7a55"];

/** Ráfaga pequeña (nivel superado) */
export function confetiPequeno() {
  if (movimientoReducido()) return;
  confetti({ particleCount: 60, spread: 70, startVelocity: 35, origin: { y: 0.35 }, colors: colores, scalar: 0.9, disableForReducedMotion: true });
}

/** Gran final: varias ráfagas desde los lados y estrellas desde el centro */
export function confetiFinal() {
  if (movimientoReducido()) return;
  const base = { colors: colores, disableForReducedMotion: true, zIndex: 50 };
  confetti({ ...base, particleCount: 120, spread: 100, startVelocity: 45, origin: { y: 0.45 }, shapes: ["star", "circle", "square"] });
  const fin = Date.now() + 1800;
  (function rafaga() {
    confetti({ ...base, particleCount: 4, angle: 60, spread: 60, origin: { x: 0, y: 0.7 } });
    confetti({ ...base, particleCount: 4, angle: 120, spread: 60, origin: { x: 1, y: 0.7 } });
    if (Date.now() < fin) requestAnimationFrame(rafaga);
  })();
}
