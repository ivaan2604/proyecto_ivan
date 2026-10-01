# Piso Castellón

Aplicación web personal para seguir la compra de un piso en Castellón de la Plana y su
explotación en alquiler: gastos de compra, financiación, meses de alquiler, cuotas de la
hipoteca y del préstamo familiar, notas y copias de seguridad.

## Arquitectura

**PWA «local-first» + Supabase.**

```
 Móvil / ordenador (PWA instalable)            Supabase (Postgres)
 ┌──────────────────────────────┐             ┌──────────────────────────┐
 │ React UI                     │             │ documents (1 por usuario) │
 │   │ update()                 │  save_document(base, datos)            │
 │   ▼                          │ ──────────► │  · compara versión (CAS) │
 │ Motor de sincronización      │ ◄────────── │  · si coincide → v+1     │
 │   │ 1º escribe aquí           │  ok | conflicto + versión del servidor │
 │   ▼                          │             │ revisions (solo añadir)  │
 │ IndexedDB (copia completa,   │             │  · 300 últimas + 1/día   │
 │ instantáneas locales)        │             └──────────────────────────┘
 └──────────────────────────────┘
```

Garantías contra la pérdida de datos:

1. **Cada cambio se guarda primero en el dispositivo** (IndexedDB) y queda marcado como
   pendiente hasta que el servidor lo confirma. Sin conexión la app funciona igual.
2. **Nunca se sobrescribe a ciegas.** El servidor solo acepta un guardado si parte de su
   versión actual. Si otro dispositivo guardó antes, aparece un aviso para elegir versión;
   la descartada se guarda como instantánea y además queda en el historial de la nube.
3. **Historial de versiones** en la nube (las 300 últimas revisiones y una por día para
   siempre) y **instantáneas locales** (cada 30 minutos de uso y antes de importar,
   restaurar, restablecer o resolver un conflicto). Todo se puede restaurar o descargar
   desde *Copia y ajustes*.
4. **Exportar/importar JSON** con validación estricta. También acepta el JSON del prototipo.

Sin Supabase configurado, la app funciona en modo «solo este dispositivo».

Stack: React + TypeScript + Vite, `vite-plugin-pwa`, `idb`, `zod`, `@supabase/supabase-js`.
Los importes se guardan en céntimos (enteros). Los gráficos son SVG propios.

## Puesta en marcha (una vez, ~10 minutos)

### 1. Supabase

1. Crea una cuenta y un proyecto gratuito en <https://supabase.com> (región *Europe*).
2. Crea las tablas. Dos opciones:
   - **Automática:** en Supabase, *Project Settings → Integrations → GitHub*, conecta este
     repositorio con *Supabase directory* = `supabase` y activa *Deploy to production*.
     Al fusionar en `main` se aplican las migraciones de `supabase/migrations/`.
   - **Manual:** *SQL Editor → New query*, pega el contenido de
     [`supabase/migrations/20261001000000_init.sql`](supabase/migrations/20261001000000_init.sql) y pulsa *Run*.
3. **Authentication → Users → Add user → Create new user**: tu email y una contraseña,
   marcando *Auto Confirm User*.
4. **Authentication → Sign In / Providers**: desactiva *Allow new users to sign up*
   (así nadie más puede crearse cuenta).
5. **Project Settings → API**: copia la *Project URL* y la *anon public key*.

La *anon key* es pública por diseño: la seguridad la dan las políticas RLS del script
(cada usuario solo lee lo suyo y solo puede escribir mediante `save_document`).

> El plan gratuito pausa el proyecto tras ~7 días sin actividad. Si ocurre, reactívalo
> desde el panel de Supabase; mientras tanto la app sigue funcionando con la copia local
> y sube los cambios en cuanto vuelve a estar activo.

### 2. Publicación en GitHub Pages

1. En el repositorio: **Settings → Secrets and variables → Actions → Variables** y crea
   `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con los valores anteriores.
2. **Settings → Pages → Source: GitHub Actions**.
3. Fusiona en `main`: el workflow `.github/workflows/deploy.yml` pasa los tests, compila
   y publica en `https://<usuario>.github.io/proyecto_ivan/`.

### 3. En cada dispositivo

Abre la URL, inicia sesión y, en el móvil, «Añadir a pantalla de inicio» para usarla
como app. La primera vez, en un dispositivo, importa tu JSON del prototipo desde la
pantalla de bienvenida o desde *Copia y ajustes → Importar JSON*. Los demás dispositivos
lo descargarán al iniciar sesión.

**Importante:** no subas tu JSON de datos a este repositorio (es público).

## Desarrollo

```bash
npm install
cp .env.example .env.local   # opcional: sin estas variables, modo solo local
npm run dev                  # http://localhost:5173
npm test                     # tests de cálculos, importación y sincronización
npm run build
```

Estructura:

- `src/lib/` — modelo de datos, cálculos financieros (PMT, cuadro de amortización),
  avisos, importación/exportación y validación.
- `src/sync/` — IndexedDB, cliente de Supabase y motor de sincronización.
- `src/sections/` — una vista por sección.
- `src/ui/`, `src/charts/` — componentes, diálogos propios (no se usan `alert`/`confirm`
  nativos) y gráficos.
- `supabase/migrations/` — tablas, políticas RLS y la función `save_document` (las aplica la integración de GitHub de Supabase).
- `supabase/config.toml` — configuración del proyecto Supabase (registro de usuarios desactivado).
