// Revisa contenido/config.js y explica en castellano lo que esté mal.
import { rutaFoto } from "./lib/fotos.js";

const TIPOS = ["quiz", "memory", "donde", "rasca", "puzzle"];

/** @param {import('./tipos.js').Config} c @returns {string[]} */
export function validar(c) {
  const e = [];
  const req = (cond, msg) => {
    if (!cond) e.push(msg);
  };

  req(c.ella, "Falta `ella` (su nombre).");
  req(["lineal", "tesoro"].includes(c.modo), '`modo` debe ser "lineal" o "tesoro".');
  req(["caja", "sobre"].includes(c.revelacion), '`revelacion` debe ser "caja" o "sobre".');

  const en = c.entrada || {};
  req(Array.isArray(en.respuestas) && en.respuestas.length, "`entrada.respuestas` debe tener al menos una respuesta.");
  if (en.tipo === "fecha")
    (en.respuestas || []).forEach((r) =>
      req(/^\d{4}-\d{2}-\d{2}$/.test(r), `entrada.respuestas: "${r}" no tiene formato AAAA-MM-DD.`),
    );

  req(Array.isArray(c.niveles) && c.niveles.length, "No hay niveles.");
  const ids = new Set();
  const tokens = new Set();
  (c.niveles || []).forEach((n, i) => {
    const q = `Nivel ${i + 1} (${n.id || "sin id"})`;
    req(n.id, `${q}: falta \`id\`.`);
    req(!ids.has(n.id), `${q}: el id "${n.id}" está repetido.`);
    ids.add(n.id);
    req(n.token, `${q}: falta \`token\`.`);
    req(!tokens.has(n.token), `${q}: el token "${n.token}" está repetido.`);
    tokens.add(n.token);
    req(TIPOS.includes(n.tipo), `${q}: tipo "${n.tipo}" no existe (usa ${TIPOS.join(", ")}).`);
    const d = n.datos || {};
    if (n.tipo === "quiz") {
      req(Array.isArray(d.preguntas) && d.preguntas.length, `${q}: el quiz no tiene preguntas.`);
      (d.preguntas || []).forEach((p, j) => {
        req(Array.isArray(p.opciones) && p.opciones.length >= 2, `${q}, pregunta ${j + 1}: necesita al menos 2 opciones.`);
        req(
          Number.isInteger(p.correcta) && p.correcta >= 0 && p.correcta < (p.opciones || []).length,
          `${q}, pregunta ${j + 1}: \`correcta\` debe ser la posición (0, 1, 2…) de una opción.`,
        );
      });
    }
    if (n.tipo === "memory")
      req(Array.isArray(d.fotos) && d.fotos.length >= 2 && d.fotos.length <= 8, `${q}: el memory necesita entre 2 y 8 fotos.`);
    if (n.tipo === "donde") {
      req(d.foto, `${q}: falta \`datos.foto\`.`);
      req(Array.isArray(d.respuestas) && d.respuestas.length, `${q}: faltan \`datos.respuestas\`.`);
    }
    if (n.tipo === "rasca") req(d.mensaje, `${q}: falta \`datos.mensaje\`.`);
    if (n.tipo === "puzzle") {
      req(d.foto, `${q}: falta \`datos.foto\`.`);
      req([3, 4, 5].includes(d.tamano ?? 3), `${q}: \`tamano\` debe ser 3, 4 o 5.`);
    }
    const r = n.recompensa || {};
    req(r.foto && r.frase, `${q}: la recompensa necesita \`foto\` y \`frase\`.`);
    req(r.letras, `${q}: la recompensa necesita \`letras\`.`);
  });

  // Las letras de todos los niveles deben formar exactamente la palabra final
  const limpiar = (s) => String(s || "").toUpperCase().replace(/\s/g, "");
  const ordenar = (s) => [...limpiar(s)].sort().join("");
  const conseguidas = (c.niveles || []).map((n) => n.recompensa?.letras || "").join("");
  if (ordenar(conseguidas) !== ordenar(c.palabraFinal))
    e.push(
      `Las letras de los niveles ("${limpiar(conseguidas)}") no son las mismas que las de la palabra final ("${limpiar(c.palabraFinal)}"). Deben coincidir (en cualquier orden).`,
    );

  const rg = c.regalo || {};
  req(rg.nombre, "Falta `regalo.nombre`.");
  req(/^\d{8,15}$/.test(rg.whatsapp?.telefono || ""), "`regalo.whatsapp.telefono` debe ser solo dígitos con prefijo (p. ej. 34600111222).");
  return e;
}

/** Todas las fotos que usa la configuración */
export function fotosUsadas(c) {
  const s = new Set();
  for (const n of c.niveles || []) {
    if (n.recompensa?.foto) s.add(n.recompensa.foto);
    if (n.datos?.foto) s.add(n.datos.foto);
    for (const f of n.datos?.fotos || []) s.add(f);
  }
  return [...s];
}

/** Comprueba que existan las fotos optimizadas (solo en desarrollo) */
export async function fotosQueFaltan(c) {
  const faltan = [];
  await Promise.all(
    fotosUsadas(c).map(async (f) => {
      for (const mini of [false, true]) {
        const r = await fetch(rutaFoto(f, mini), { method: "HEAD" }).catch(() => null);
        const tipo = r?.headers.get("content-type") || "";
        if (!r?.ok || !tipo.startsWith("image")) {
          faltan.push(f);
          return;
        }
      }
    }),
  );
  return faltan.map((f) => `No encuentro la foto "${f}". ¿Está en ./fotos y has ejecutado \`npm run fotos\`?`);
}
