// Tarjetas imprimibles con el QR.
//   npm run tarjetas                        → solo la tarjeta principal
//   npm run tarjetas -- --niveles           → también una tarjeta por nivel (búsqueda del tesoro)
//   npm run tarjetas -- --url https://…     → otra URL distinta a `urlPublica`
//   npm run tarjetas -- --local             → de prueba, apuntando a tu ordenador
// Los textos de la tarjeta se cambian en contenido/config.js → `tarjeta`.
// Genera en ./tarjetas/:
//   tarjetas.html     → ábrelo en el navegador para verlas (o imprimir desde ahí)
//   tarjetas-a6.pdf   → una tarjeta A6 (10,5 × 14,8 cm) por página
//   tarjetas-a4.pdf   → 4 tarjetas por folio A4 con marcas de corte (para imprimir en casa)
// Los PDF se crean con Playwright si está instalado; si no, imprime el HTML
// desde Chrome: Imprimir › Guardar como PDF › Márgenes: ninguno › Gráficos de fondo: sí.
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import config from "../contenido/config.js";
import { svgQR, urlsDelJuego } from "./qr-svg.mjs";
import { resolverUrl } from "./url-base.mjs";
import sharp from "sharp";
import jsQR from "jsqr";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const salida = path.join(raiz, "tarjetas");
const args = process.argv.slice(2);
const conNiveles = args.includes("--niveles");
const { base, local } = resolverUrl(config, args);

const fuente = (rel) => pathToFileURL(path.join(raiz, "node_modules", rel)).href;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
/** Texto con saltos de línea (\n → <br>); si está vacío no se pinta la línea */
const linea = (etiqueta, clase, texto) => (texto ? `<${etiqueta} class="${clase}">${esc(texto).replace(/\n/g, "<br/>")}</${etiqueta}>` : "");
const t = {
  encabezado: `Para ${config.ella}`,
  titulo: "Escanéame 🎁",
  texto: "Abre la cámara del móvil y apunta aquí.\nTu regalo te está esperando.",
  pie: `Feliz Navidad · ${new Date().getFullYear()}`,
  ...(config.tarjeta || {}),
};

const urls = urlsDelJuego(config, base).filter((u) => conNiveles || u.id === "principal");

function tarjeta(u) {
  if (u.id === "principal") {
    return `<section class="tarjeta">
      <div class="marco">
        <p class="estrella">✦</p>
        ${linea("p", "para", t.encabezado)}
        ${linea("h1", "titulo", t.titulo).replace(/(\p{Extended_Pictographic}️?)/gu, '<span class="emoji">$1</span>')}
        <div class="qr">${svgQR(u.url)}</div>
        ${linea("p", "nota", t.texto)}
        ${linea("p", "pie", t.pie)}
        ${local ? '<p class="prueba">PRUEBA · solo funciona en casa</p>' : ""}
      </div>
    </section>`;
  }
  const nv = u.nivel;
  return `<section class="tarjeta">
    <div class="marco">
      <p class="estrella">✦</p>
      <p class="para">Nivel ${u.indice + 1}</p>
      <h2>${esc(nv.emoji)} ${esc(nv.titulo)}</h2>
      <div class="qr">${svgQR(u.url)}</div>
      <p class="nota">${esc(nv.textoTarjeta || "¡Has encontrado una prueba! Escanéala para jugar.")}</p>
      <p class="pie">Pista ${u.indice + 1} de ${config.niveles.length}</p>
      ${local ? '<p class="prueba">PRUEBA · solo funciona en casa</p>' : ""}
    </div>
  </section>`;
}

