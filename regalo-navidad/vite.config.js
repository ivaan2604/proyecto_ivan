import { defineConfig } from "vite";

export default defineConfig({
  // Rutas relativas: funciona igual en Vercel, Netlify o en una subcarpeta
  base: "./",
  build: { target: "es2020", assetsInlineLimit: 0 },
});
