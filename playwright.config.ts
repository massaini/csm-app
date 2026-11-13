import { defineConfig, devices } from '@playwright/test';

const PORTA = 3100;
export const URL_BASE = `http://localhost:${PORTA}`;
/** Banco próprio dos testes ponta a ponta (mesmo container do banco de testes). */
export const BANCO_E2E =
  process.env.DATABASE_URL_E2E ?? 'postgresql://postgres:postgres@localhost:5433/csm_fila_e2e';

export default defineConfig({
  testDir: 'e2e',
  // um banco compartilhado: um teste por vez
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 8_000 },
  retries: 0,
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: URL_BASE,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx next dev -p ${PORTA}`,
    url: `${URL_BASE}/login`,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: BANCO_E2E,
      E2E: '1', // libera o relógio controlável e o endpoint /api/e2e
      E2E_SEM_JOB: '1', // a varredura roda sob demanda pelo /api/e2e
      HORA_VIRADA: '00:00',
      TZ: 'America/Sao_Paulo',
    },
  },
});
