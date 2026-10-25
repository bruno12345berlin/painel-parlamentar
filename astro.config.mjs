import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// A URL final é definida em site.config.ts; manter igual aqui quando o domínio existir.
export default defineConfig({
  site: "https://painel-parlamentar.pages.dev",
  trailingSlash: "never",
  build: { format: "file" },
  vite: { plugins: [tailwindcss()] },
});
