import { defineConfig } from 'vite';

export default defineConfig({
  // 相对路径构建产物：既能挂根路径，也能挂到 /game 这类子路径
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5183,
    strictPort: true,
  },
});
