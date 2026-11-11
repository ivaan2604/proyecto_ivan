// Punto de entrada: carga estilos, revisa la configuración y decide la primera pantalla.
//
// Parámetros de URL útiles:
//   ?reset=1        borra el progreso (para probar desde cero)
//   ?tester=1       muestra botones para saltar niveles (solo en esa pestaña)
//   ?demo=caja      vista previa de la revelación con caja
//   ?demo=sobre     vista previa de la revelación con sobre
//   ?n=TOKEN        abre directamente un nivel (QR de cada nivel)
import "@fontsource-variable/fraunces";
import "@fontsource-variable/figtree";
import "@fontsource/caveat/500.css";
import "./estilos/base.css";
import "./estilos/juego.css";
import "./estilos/revelacion.css";

import config from "../contenido/config.js";
import { validar, fotosQueFaltan } from "./validar.js";
import { estado, guardar, reiniciar, activarTester, sesion } from "./estado.js";
import { registrar, ir, activarBotonAtras } from "./navegacion.js";
import { disponible, niveles, nivelPorToken, marcarSuperado } from "./progreso.js";
import { iniciarNieve } from "./efectos/nieve.js";
import { h, aviso } from "./lib/ui.js";

import { pantallaEntrada } from "./pantallas/entrada.js";
import { pantallaMapa } from "./pantallas/mapa.js";
import { pantallaNivel } from "./pantallas/nivel.js";
import { pantallaRecompensa } from "./pantallas/recompensa.js";
import { pantallaCandado } from "./pantallas/candado.js";
import { pantallaRevelacion } from "./pantallas/revelacion.js";
import { pantallaRegalo } from "./pantallas/regalo.js";
import { pantallaCierre } from "./pantallas/cierre.js";

registrar("entrada", pantallaEntrada);
registrar("mapa", pantallaMapa);
registrar("nivel", pantallaNivel);
registrar("recompensa", pantallaRecompensa);
registrar("candado", pantallaCandado);
registrar("revelacion", pantallaRevelacion);
registrar("regalo", pantallaRegalo);
registrar("cierre", pantallaCierre);

// ── Parámetros de la URL ──────────────────────────────────────────────────
const params = new URLSearchParams(location.search);
if (params.has("reset")) reiniciar();
if (params.has("tester")) activarTester();
const token = params.get("n");
const demo = params.get("demo");
if (params.toString()) history.replaceState(null, "", location.pathname);

// ── Avisos de configuración ───────────────────────────────────────────────
const errores = validar(config);
if (import.meta.env.DEV) fotosQueFaltan(config).then((f) => mostrarErrores([...errores, ...f]));
else mostrarErrores(errores);

function mostrarErrores(lista) {
  if (!lista.length) return;
  console.warn("Errores en contenido/config.js:\n- " + lista.join("\n- "));
  if (!import.meta.env.DEV && !sesion.tester) return; // ella no ve avisos técnicos
  document.body.append(
    h("div.errores-config", { onclick: (e) => e.currentTarget.remove() }, h("b", null, "⚠ Revisa contenido/config.js (toca para cerrar):"), lista.map((x) => h("div", null, "• " + x))),
  );
}

// ── Botón "atrás" del móvil ───────────────────────────────────────────────
activarBotonAtras(() => estado.dentro);

// ── Modo tester ───────────────────────────────────────────────────────────
if (sesion.tester) {
  document.body.append(
    h(
      "div.tester",
      { style: "right:10px;left:auto;bottom:auto;top:10px" },
      h("button", { onclick: () => (location.href = "?reset=1&tester=1") }, "↺ Reset"),
      h("button", { onclick: () => { niveles.forEach((n) => marcarSuperado(n.id)); ir("mapa"); } }, "✓ Todo"),
      h("button", { onclick: () => ir("revelacion", { tipo: "caja", demo: true }) }, "🎁 Caja"),
      h("button", { onclick: () => ir("revelacion", { tipo: "sobre", demo: true }) }, "✉️ Sobre"),
    ),
  );
}

// ── Arranque ──────────────────────────────────────────────────────────────
iniciarNieve();

function procesarToken() {
  if (!token) return false;
  const i = nivelPorToken(token);
  if (i < 0) {
    aviso("Ese código no es de este juego 🤔");
    return false;
  }
  if (config.modo === "tesoro" && !estado.encontrados.includes(niveles[i].id)) {
    estado.encontrados.push(niveles[i].id);
    guardar();
    aviso(`¡Has encontrado el nivel ${i + 1}! 🔎`);
  }
  if (disponible(i)) {
    ir("nivel", { indice: i });
    return true;
  }
  ir("mapa");
  setTimeout(() => aviso(`Aún no has llegado aquí 😉 Primero supera “${niveles[i - 1].titulo}”.`, 3500), 600);
  return true;
}

function despuesDeEntrar() {
  if (!procesarToken()) ir("mapa");
}

if (demo === "caja" || demo === "sobre") ir("revelacion", { tipo: demo, demo: true });
else if (demo === "regalo") ir("regalo");
else if (!estado.dentro) ir("entrada", { alEntrar: despuesDeEntrar });
else despuesDeEntrar();
