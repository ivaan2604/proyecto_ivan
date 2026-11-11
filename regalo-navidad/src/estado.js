// Progreso de la partida, guardado en localStorage.
// Si el navegador no deja guardar (modo privado, etc.) se juega igual, en memoria.

const CLAVE = "regalo-navidad:v1";

/**
 * @typedef {Object} Estado
 * @property {boolean} dentro          ha pasado la contraseña
 * @property {string[]} superados     ids de niveles superados
 * @property {string[]} encontrados   ids de niveles cuyo QR ha escaneado (modo tesoro)
 * @property {Record<string, number>} fallos
 * @property {boolean} abierto         ha abierto el regalo
 * @property {string[]} llevar        índices marcados en "qué llevar"
 */

/** @returns {Estado} */
const vacio = () => ({ dentro: false, superados: [], encontrados: [], fallos: {}, abierto: false, llevar: [] });

function leer() {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return vacio();
    return { ...vacio(), ...JSON.parse(crudo) };
  } catch {
    return vacio();
  }
}

export const estado = leer();

export function guardar() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(estado));
  } catch {
    /* sin almacenamiento: seguimos en memoria */
  }
}

export function reiniciar() {
  Object.assign(estado, vacio());
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    /* nada */
  }
}

/** @param {string} id */
export function sumarFallo(id) {
  estado.fallos[id] = (estado.fallos[id] || 0) + 1;
  guardar();
  return estado.fallos[id];
}

/** @param {string} id */
export const fallosDe = (id) => estado.fallos[id] || 0;

/** Ajustes de sesión (no se guardan entre visitas) */
export const sesion = {
  tester: false,
};
try {
  sesion.tester = sessionStorage.getItem("regalo:tester") === "1";
} catch {
  /* nada */
}
export function activarTester() {
  sesion.tester = true;
  try {
    sessionStorage.setItem("regalo:tester", "1");
  } catch {
    /* nada */
  }
}
