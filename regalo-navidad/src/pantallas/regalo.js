// Detalles del regalo ya revelado.
import config from "../../contenido/config.js";
import { estado, guardar } from "../estado.js";
import { ir } from "../navegacion.js";
import { h } from "../lib/ui.js";

export function pantallaRegalo() {
  const r = config.regalo;
  const mapsUrl = r.lugar?.enlaceMaps || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.lugar?.busquedaMaps || r.lugar?.direccion || r.lugar?.nombre || "")}`;
  const waUrl = `https://wa.me/${r.whatsapp.telefono}?text=${encodeURIComponent(r.whatsapp.mensaje)}`;

  const seccion = (i, icono, titulo, ...contenido) =>
    h("section.tarjeta.detalle.aparece", { style: `--i:${i}` }, h("h3", null, h("span.detalle-icono", { "aria-hidden": "true" }, icono), titulo), ...contenido);

  const llevar = (r.llevar || []).map((cosa, i) => {
    const id = `llevar-${i}`;
    const marcado = estado.llevar.includes(String(i));
    return h(
      "li",
      null,
      h("input", {
        type: "checkbox",
        id,
        checked: marcado,
        onchange: (e) => {
          const set = new Set(estado.llevar);
          e.target.checked ? set.add(String(i)) : set.delete(String(i));
          estado.llevar = [...set];
          guardar();
        },
      }),
      h("label", { for: id }, cosa),
    );
  });

  return h(
    "section.regalo",
    null,
    h(
      "header.regalo-cabecera.centrado",
      null,
      h("div.regalo-emoji.aparece", { "aria-hidden": "true" }, r.emoji || "🎁"),
      h("p.etiqueta.aparece", { style: "--i:1" }, "Tu regalo de Navidad"),
      h("h1.aparece", { style: "--i:1" }, r.nombre),
      r.subtitulo ? h("p.lead.aparece", { style: "--i:2" }, r.subtitulo) : null,
    ),
    r.descripcion ? seccion(3, "✨", "Qué es", h("p", null, r.descripcion)) : null,
    r.incluye?.length ? seccion(4, "🎀", "Qué incluye", h("ul.lista-check", null, r.incluye.map((x) => h("li", null, x)))) : null,
    r.lugar
      ? seccion(
          5,
          "📍",
          "Dónde es",
          h("p", null, h("strong", null, r.lugar.nombre)),
          r.lugar.direccion ? h("p.suave", null, r.lugar.direccion) : null,
          h("a.boton.fantasma.pequeno.oscuro", { href: mapsUrl, target: "_blank", rel: "noopener" }, "Abrir en Google Maps ↗"),
        )
      : null,
    llevar.length ? seccion(6, "🧳", "Qué hay que llevar", h("ul.lista-llevar", null, llevar)) : null,
    r.reserva
      ? seccion(
          7,
          "📅",
          "Cómo se reserva",
          h("p", null, r.reserva.texto),
          r.reserva.codigo ? h("p.codigo", null, h("small", null, "Código"), h("code", null, r.reserva.codigo)) : null,
          r.reserva.enlace ? h("a.boton.fantasma.pequeno.oscuro", { href: r.reserva.enlace, target: "_blank", rel: "noopener" }, "Ir a reservar ↗") : null,
        )
      : null,
    h("a.boton.whatsapp.ancho.aparece", { style: "--i:8", href: waUrl, target: "_blank", rel: "noopener" }, r.whatsapp.boton),
    h("button.boton.fantasma.ancho.aparece", { style: "--i:9", onclick: () => ir("cierre") }, "Una última cosa… ✉️"),
    h("button.enlace.aparece", { style: "--i:10", onclick: () => ir("mapa") }, "Volver al mapa"),
  );
}
