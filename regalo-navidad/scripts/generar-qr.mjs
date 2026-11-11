// Genera los códigos QR (SVG + PNG) con la URL publicada.
//   npm run qr                                   → usa `urlPublica` de contenido/config.js
//   npm run qr -- --url https://mi-web.vercel.app  → usa otra URL
// Salida en ./qr/: principal.svg/.png y nivel-N.svg/.png (uno por nivel).
// Cada PNG se vuelve a leer con un lector de QR para comprobar que funciona.
import sharp from "sharp";
import jsQR from "jsqr";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import config from "../contenido/config.js";
import { svgQR, urlsDelJuego } from "./qr-svg.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const salida = path.join(raiz, "qr");
const i = process.argv.indexOf("--url");
const base = i > 0 ? process.argv[i + 1] : config.urlPublica;

if (!/^https?:\/\//.test(base || "")) {
  console.error("✗ Falta la URL. Ponla en `urlPublica` (contenido/config.js) o usa: npm run qr -- --url https://…");
  process.exit(1);
}
if (/ejemplo/.test(base)) console.warn(`⚠ La URL parece de ejemplo (${base}). Cámbiala por la real antes de imprimir.\n`);

await mkdir(salida, { recursive: true });
let mal = 0;
for (const { id, url } of urlsDelJuego(config, base)) {
  const svg = svgQR(url);
  await writeFile(path.join(salida, `${id}.svg`), svg);
  const png = path.join(salida, `${id}.png`);
  await sharp(Buffer.from(svg), { density: 600 }).resize(1200, 1200).png().toFile(png);

  // Comprobación: ¿se lee bien a distintos tamaños (como lo vería una cámara)?
  let ok = true;
  for (const ancho of [250, 400, 600, 900, 1200]) {
    const { data, info } = await sharp(png).flatten({ background: "#ffffff" }).resize(ancho).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data !== url) ok = false;
  }
  if (!ok) mal++;
  console.log(`${ok ? "✓" : "✗ NO SE LEE"} ${id.padEnd(10)} ${url}`);
}
console.log(`\nQR guardados en ${path.relative(process.cwd(), salida) || "."}/`);
if (mal) {
  console.error(`✗ ${mal} QR no se han podido leer. Avísame/revísalo antes de imprimir.`);
  process.exitCode = 1;
}