const css = `
@font-face { font-family: Fraunces; src: url(${fuente("@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2")}) format("woff2"); font-weight: 100 900; }
@font-face { font-family: Figtree; src: url(${fuente("@fontsource-variable/figtree/files/figtree-latin-wght-normal.woff2")}) format("woff2"); font-weight: 300 900; }
@font-face { font-family: Caveat; src: url(${fuente("@fontsource/caveat/files/caveat-latin-500-normal.woff2")}) format("woff2"); }
* { box-sizing: border-box; margin: 0; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Figtree, sans-serif; color: #22201c; background: #ddd; }
.tarjeta { width: 105mm; height: 148mm; padding: 6mm; background: #fbf7ef; position: relative; overflow: hidden; }
.tarjeta::before { content: ""; position: absolute; inset: 0;
  background: radial-gradient(70% 40% at 50% 0%, rgba(200,161,90,.18), transparent 70%),
              radial-gradient(60% 30% at 50% 100%, rgba(163,38,59,.08), transparent 70%); }
.marco { position: relative; height: 100%; border: .35mm solid #c8a15a; border-radius: 4mm;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3.2mm; text-align: center; padding: 6mm; }
.marco::after { content: ""; position: absolute; inset: 1.2mm; border: .2mm solid rgba(200,161,90,.5); border-radius: 3mm; pointer-events: none; }
.estrella { color: #c8a15a; font-size: 5mm; line-height: 1; }
.para { font-size: 3.2mm; letter-spacing: .5mm; text-transform: uppercase; color: #9b7634; font-weight: 700; }
h1 { font-family: Caveat, cursive; font-weight: 500; font-size: 13mm; line-height: 1; color: #a3263b; }
h1 .emoji { font-size: 9mm; }
.prueba { position: absolute; top: 3mm; right: 3mm; font-size: 2.6mm; font-weight: 700; color: #fff; background: #a3263b; padding: .6mm 2mm; border-radius: 2mm; }
h2 { font-family: Fraunces, serif; font-weight: 600; font-size: 6.5mm; line-height: 1.1; color: #10291f; }
.qr { width: 58mm; height: 58mm; padding: 2mm; border-radius: 4mm; background: #f5eee1; box-shadow: 0 0 0 .3mm rgba(200,161,90,.6); }
.qr svg { width: 100%; height: 100%; display: block; }
.nota { font-size: 3.3mm; line-height: 1.4; color: #5d564b; max-width: 70mm; }
.pie { font-family: Fraunces, serif; font-style: italic; font-size: 3.3mm; color: #10291f; }
/* A6: una por página */
.a6 .tarjeta { page-break-after: always; break-after: page; }
@media screen { body.a6 { display: grid; gap: 8mm; justify-content: center; padding: 8mm; } }
/* A4: 2 × 2 con marcas de corte */
.a4 .hoja { width: 210mm; height: 297mm; display: grid; grid-template-columns: 105mm 105mm; grid-template-rows: 148.5mm 148.5mm;
  position: relative; background: #fff; page-break-after: always; break-after: page; }
.a4 .tarjeta { height: 148.5mm; }
.a4 .hoja::before, .a4 .hoja::after { content: ""; position: absolute; background: rgba(0,0,0,.25); z-index: 2; }
.a4 .hoja::before { left: 105mm; top: 0; bottom: 0; width: .1mm; }
.a4 .hoja::after { top: 148.5mm; left: 0; right: 0; height: .1mm; }
@media screen { body.a4 { padding: 8mm; } .a4 .hoja { margin: 0 auto 8mm; box-shadow: 0 2mm 8mm rgba(0,0,0,.2); } }
`;

const docA6 = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Tarjetas A6</title>
<style>@page { size: 105mm 148mm; margin: 0 } ${css}</style></head><body class="a6">${urls.map(tarjeta).join("")}</body></html>`;

const hojas = [];
for (let i = 0; i < urls.length; i += 4) hojas.push(urls.slice(i, i + 4));
const docA4 = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Tarjetas A4</title>
<style>@page { size: A4; margin: 0 } ${css}</style></head><body class="a4">${hojas
  .map((h) => `<div class="hoja">${h.map(tarjeta).join("")}</div>`)
  .join("")}</body></html>`;

await mkdir(salida, { recursive: true });
const htmlA6 = path.join(salida, "tarjetas.html");
const htmlA4 = path.join(salida, "tarjetas-a4.html");
await writeFile(htmlA6, docA6);
await writeFile(htmlA4, docA4);
console.log(`✓ ${urls.length} tarjeta(s) → tarjetas/tarjetas.html y tarjetas/tarjetas-a4.html`);

let chromium;
try {
  chromium = createRequire(import.meta.url)("playwright").chromium;
} catch {
  console.log("\n(No encuentro Playwright para crear el PDF.) Abre tarjetas/tarjetas.html en Chrome e imprime:");
  console.log("Guardar como PDF · Márgenes: ninguno · Gráficos de fondo: activado.");
  process.exit(0);
}
const navegador = await chromium.launch();
const pagina = await navegador.newPage();
for (const [html, pdf] of [
  [htmlA6, "tarjetas-a6.pdf"],
  [htmlA4, "tarjetas-a4.pdf"],
]) {
  await pagina.goto(pathToFileURL(html).href);
  await pagina.evaluate(() => document.fonts.ready);
  await pagina.pdf({ path: path.join(salida, pdf), preferCSSPageSize: true, printBackground: true });
  console.log(`✓ tarjetas/${pdf}`);
}

// Comprobación final: leer el QR de cada tarjeta tal y como queda impresa
await pagina.setViewportSize({ width: 600, height: 900 });
await pagina.goto(pathToFileURL(htmlA6).href);
await pagina.evaluate(() => document.fonts.ready);
const qrs = await pagina.$$(".qr");
let mal = 0;
for (const [k, el] of qrs.entries()) {
  const { data, info } = await sharp(await el.screenshot()).flatten({ background: "#ffffff" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const ok = jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data === urls[k].url;
  if (!ok) mal++;
  console.log(`${ok ? "✓" : "✗ NO SE LEE"} QR de la tarjeta "${urls[k].id}" → ${urls[k].url}`);
}
await navegador.close();
if (mal) {
  console.error(`✗ ${mal} tarjeta(s) con QR ilegible. No las imprimas todavía.`);
  process.exitCode = 1;
}
