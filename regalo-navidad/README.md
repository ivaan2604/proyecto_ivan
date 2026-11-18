# 🎁 Regalo de Navidad: escape room romántico

Una web para el móvil con forma de juego por niveles. Ella escanea el QR de una tarjeta, entra con una «contraseña» vuestra y supera 6 pruebas. Cada prueba desbloquea un recuerdo, una pista sobre el regalo y alguna letra de una palabra secreta. Con la palabra se abre el candado final, la caja (o el sobre) se abre con confeti y aparece el regalo con todos los detalles.

**Todo el contenido está en un solo archivo: [`contenido/config.js`](contenido/config.js).** El código no contiene nada personal.

---

## 1. Ponerlo en marcha en tu ordenador

Necesitas [Node.js](https://nodejs.org) 20 o superior.

```bash
cd regalo-navidad
npm install
npm run dev
```

Abre la dirección que aparece (`http://localhost:5173`). Para verlo **en tu móvil**, conéctalo a la misma wifi y abre la dirección `Network:` que muestra la terminal (algo como `http://192.168.1.34:5173`).

### Direcciones útiles mientras lo preparas

| Dirección | Para qué |
|---|---|
| `/?reset=1` | Borra el progreso y empieza de cero |
| `/?tester=1` | Muestra botones para saltar niveles, reiniciar o ver la caja y el sobre. Solo afecta a esa pestaña |
| `/?demo=caja` | Vista previa de la revelación con la caja 3D |
| `/?demo=sobre` | Vista previa de la revelación con el sobre lacrado |
| `/?n=k7f2q` | Abre un nivel por su `token`; es lo que llevan los QR de cada nivel |

Si algo está mal en el archivo de contenido (falta una foto, las letras no forman la palabra, una respuesta correcta no existe…), en modo `dev` aparece **un aviso rojo arriba** que explica qué falla.

---

## 2. Personalizar

Edita `contenido/config.js`. Está comentado línea a línea:

- `ella`, `yo`: vuestros nombres.
- `entrada`: la contraseña (una fecha `AAAA-MM-DD` o un texto), los mensajes de fallo y la pista.
- `palabraFinal`: la palabra secreta. **Las letras de todos los niveles deben sumar exactamente esas letras** (en cualquier orden).
- `niveles`: hay 5 tipos de prueba: `quiz`, `memory`, `donde`, `rasca` y `puzzle`. Puedes reordenarlas, quitarlas o repetir tipos.
- `regalo`: qué es, qué incluye, dónde es, qué llevar, cómo se reserva y tu WhatsApp.
- `cierre`: tu carta final.
- `revelacion`: `"caja"` o `"sobre"`.
- `modo`: `"lineal"` (los niveles se juegan en orden) o `"tesoro"` (cada nivel solo aparece al escanear su tarjeta escondida).

### Fotos

1. Copia vuestras fotos a la carpeta **`fotos/`** (JPG, PNG o WebP).
2. Ejecuta:
   ```bash
   npm run fotos
   ```
   Esto genera versiones ligeras en `public/fotos/`:
   - una grande de máximo 1400 px (normalmente pesa entre 150 y 300 KB);
   - una miniatura de 480 px.

   Además endereza las fotos giradas y **borra los datos EXIF, incluida la ubicación GPS**.
3. En `config.js` escribe el nombre **original** del archivo, por ejemplo `foto: "playa 2022.jpg"`.

> Las fotos HEIC del iPhone no se pueden leer: expórtalas como JPG, o activa en el iPhone *Ajustes › Cámara › Formatos › Más compatible*.

Las imágenes `ejemplo-N` son ilustraciones de muestra (`npm run ejemplos` las regenera). Cuando pongas las vuestras ya no hacen falta.

---

## 3. Publicarlo gratis

### Opción recomendada: un comando, sin GitHub

Así tus fotos van directas de tu ordenador a Vercel y **nunca pasan por ningún repositorio**.

1. Si aún no tienes cuenta, créala gratis en [vercel.com](https://vercel.com). Puedes entrar con GitHub, Google o tu email.
2. En la carpeta del proyecto (con tus fotos ya en `fotos/`, si las tienes):
   ```bash
   npm run fotos
   ```
   ```bash
   npm run publicar
   ```
3. La primera vez te hará unas preguntas:
   - Pide iniciar sesión: se abre el navegador y aceptas.
   - *Set up and deploy?*: **Y**.
   - *Which scope?*: tu cuenta.
   - *Link to existing project?*: **N**.
   - *Project name?*: el nombre será tu dirección, así que elige algo bonito y poco obvio, como `para-lucia-2026`. Quedará `https://para-lucia-2026.vercel.app`.
   - *In which directory is your code located?*: pulsa Enter (`./`).
   - Si pregunta por modificar los ajustes, di **N**: ya están en `vercel.json`.
4. Al terminar te muestra la dirección publicada (*Production: https://…*). Ábrela en el móvil para comprobarla.

Cada vez que cambies algo (textos, fotos…), vuelve a ejecutar `npm run publicar`. La dirección no cambia, así que **los QR ya impresos siguen funcionando**.

### Alternativa: con un repositorio privado de GitHub

Si prefieres que se publique solo con cada `git push`:

1. Crea un repo **privado** y copia ahí esta carpeta (sin `node_modules`, `dist`, `qr` ni `tarjetas`).
2. En su `.gitignore`, borra estas dos líneas para que se suban tus fotos optimizadas:
   ```
   public/fotos/**/*.webp
   !public/fotos/**/ejemplo-*.webp
   ```
3. En Vercel: *Add New… › Project*, importa el repo y pulsa **Deploy**.

Netlify también vale: importa el repo; el `netlify.toml` ya está preparado.

### Después de publicar

1. Pon la URL definitiva en `urlPublica` (en `config.js`).
2. Genera los QR y las tarjetas (siguiente apartado).
3. **Prueba el QR impreso con tu móvil** antes de meterlo en el sobre.

---

## 4. Códigos QR y tarjetas imprimibles

> ⚠️ **Un QR solo funciona si la web a la que apunta existe.** Mientras `urlPublica` sea la de ejemplo, los comandos se niegan a generar nada y te explican qué hacer.

**Para probar en tu móvil antes de publicar** (con `npm run dev` abierto y el móvil en la misma wifi):

```bash
npm run qr -- --local
```
```bash
npm run tarjetas -- --local
```

Estos QR apuntan a tu ordenador, así que solo sirven en casa. Las tarjetas de prueba llevan la marca «PRUEBA»: no las imprimas para regalar.

**Ya publicada** (con la dirección real en `urlPublica`):

```bash
npm run qr                 # QR en ./qr (PNG y SVG): principal + uno por nivel
npm run tarjetas           # tarjeta principal «Escanéame 🎁»
npm run tarjetas -- --niveles   # + una tarjeta por nivel (búsqueda del tesoro)
```

**Textos de la tarjeta:** se cambian en `contenido/config.js`, en el apartado `tarjeta`:
- `encabezado`: la línea de arriba.
- `titulo`: la letra grande.
- `texto`: el párrafo bajo el QR; `\n` hace un salto de línea.
- `pie`: la línea final.

Si dejas alguno vacío (`""`), esa línea no aparece.

- **`npm run qr`** comprueba cada QR con un lector automático a varios tamaños y avisa si alguno no se leyera. La URL sale de `urlPublica`; también puedes pasarla a mano con `npm run qr -- --url https://…`.
- **`npm run tarjetas`** genera en `./tarjetas/`:
  - `tarjetas-a6.pdf`: una tarjeta de 10,5 × 14,8 cm por página. Es el formato para imprenta o para papel A6.
  - `tarjetas-a4.pdf`: 4 tarjetas por folio con líneas de corte. Es el formato para imprimir en casa.
  - `tarjetas.html`: si el PDF no se genera, ábrelo en Chrome e imprime con márgenes «ninguno» y «gráficos de fondo» activado.

Para la búsqueda del tesoro, cada nivel puede tener un `textoTarjeta` con una pista de dónde está la siguiente.

---

## 5. Privacidad (léelo)

- La «contraseña» es parte del juego, **no es seguridad**: cualquiera con la URL podría ver las fotos.
- Para que nadie llegue por casualidad:
  - la web pide a los buscadores que **no la indexen** (`noindex` y `robots.txt`);
  - las fotos no llevan datos GPS;
  - conviene elegir una URL poco obvia.
- Si quieres protección real con contraseña, Vercel (*Password Protection*) y Netlify la tienen en planes de pago.
- El progreso se guarda **en el móvil de ella** (`localStorage`). Si cierra el navegador, al volver sigue donde lo dejó. Si usa modo incógnito, se juega igual pero no se guarda.

---

## Estructura

```
contenido/config.js     ← TODO el contenido (lo único que hay que editar)
fotos/                  ← tus fotos originales (no se suben a git)
public/fotos/           ← fotos optimizadas (generadas)
src/
  main.js               arranque y parámetros de URL
  estado.js             progreso (localStorage con try/catch)
  progreso.js           reglas: niveles disponibles, letras, %
  validar.js            revisa config.js y explica los errores
  pantallas/            entrada, mapa, nivel, recompensa, inventario, candado, revelación, regalo, cierre
  juegos/               quiz, memory, donde, rasca, puzzle
  efectos/              nieve, confeti, caja 3D, sobre
  estilos/              base, juego, revelación
scripts/
  optimizar-fotos.mjs   npm run fotos
  generar-qr.mjs        npm run qr
  tarjetas.mjs          npm run tarjetas
  crear-ejemplos.mjs    npm run ejemplos
```

**Tecnología:** Vite y JavaScript sin framework. Pesa unos 20 KB comprimido, más fuentes y fotos. Las fuentes (Fraunces, Figtree y Caveat) van incluidas en la propia web, sin llamadas a Google. Las únicas dependencias del juego son `canvas-confetti` y las fuentes.
