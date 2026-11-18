import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  // Vite handles TSX using tsconfig's react-jsx transform. A refresh plugin is
  // unnecessary for this bootstrap and would add prerelease transitive packages.
  // Forge serves Custom UI under a nested URL; absolute asset paths would fail.
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
  },
});
