// ¿DÓNDE ESTÁBAMOS?: foto pixelada que se aclara con cada intento.
import { rutaFoto } from "../lib/fotos.js";
import { h, normalizar, rotar, sacudir, esperar } from "../lib/ui.js";

// Tamaño del "píxel" en cada paso (en px sobre 360 px de ancho). El último = nítida.
const PASOS = [40, 26, 16, 10, 6, 1];

/** @param {HTMLElement} cont @param {import('../pantallas/nivel.js').ContextoJuego} ctx */
export function donde(cont, ctx) {
  const d = ctx.nivel.datos;
  const ayudaTras = ctx.nivel.ayuda?.tras ?? 3;
  let paso = 0;
  let resuelto = false;
  let fallos = 0;

  const canvas = /** @type {HTMLCanvasElement} */ (h("canvas.donde-foto", { role: "img", "aria-label": "Foto pixelada" }));
  const img = new Image();
  img.onload = () => dibujar();
  img.src = rutaFoto(d.foto);

  function dibujar() {
    if (!img.naturalWidth) return;
    const ancho = canvas.clientWidth || 360;
    const alto = Math.round((ancho * 3) / 4);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = ancho * dpr;
    canvas.height = alto * dpr;
    const g = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
    // recorte tipo "cover"
    const r = Math.max(ancho / img.naturalWidth, alto / img.naturalHeight);
    const sw = ancho / r, sh = alto / r;
    const sx = (img.naturalWidth - sw) / 2, sy = (img.naturalHeight - sh) / 2;
    const bloque = PASOS[paso] * (ancho / 360);
    if (bloque <= 1.5) {
      g.imageSmoothingEnabled = true;
      g.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      return;
    }
    const pw = Math.max(1, Math.round(ancho / bloque)), ph = Math.max(1, Math.round(alto / bloque));
    const tmp = document.createElement("canvas");
    tmp.width = pw;
    tmp.height = ph;
    const t = /** @type {CanvasRenderingContext2D} */ (tmp.getContext("2d"));
    t.drawImage(img, sx, sy, sw, sh, 0, 0, pw, ph);
    g.imageSmoothingEnabled = false;
    g.drawImage(tmp, 0, 0, pw, ph, 0, 0, canvas.width, canvas.height);
  }
  const alRedimensionar = () => dibujar();
  window.addEventListener("resize", alRedimensionar);
  ctx.alSalir(() => window.removeEventListener("resize", alRedimensionar));

  function aclarar() {
    if (paso < PASOS.length - 2) {
      paso++;
      dibujar();
    }
    if (paso >= PASOS.length - 2) botonAclarar.hidden = true;
  }

  const esCorrecta = (txt) => {
    const t = normalizar(txt);
    return t.length >= 3 && d.respuestas.some((r) => t.includes(normalizar(r)) || normalizar(r) === t);
  };

  const mensaje = h("p.mensaje", { "aria-live": "polite" });
  const zonaRespuesta = h("div.donde-respuesta");
  const botonAclarar = h("button.enlace", { onclick: aclarar }, "🔍 Aclárala un poco");
  const final = h("div");

  async function acierto() {
    resuelto = true;
    mensaje.className = "mensaje ok";
    mensaje.textContent = "¡Exacto! 📍";
    botonAclarar.hidden = true;
    zonaRespuesta.querySelectorAll("button, input").forEach((el) => (/** @type {any} */ (el).disabled = true));
    while (paso < PASOS.length - 1) {
      paso++;
      dibujar();
      await esperar(140);
    }
    canvas.classList.add("revelada");
    final.replaceChildren(h("button.boton.ancho.aparece", { onclick: () => ctx.superar() }, "¡Lo sabía! ✨"));
  }

  function fallo(el) {
    fallos++;
    ctx.fallo();
    mensaje.className = "mensaje error";
    mensaje.textContent = rotar(d.mensajesFallo || ["¡Nop!"], fallos - 1);
    sacudir(el);
    aclarar();
    if (fallos >= ayudaTras) ctx.mostrarAyuda();
  }

  if (Array.isArray(d.opciones) && d.opciones.length) {
    zonaRespuesta.append(
      h(
        "div.opciones.dos",
        null,
        d.opciones.map((op) => {
          const b = h("button.opcion.centrada", {
            onclick: () => {
              if (resuelto) return;
              if (esCorrecta(op)) {
                b.classList.add("bien");
                acierto();
              } else {
                b.classList.add("mal");
                b.disabled = true;
                fallo(b);
              }
            },
          }, op);
          return b;
        }),
      ),
    );
  } else {
    const campo = /** @type {HTMLInputElement} */ (h("input.campo", { type: "text", placeholder: "Escribe el sitio…", autocomplete: "off", "aria-label": d.pregunta }));
    zonaRespuesta.append(
      h(
        "form.fila",
        {
          onsubmit: (e) => {
            e.preventDefault();
            if (resuelto || !campo.value.trim()) return;
            if (esCorrecta(campo.value)) acierto();
            else fallo(campo);
          },
        },
        campo,
        h("button.boton", { type: "submit" }, "OK"),
      ),
    );
  }

  cont.replaceChildren(
    h("div.tarjeta.donde", null, h("div.marco-foto", null, canvas), h("h3", null, d.pregunta || "¿Dónde estábamos?"), zonaRespuesta, mensaje, botonAclarar),
    final,
  );
  requestAnimationFrame(dibujar);
}
