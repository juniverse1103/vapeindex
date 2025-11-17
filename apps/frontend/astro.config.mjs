// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwind from '@astrojs/tailwind';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  output: 'server', // SSR for dynamic content
  adapter: cloudflare({
    platformProxy: {
      enabled: true
    }
  }),
  integrations: [
    tailwind({
      applyBaseStyles: false, // We'll use custom base styles
    })
  ],
  vite: {
    define: {
      'process.env.API_URL': JSON.stringify(process.env.API_URL || 'http://localhost:8787')
    },

    plugins: [tailwindcss()]
  }
});