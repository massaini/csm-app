import { execSync } from 'node:child_process';
import { Client } from 'pg';
import { BANCO_E2E } from '../playwright.config';

/** Cria o banco dos testes ponta a ponta (se faltar) e aplica as migrações. */
export default async function globalSetup() {
  const url = new URL(BANCO_E2E);
  const nome = url.pathname.slice(1);
  const admin = new Client({
    connectionString: `${url.protocol}//${url.username}:${url.password}@${url.host}/postgres`,
  });
  await admin.connect();
  const existe = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [nome]);
  if (existe.rowCount === 0) await admin.query(`CREATE DATABASE "${nome}"`);
  await admin.end();
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: BANCO_E2E },
    stdio: 'ignore',
  });
}
