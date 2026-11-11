// Candado final: ordenar las letras para formar la palabra secreta.
import config from "../../contenido/config.js";
import { ir } from "../navegacion.js";
import { letras } from "../progreso.js";
import { barajar, h, rotar, sacudir, vibrar } from "../lib/ui.js";
import { abrirInventario } from "./inventario.js";

export function pantallaCandado() {
  const cfg = config.candado;
  const palabra = config.palabraFinal.toUpperCase().replace(/\s/g, "");
  const fichas = barajar(letras()).map((letra, id) => ({ letra, id }));
  /** @type {({letra:string,id:number,fija?:boolean}|null)[]} */
  let huecos = Array(palabra.length).fill(null);
  let fallos = 0;

  const zonaHuecos = h("div.huecos", { style: `--n:${palabra.length}` });
  const zonaFichas = h("div.fichas.bandeja");
  const mensaje = h("p.mensaje", { "aria-live": "polite" });
  const zonaPista = h("div");
  const candado = h("div.candado-icono", { "aria-hidden": "true" }, "🔒");

  function pintar() {
    zonaHuecos.replaceChildren(
      ...huecos.map((f, i) =>
        h(
          `button.hueco${f ? ".lleno" : ""}${f?.fija ? ".fija" : ""}`,
          { onclick: () => quitar(i), "aria-label": f ? `Quitar ${f.letra}` : `Hueco ${i + 1}` },
          f ? f.letra : "",
        ),
      ),
    );
    const usadas = new Set(huecos.filter(Boolean).map((f) => f?.id));
    zonaFichas.replaceChildren(
      ...fichas.map((f) =>
        h(`button.ficha${usadas.has(f.id) ? ".usada" : ""}`, { onclick: () => poner(f), disabled: usadas.has(f.id), "aria-label": f.letra }, f.letra),
      ),
    );
  }

  function poner(f) {
    const i = huecos.indexOf(null);
    if (i < 0) return;
    huecos[i] = f;
    vibrar(10);
    pintar();
    if (!huecos.includes(null)) comprobar();
  }

  function quitar(i) {
    if (!huecos[i] || huecos[i]?.fija) return;
    huecos[i] = null;
    pintar();
  }

  function comprobar() {
    const intento = huecos.map((f) => f?.letra).join("");
    if (intento === palabra) {
      zonaHuecos.classList.add("correcto");
      candado.textContent = "🔓";
      candado.classList.add("abierto");
      mensaje.className = "mensaje ok";
      mensaje.textContent = "¡¡Eso es!!";
      vibrar([30, 60, 30, 60, 120]);
      setTimeout(() => ir("revelacion"), 1300);
      return;
    }
    fallos++;
    mensaje.className = "mensaje error";
    mensaje.textContent = rotar(cfg.mensajesFallo, fallos - 1);
    sacudir(zonaHuecos);
    setTimeout(() => {
      huecos = huecos.map((f) => (f?.fija ? f : null));
      if (fallos >= (cfg.fallosParaPista ?? 2) && !zonaPista.firstChild) darPista();
      pintar();
    }, 700);
  }

  function darPista() {
    if (cfg.pista) zonaPista.append(h("div.pista", null, h("span", null, "💡"), h("span", null, cfg.pista)));
    const k = Math.min(cfg.letrasReveladasConPista ?? 0, palabra.length - 1);
    for (let i = 0; i < k; i++) {
      const libre = fichas.find((f) => f.letra === palabra[i] && !huecos.some((x) => x?.id === f.id));
      if (libre) huecos[i] = { ...libre, fija: true };
    }
  }

  pintar();
  return h(
    "section.candado.centrada",
    null,
    h("div.aparece", null, candado),
    h("h1.aparece", { style: "--i:1" }, cfg.titulo),
    h("p.lead.aparece", { style: "--i:2" }, cfg.texto),
    h("div.tarjeta.aparece", { style: "--i:3" }, zonaHuecos, h("p.suave.mini-ayuda", null, "Toca una letra para colocarla · toca un hueco para quitarla"), zonaFichas, mensaje, zonaPista),
    h(
      "div.fila.centrada.aparece",
      { style: "--i:4" },
      h("button.boton.fantasma.pequeno", { onclick: () => ir("mapa") }, "← Mapa"),
      h("button.boton.fantasma.pequeno", { onclick: () => abrirInventario("pistas") }, "🔎 Ver pistas"),
    ),
  );
}
