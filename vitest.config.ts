import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      'cloudflare:workers': path.resolve(__dirname, 'tests/stubs/cloudflare-workers.ts'),
    },
  },
  test: {
    environment: 'node',
  },
});
