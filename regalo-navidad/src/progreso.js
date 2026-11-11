// Reglas del juego: qué niveles están disponibles, letras conseguidas, %…
import config from "../contenido/config.js";
import { estado, guardar } from "./estado.js";

export const niveles = config.niveles;

/** @param {string} id */
export const superado = (id) => estado.superados.includes(id);

/** @param {number} i  índice del nivel */
export function disponible(i) {
  const n = niveles[i];
  if (!n) return false;
  if (superado(n.id)) return true;
  if (config.modo === "tesoro") return estado.encontrados.includes(n.id);
  return i === 0 || superado(niveles[i - 1].id);
}

/** Índice del siguiente nivel por jugar (o -1 si no hay) */
export function siguiente() {
  return niveles.findIndex((n, i) => !superado(n.id) && disponible(i));
}

export const todosSuperados = () => niveles.every((n) => superado(n.id));

/** Porcentaje de "regalo desbloqueado" */
export function porcentaje() {
  if (estado.abierto) return 100;
  const hechos = niveles.filter((n) => superado(n.id)).length;
  return Math.round((hechos / niveles.length) * 100);
}

/** Letras conseguidas, en el orden en que se ganaron */
export function letras() {
  return estado.superados
    .map((id) => niveles.find((n) => n.id === id))
    .filter(Boolean)
    .flatMap((n) => [...n.recompensa.letras.toUpperCase()]);
}

/** Niveles superados (en el orden del juego) */
export const nivelesSuperados = () => niveles.filter((n) => superado(n.id));

/** @param {string} id */
export function marcarSuperado(id) {
  if (!superado(id)) estado.superados.push(id);
  guardar();
}

/** @param {string} token */
export const nivelPorToken = (token) => niveles.findIndex((n) => n.token === token);
