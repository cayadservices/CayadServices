import { defineConfig } from 'astro/config';
import tailwind from "@astrojs/tailwind";
import react from "@astrojs/react";
import partytown from "@astrojs/partytown";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: 'https://cayadservices.com/',
  output: 'static', // ✅ Ya lo tienes bien
  // ❌ ELIMINA: adapter: cloudflare({ mode: 'directory' })
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
  image: {
    service: {
      entrypoint: 'astro/assets/services/noop'
    }
  },
  vite: {
    optimizeDeps: {
      force: true,
    },
    build: {
      rollupOptions: {
        external: ['sharp'],
      },
    },
  }
});