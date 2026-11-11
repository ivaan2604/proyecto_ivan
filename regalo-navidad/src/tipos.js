// Tipos (solo documentación JSDoc: dan autocompletado al editar contenido/config.js)

/**
 * @typedef {Object} Recompensa
 * @property {string} foto    Nombre del archivo en ./fotos
 * @property {string} fecha
 * @property {string} frase
 * @property {string} pista   Pista sobre el regalo
 * @property {string} letras  Letra(s) de la palabra final
 */

/**
 * @typedef {Object} Nivel
 * @property {string} id
 * @property {string} token
 * @property {"quiz"|"memory"|"donde"|"rasca"|"puzzle"} tipo
 * @property {string} titulo
 * @property {string} emoji
 * @property {string} intro
 * @property {{tras:number, texto:string}} [ayuda]
 * @property {any} datos
 * @property {Recompensa} recompensa
 */

/**
 * @typedef {Object} Config
 * @property {string} ella
 * @property {string} yo
 * @property {string} urlPublica
 * @property {"lineal"|"tesoro"} modo
 * @property {"caja"|"sobre"} revelacion
 * @property {any} entrada
 * @property {string} palabraFinal
 * @property {any} candado
 * @property {Nivel[]} niveles
 * @property {any} regalo
 * @property {{titulo:string, carta:string[], firma:string}} cierre
 */

export {};
