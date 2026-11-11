// Utilidades de interfaz sin dependencias.

/**
 * Crea un elemento. h("div.clase.otra", {onclick}, hijos…)
 * @param {string} etiqueta
 * @param {Record<string, any> | null} [props]
 * @param {...any} hijos
 * @returns {HTMLElement}
 */
export function h(etiqueta, props, ...hijos) {
  const [tag, ...clases] = etiqueta.split(".");
  const el = document.createElement(tag || "div");
  if (clases.length) el.className = clases.join(" ");
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k === "html") el.innerHTML = v;
    else if (k in el && k !== "list") /** @type {any} */ (el)[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const hijo of hijos.flat(Infinity)) {
    if (hijo == null || hijo === false) continue;
    el.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }
  return el;
}

/** Quita tildes, mayúsculas, signos y espacios sobrantes */
export function normalizar(txt) {
  return String(txt)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

export const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

export const movimientoReducido = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Vibración corta (Android). En iPhone simplemente no hace nada. */
export function vibrar(patron = 30) {
  try {
    navigator.vibrate?.(patron);
  } catch {
    /* nada */
  }
}

/** Barajar (Fisher–Yates) */
export function barajar(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Elemento i-ésimo en bucle */
export const rotar = (lista, i) => lista[i % lista.length];

/** Aviso flotante breve */
export function aviso(texto, ms = 2600) {
  document.querySelector(".aviso")?.remove();
  const el = h("div.aviso", { role: "status" }, texto);
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add("visible"));
  setTimeout(() => {
    el.classList.remove("visible");
    setTimeout(() => el.remove(), 400);
  }, ms);
}

/** Sacude un elemento (respuesta incorrecta) */
export function sacudir(el) {
  el.classList.remove("sacudir");
  void el.offsetWidth;
  el.classList.add("sacudir");
  vibrar([40, 40, 40]);
}

/** Precarga imágenes (para que no aparezcan a trozos) */
export function precargar(urls) {
  return Promise.all(
    urls.map(
      (u) =>
        new Promise((r) => {
          const img = new Image();
          img.onload = img.onerror = () => r(img);
          img.src = u;
        }),
    ),
  );
}
