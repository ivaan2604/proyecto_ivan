// Compartido entre la web y los scripts de Node: cómo se llama una foto optimizada.
// "Playa Agosto 2022.JPG" → "playa-agosto-2022"

/** @param {string} nombre */
export function slugFoto(nombre) {
  const sinExt = nombre.replace(/\.[a-z0-9]+$/i, "");
  return sinExt
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Ruta pública de la foto optimizada.
 * @param {string} nombre  tal y como aparece en contenido/config.js
 * @param {boolean} [mini] versión pequeña (miniaturas, memory)
 */
export function rutaFoto(nombre, mini = false) {
  return `fotos/${mini ? "mini/" : ""}${slugFoto(nombre)}.webp`;
}
