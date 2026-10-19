import { defineConfig } from 'vite';

export default defineConfig({
  // Recommandé par Tauri : garder les messages de compilation Rust visibles
  clearScreen: false,
  server: { strictPort: true },
});
