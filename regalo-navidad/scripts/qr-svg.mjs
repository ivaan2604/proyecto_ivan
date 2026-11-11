// Dibuja un QR "bonito" en SVG: módulos redondeados verde abeto sobre crema,
// esquinas en rojo arándano y un corazón en el centro.
// Usa corrección de errores alta (H, ~30 %), así que tapar el centro no afecta a la lectura.
import QRCode from "qrcode";

const COLORES = { fondo: "#F5EEE1", modulo: "#10291F", esquina: "#10291F", ojo: "#A3263B", corazon: "#A3263B" };

/**
 * @param {string} texto  URL a codificar
 * @param {{ logo?: boolean, margen?: number }} [opciones]
 * @returns {string} SVG
 */
export function svgQR(texto, { logo = true, margen = 4 } = {}) {
  const qr = QRCode.create(texto, { errorCorrectionLevel: "H" });
  const n = qr.modules.size;
  const datos = qr.modules.data;
  const total = n + margen * 2;
  const oscuro = (x, y) => datos[y * n + x] === 1;

  // Zonas reservadas: 3 esquinas (7×7) y el centro (logo)
  const enEsquina = (x, y) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
  let lado = Math.round(n * 0.24);
  if (lado % 2 === 0) lado++;
  const ini = (n - lado) / 2;
  const enLogo = (x, y) => logo && x >= ini - 0.5 && x < ini + lado - 0.5 && y >= ini - 0.5 && y < ini + lado - 0.5;

  const puntos = [];
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      if (oscuro(x, y) && !enEsquina(x, y) && !enLogo(x, y))
        // Cuadrados casi completos con esquinas suaves. Probado: con puntos
        // redondos o módulos más pequeños algunos lectores fallan a ciertos tamaños.
        puntos.push(`<rect x="${x + margen + 0.02}" y="${y + margen + 0.02}" width="0.96" height="0.96" rx="0.3"/>`);

  const ojo = (x, y) => {
    const ox = x + margen, oy = y + margen;
    return `<rect x="${ox + 0.5}" y="${oy + 0.5}" width="6" height="6" rx="1.8" fill="none" stroke="${COLORES.esquina}" stroke-width="1"/>
      <rect x="${ox + 2}" y="${oy + 2}" width="3" height="3" rx="0.9" fill="${COLORES.ojo}"/>`;
  };

  // Corazón centrado en el hueco del logo
  const c = n / 2 + margen;
  const s = lado * 0.32;
  const corazon = logo
    ? `<rect x="${c - lado / 2 + 0.4}" y="${c - lado / 2 + 0.4}" width="${lado - 0.8}" height="${lado - 0.8}" rx="${lado * 0.22}" fill="${COLORES.fondo}" stroke="#C8A15A" stroke-width="0.35"/>
       <path transform="translate(${c} ${c + s * 0.12}) scale(${s / 10})" fill="${COLORES.corazon}"
         d="M0 7 C-9 0 -10 -6 -5.5 -8.5 C-3 -9.8 -0.8 -8.6 0 -6.5 C0.8 -8.6 3 -9.8 5.5 -8.5 C10 -6 9 0 0 7Z"/>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="geometricPrecision">
  <rect width="${total}" height="${total}" rx="${margen * 0.8}" fill="${COLORES.fondo}"/>
  <g fill="${COLORES.modulo}">${puntos.join("")}</g>
  ${ojo(0, 0)}${ojo(n - 7, 0)}${ojo(0, n - 7)}
  ${corazon}
</svg>`;
}

/** URLs del juego: la principal y la de cada nivel */
export function urlsDelJuego(config, base = config.urlPublica) {
  const raiz = base.endsWith("/") ? base : base + "/";
  return [
    { id: "principal", titulo: "Tarjeta principal", url: raiz },
    ...config.niveles.map((nv, i) => ({ id: `nivel-${i + 1}`, titulo: `Nivel ${i + 1} · ${nv.titulo}`, url: `${raiz}?n=${encodeURIComponent(nv.token)}`, nivel: nv, indice: i })),
  ];
}
