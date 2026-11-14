import { loadEnvConfig } from '@next/env';
import { defineConfig } from 'prisma/config';

// O Prisma 7 não lê o .env sozinho; mesmo carregador do Next, sem sobrescrever o ambiente
loadEnvConfig(process.cwd());

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
