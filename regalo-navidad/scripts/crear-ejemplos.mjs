// Genera las fotos de EJEMPLO (ilustraciones) en public/fotos/ejemplo-N.webp.
// Solo sirven para ver el juego funcionando antes de poner vuestras fotos.
//   npm run ejemplos
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const W = 1200;
const H = 900;

const rnd = (() => {
  let s = 42;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
})();

const estrellas = (n, hMax) =>
  Array.from({ length: n }, () => {
    const x = rnd() * W, y = rnd() * hMax, r = 0.8 + rnd() * 2.2;
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${0.4 + rnd() * 0.6}"/>`;
  }).join("");

const etiqueta = (n) =>
  `<text x="${W - 40}" y="${H - 36}" text-anchor="end" font-family="Georgia, serif" font-style="italic" font-size="34" fill="#fff" opacity=".75">Foto de ejemplo ${n}</text>`;

const escenas = [
  // 1 · Ciudad lluviosa de noche
  () => `
  <defs><linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2a44"/><stop offset="1" stop-color="#3d4f6e"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#c)"/>
  ${Array.from({ length: 11 }, (_, i) => {
    const w = 80 + rnd() * 60, h = 260 + rnd() * 380, x = i * 112 - 20;
    const ventanas = Array.from({ length: 14 }, () => `<rect x="${x + 12 + rnd() * (w - 30)}" y="${H - h + 20 + rnd() * (h - 60)}" width="12" height="16" fill="#f7d68a" opacity="${0.4 + rnd() * 0.6}"/>`).join("");
    return `<rect x="${x}" y="${H - h}" width="${w}" height="${h}" fill="#141d30"/>${ventanas}`;
  }).join("")}
  ${Array.from({ length: 160 }, () => { const x = rnd() * W, y = rnd() * H; return `<line x1="${x}" y1="${y}" x2="${x - 8}" y2="${y + 34}" stroke="#bcd" stroke-width="2" opacity=".45"/>`; }).join("")}
  <circle cx="300" cy="640" r="120" fill="#f7d68a" opacity=".12"/><rect x="295" y="640" width="10" height="260" fill="#0c1220"/><circle cx="300" cy="640" r="18" fill="#ffe7a8"/>`,

  // 2 · Carretera y montañas al atardecer
  () => `
  <defs><linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6b78c"/><stop offset=".55" stop-color="#e9806e"/><stop offset="1" stop-color="#7b4a6b"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#c)"/>
  <circle cx="820" cy="420" r="110" fill="#ffe2a8"/>
  <path d="M0 560 L180 360 L330 500 L520 300 L720 520 L900 380 L1200 560 L1200 900 L0 900Z" fill="#5a3b5c"/>
  <path d="M0 650 L260 480 L460 620 L700 460 L980 640 L1200 520 L1200 900 L0 900Z" fill="#3e2a48"/>
  <path d="M520 900 L610 640 L640 640 L820 900Z" fill="#2b2233"/>
  <path d="M622 660 L618 700 M612 740 L606 790 M598 830 L590 890" stroke="#f3d9a4" stroke-width="7"/>`,

  // 3 · Playa de verano
  () => `
  <defs><linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc6e8"/><stop offset="1" stop-color="#d4f0f7"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#c)"/>
  <circle cx="930" cy="190" r="90" fill="#fff3b0"/>
  <rect y="470" width="${W}" height="190" fill="#2b8fb8"/>
  ${Array.from({ length: 30 }, () => `<rect x="${rnd() * W}" y="${490 + rnd() * 150}" width="${40 + rnd() * 70}" height="4" fill="#fff" opacity=".5"/>`).join("")}
  <path d="M0 640 Q300 600 600 650 T1200 630 L1200 900 L0 900Z" fill="#f2d8a7"/>
  <path d="M230 900 Q250 640 330 470" stroke="#7a5532" stroke-width="22" fill="none"/>
  ${[0, 60, 130, 200, 260].map((a) => `<ellipse cx="330" cy="470" rx="130" ry="26" fill="#3f8a4f" transform="rotate(${a - 160} 330 470) translate(110 0)"/>`).join("")}
  <path d="M760 760 L900 600 L1040 760Z" fill="#e2574c"/><rect x="896" y="600" width="8" height="200" fill="#555"/>`,

  // 4 · Navidad: ventana con luces
  () => `
  <rect width="${W}" height="${H}" fill="#2a1a17"/>
  <rect x="160" y="100" width="880" height="620" rx="10" fill="#14243a"/>
  ${estrellas(60, 700).replace(/cy="(\d+)/g, (m, y) => `cy="${100 + (Number(y) % 600)}`)}
  <rect x="160" y="100" width="880" height="620" rx="10" fill="none" stroke="#5b3a2c" stroke-width="40"/>
  <rect x="590" y="100" width="20" height="620" fill="#5b3a2c"/><rect x="160" y="400" width="880" height="20" fill="#5b3a2c"/>
  <path d="M600 160 L800 560 L400 560Z" fill="#1f5e3b"/><rect x="580" y="560" width="40" height="60" fill="#5b3a2c"/>
  ${Array.from({ length: 26 }, () => { const t = rnd(); const y = 200 + t * 340; const half = 40 + t * 180; return `<circle cx="${600 - half + rnd() * half * 2}" cy="${y}" r="9" fill="${["#ffd36b", "#e2574c", "#fff", "#7ecbff"][Math.floor(rnd() * 4)]}"/>`; }).join("")}
  <path d="M600 135 l14 30 32 4 -24 22 7 32 -29 -16 -29 16 7 -32 -24 -22 32 -4Z" fill="#ffd36b"/>
  <rect y="760" width="${W}" height="140" fill="#3b2620"/>`,

  // 5 · Campo de flores en primavera
  () => `
  <defs><linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe3ff"/><stop offset="1" stop-color="#fdf6e3"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#c)"/>
  <ellipse cx="300" cy="200" rx="140" ry="40" fill="#fff"/><ellipse cx="380" cy="180" rx="90" ry="40" fill="#fff"/>
  <ellipse cx="900" cy="150" rx="120" ry="34" fill="#fff"/>
  <path d="M0 520 Q300 420 600 500 T1200 470 L1200 900 L0 900Z" fill="#8cc672"/>
  <path d="M0 640 Q400 560 800 640 T1200 620 L1200 900 L0 900Z" fill="#6aae55"/>
  ${Array.from({ length: 140 }, () => { const x = rnd() * W, y = 560 + rnd() * 340; const c = ["#f37b8a", "#ffd166", "#fff", "#c084fc"][Math.floor(rnd() * 4)]; return `<circle cx="${x}" cy="${y}" r="${5 + rnd() * 8}" fill="${c}"/>`; }).join("")}`,

  // 6 · Dos siluetas bajo las estrellas
  () => `
  <defs><linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c1730"/><stop offset="1" stop-color="#36305a"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#c)"/>
  ${estrellas(180, 600)}
  <circle cx="880" cy="200" r="70" fill="#fdf3d0"/><circle cx="910" cy="185" r="70" fill="#14203d"/>
  <path d="M0 720 Q600 620 1200 720 L1200 900 L0 900Z" fill="#0b0f1d"/>
  <g fill="#0b0f1d"><circle cx="540" cy="560" r="34"/><path d="M500 600 Q540 585 580 600 L590 700 L490 700Z"/>
  <circle cx="640" cy="575" r="30"/><path d="M605 610 Q640 598 675 610 L690 700 L595 700Z"/></g>`,
];

await mkdir(path.join(raiz, "public/fotos/mini"), { recursive: true });
for (const [i, escena] of escenas.entries()) {
  const n = i + 1;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${escena()}${etiqueta(n)}</svg>`;
  const buf = Buffer.from(svg);
  await sharp(buf).webp({ quality: 80 }).toFile(path.join(raiz, `public/fotos/ejemplo-${n}.webp`));
  await sharp(buf).resize(480, 480, { fit: "cover" }).webp({ quality: 75 }).toFile(path.join(raiz, `public/fotos/mini/ejemplo-${n}.webp`));
  console.log(`✓ ejemplo-${n}.webp`);
}
