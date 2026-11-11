// Optimiza tus fotos para la web.
//   1. Copia tus fotos (JPG/PNG/WebP) a la carpeta ./fotos
//   2. npm run fotos
// Para cada foto genera en public/fotos/:
//   · nombre.webp       → máx. 1400 px de lado, ~150–300 KB
//   · mini/nombre.webp  → 480×480 recortada (memory, álbum)
// Además endereza la foto según la orientación del móvil y ELIMINA los
// metadatos (EXIF), incluida la ubicación GPS: importante para tu privacidad.
// Las fotos que ya estén optimizadas y no hayan cambiado se saltan.
//   npm run fotos -- --forzar      (vuelve a generarlas todas)
import sharp from "sharp";
import { readdir, stat, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { slugFoto } from "../src/lib/fotos.js";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origen = path.join(raiz, "fotos");
const destino = path.join(raiz, "public/fotos");
const forzar = process.argv.includes("--forzar");
const LADO = 1400;
const MINI = 480;

await mkdir(path.join(destino, "mini"), { recursive: true });

const archivos = (await readdir(origen)).filter((f) => /\.(jpe?g|png|webp|tiff?|avif|heic|heif)$/i.test(f));
if (archivos.length === 0) {
  console.log("No hay fotos en ./fotos. Copia allí las vuestras y vuelve a ejecutar `npm run fotos`.");
  process.exit(0);
}

const kb = (b) => `${Math.round(b / 1024)} KB`;
let antes = 0, despues = 0, hechas = 0, errores = 0;
const vistos = new Map();

for (const archivo of archivos) {
  const slug = slugFoto(archivo);
  if (vistos.has(slug)) {
    console.warn(`⚠ "${archivo}" y "${vistos.get(slug)}" darían el mismo nombre (${slug}.webp). Renombra una.`);
    errores++;
    continue;
  }
  vistos.set(slug, archivo);
  const entrada = path.join(origen, archivo);
  const salida = path.join(destino, `${slug}.webp`);
  const salidaMini = path.join(destino, "mini", `${slug}.webp`);
  try {
    const sIn = await stat(entrada);
    const sOut = await stat(salida).catch(() => null);
    if (!forzar && sOut && sOut.mtimeMs >= sIn.mtimeMs) continue;
    // .rotate() sin argumentos aplica la orientación EXIF; sharp no copia
    // metadatos a la salida salvo que se pida (.withMetadata), así que el GPS se pierde.
    const base = sharp(entrada, { failOn: "none" }).rotate();
    await base.clone().resize(LADO, LADO, { fit: "inside", withoutEnlargement: true }).webp({ quality: 78 }).toFile(salida);
    await base.clone().resize(MINI, MINI, { fit: "cover", position: "attention" }).webp({ quality: 72 }).toFile(salidaMini);
    const sNew = await stat(salida);
    antes += sIn.size;
    despues += sNew.size;
    hechas++;
    console.log(`✓ ${archivo.padEnd(34)} ${kb(sIn.size).padStart(8)} → ${kb(sNew.size).padStart(7)}   (${slug}.webp)`);
  } catch (e) {
    errores++;
    const heic = /\.hei[cf]$/i.test(archivo);
    console.error(`✗ ${archivo}: ${heic ? "las fotos HEIC del iPhone no se pueden leer; expórtalas como JPG (o en el iPhone: Ajustes › Cámara › Formatos › Más compatible)." : e.message}`);
  }
}

console.log(
  hechas
    ? `\n${hechas} foto(s) optimizadas: ${kb(antes)} → ${kb(despues)}.`
    : "\nTodo estaba ya optimizado (usa --forzar para regenerar).",
);
console.log('En contenido/config.js usa el nombre ORIGINAL del archivo, p. ej. foto: "' + archivos[0] + '"');
if (errores) process.exitCode = 1;
