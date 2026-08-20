import { defineConfig } from 'astro/config';
import tailwind from "@astrojs/tailwind";
import react from "@astrojs/react";
import partytown from "@astrojs/partytown";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: 'https://cayadservices.com/',
  output: 'static', // <--- Cambio: 'hybrid' → 'static'
  // ELIMINA: adapter: cloudflare({ mode: 'directory' }),
  integrations: [
    tailwind(),
    react(),
    ...(process.env.NODE_ENV === 'production'
      ? [
          partytown({
            config: {
              forward: ["dataLayer.push"],
            },
          }),
        ]
      : []),
    sitemap(),
  ],
  // Desactivar Sharp para que funcione en Cloudflare
  image: {
    service: {
      entrypoint: 'astro/assets/services/noop'
    }
  },
  vite: {
    optimizeDeps: {
      force: true,
    },
    // Excluir Sharp del build para evitar errores
    build: {
      rollupOptions: {
        external: ['sharp'],
      },
    },
  }
});