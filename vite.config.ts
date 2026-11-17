import { defineConfig } from 'vite';

// base './' so the built site works from any folder (GitHub Pages, the Mac Mini, a zip).
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: {
        main: 'index.html',
        gallery: 'gallery.html',
      },
    },
  },
});
