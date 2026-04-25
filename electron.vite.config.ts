import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') },
      },
    },
    resolve: {
      alias: { '@shared': resolve(__dirname, 'src/shared') },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          control: resolve(__dirname, 'src/preload/control.ts'),
          display: resolve(__dirname, 'src/preload/display.ts'),
        },
      },
    },
    resolve: {
      alias: { '@shared': resolve(__dirname, 'src/shared') },
    },
  },
  renderer: {
    root: '.',
    plugins: [react()],
    resolve: {
      alias: { '@shared': resolve(__dirname, 'src/shared') },
    },
    build: {
      rollupOptions: {
        input: {
          control: resolve(__dirname, 'src/renderer-control/index.html'),
          display: resolve(__dirname, 'src/renderer-display/index.html'),
        },
      },
    },
    server: {
      port: 5173,
    },
  },
});
