import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
    // os testes de integração compartilham um único banco
    fileParallelism: false,
    testTimeout: 30_000,
    env: {
      DATABASE_URL_TEST:
        process.env.DATABASE_URL_TEST ??
        'postgresql://postgres:postgres@localhost:5433/csm_fila_test',
    },
  },
});
