import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

const FRONT_ROOT = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: FRONT_ROOT,
  build: {
    rollupOptions: {
      input: {
        root: 'index.html',
        tenant: 'tenant/index.html',
        verify: 'verify/index.html',
        issuer: 'issuer/index.html'
      }
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        secure: false
      }
    }
  },
  test: {
    globals: true,
    environment: 'node',
    exclude: [...configDefaults.exclude, 'tests/e2e/**']
  }
});
