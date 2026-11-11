// Decide a qué dirección apuntan los QR (compartido por `npm run qr` y `npm run tarjetas`).
//   (nada)              → `urlPublica` de contenido/config.js (la web ya publicada)
//   --url https://…     → la dirección que indiques
//   --local [puerto]    → tu ordenador en la wifi de casa (para probar con `npm run dev`)
import os from "node:os";

/** IP del ordenador en la red local (wifi/cable), p. ej. 192.168.1.34 */
function ipLocal() {
  const candidatas = Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => i.address);
  return candidatas.find((ip) => /^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))/.test(ip)) || candidatas[0];
}

/** @returns {{ base: string, local: boolean }} */
export function resolverUrl(config, args = process.argv.slice(2)) {
  const iUrl = args.indexOf("--url");
  const iLocal = args.indexOf("--local");

  if (iLocal >= 0) {
    const puerto = /^\d+$/.test(args[iLocal + 1] || "") ? args[iLocal + 1] : "5173";
    const ip = ipLocal();
    if (!ip) {
      console.error("✗ No encuentro la IP de este ordenador en la red. ¿Está conectado a la wifi?");
      process.exit(1);
    }
    const base = `http://${ip}:${puerto}/`;
    console.log(`📱 Modo prueba en casa: los QR abren ${base}`);
    console.log("   Solo funcionan mientras `npm run dev` esté abierto y con el móvil en la MISMA wifi.");
    console.log("   ¡No imprimas estos! Para las tarjetas de verdad, publica la web primero.\n");
    return { base, local: true };
  }

  const base = iUrl >= 0 ? args[iUrl + 1] : config.urlPublica;
  if (!/^https?:\/\//.test(base || "")) {
    console.error("✗ Falta la URL. Ponla en `urlPublica` (contenido/config.js) o usa: --url https://…");
    process.exit(1);
  }
  if (/ejemplo/i.test(base) && !args.includes("--forzar")) {
    console.error(`✗ La dirección es la de EJEMPLO (${base}): esa web no existe, así que el QR no abriría nada.

  · Para probarlo ya en tu móvil (con \`npm run dev\` abierto y la misma wifi):
        npm run qr -- --local
  · Cuando la publiques en Vercel/Netlify, pon la dirección real en \`urlPublica\`
    (contenido/config.js) y vuelve a ejecutar el comando.`);
    process.exit(1);
  }
  return { base, local: false };
}
