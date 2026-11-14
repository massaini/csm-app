import { execSync } from 'node:child_process';
import { Client } from 'pg';

export const BANCO_TESTE =
  process.env.DATABASE_URL_TEST ?? 'postgresql://postgres:postgres@localhost:5433/csm_fila_test';

/**
 * Cria o banco de testes (se faltar) e aplica as migrações antes da suíte. O container `db_test`
 * usa tmpfs: volta vazio sempre que o Docker reinicia.
 */
export default async function globalSetup() {
  const url = new URL(BANCO_TESTE);
  const nome = url.pathname.slice(1);
  const admin = new Client({
    connectionString: `${url.protocol}//${url.username}:${url.password}@${url.host}/postgres`,
  });
  try {
    await admin.connect();
  } catch {
    throw new Error(
      `Banco de testes indisponível em ${url.host}. Suba os containers com "docker compose up -d".`,
    );
  }
  const existe = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [nome]);
  if (existe.rowCount === 0) await admin.query(`CREATE DATABASE "${nome}"`);
  await admin.end();
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: BANCO_TESTE },
    stdio: 'ignore',
  });
}
