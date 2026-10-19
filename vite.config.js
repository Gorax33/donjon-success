import { defineConfig } from 'vite';

export default defineConfig({
  // Sur GitHub Pages, le site est servi sous /<nom-du-dépôt>/ : la GitHub Action
  // fournit ce chemin via BASE_PATH. En local (dev, raccourci Chrome, Tauri) : la racine.
  base: process.env.BASE_PATH ?? '/',
  // Recommandé par Tauri : garder les messages de compilation Rust visibles
  clearScreen: false,
  server: { strictPort: true },
});
