import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
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
