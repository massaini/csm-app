import { hash } from '@node-rs/argon2';
import {
  expect,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import { Pool } from 'pg';
import { BANCO_E2E } from '../playwright.config';

/** SQL direto: o client gerado do Prisma é ESM e o Playwright carrega os testes como CommonJS. */
export const pool = new Pool({ connectionString: BANCO_E2E, max: 4 });

export async function sql<T = Record<string, unknown>>(texto: string, valores: unknown[] = []) {
  return (await pool.query(texto, valores)).rows as T[];
}

async function inserir(tabela: string, dados: Record<string, unknown>) {
  const cols = Object.keys(dados);
  const nomes = cols.map((c) => `"${c}"`).join(', ');
  const marcas = cols.map((_, i) => `$${i + 1}`).join(', ');
  const [linha] = await sql<{ id: number }>(
    `INSERT INTO "${tabela}" (${nomes}) VALUES (${marcas}) RETURNING *`,
    Object.values(dados),
  );
  return linha;
}

export const PATIO = { latitude: -23.650304755462123, longitude: -46.51091622883612 };
export const SENHA_MOTORISTA = 'Motorista-123';
export const SENHA_ADMIN = 'Admin-12345';
export const FLAG_AGORA_NAO = 'csm:notificacoes-agora-nao';

/** CPF válido a partir de 9 dígitos-base. */
export function cpf(base: string): string {
  const d = base.padStart(9, '0').split('').map(Number);
  const dv = (nums: number[], peso: number) => {
    const r = (nums.reduce((s, n, i) => s + n * (peso - i), 0) * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = dv(d, 10);
  const d2 = dv([...d, d1], 11);
  return [...d, d1, d2].join('');
}

export const CPF = {
  superAdmin: cpf('529982247'),
  admin: cpf('111444777'),
  joao: cpf('390533447'),
  maria: cpf('123456789'),
  novato: cpf('987654321'),
};

export async function limpar() {
  const tabelas = await sql<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  );
  const lista = tabelas.map((t) => `"${t.tablename}"`).join(', ');
  await sql(`TRUNCATE ${lista} RESTART IDENTITY CASCADE`);
}

/**
 * Base mínima: 1 local (raio 150 m), galpão F SDR com bancadas 07 e 08, região 500 → 07,
 * super-admin, admin comum e os motoristas João e Maria (senhas definitivas) e um novato
 * com troca de senha pendente.
 */
export async function prepararBase() {
  await limpar();
  const local = await inserir('Local', {
    nome: 'Av. André Ramalho, 89',
    endereco: 'Av. André Ramalho, 89',
    ...PATIO,
  });
  const galpao = await inserir('Galpao', {
    nome: 'F SDR',
    endereco: 'Av. André Ramalho, 89',
    prefixoSenha: 'A',
    localId: local.id,
  });
  const regiao = await inserir('Regiao', { codigo: '500', nome: 'Centro de Santo André' });
  const b07 = await inserir('Bancada', { galpaoId: galpao.id, identificacao: '07' });
  await inserir('Bancada', { galpaoId: galpao.id, identificacao: '08' });
  await inserir('RegiaoBancada', { galpaoId: galpao.id, regiaoId: regiao.id, bancadaId: b07.id });
  // ON CONFLICT: um polling atrasado do teste anterior pode recriar a linha logo após o TRUNCATE
  await sql('INSERT INTO "Configuracao" (id) VALUES (1) ON CONFLICT (id) DO NOTHING');

  const senhaAdmin = await hash(SENHA_ADMIN);
  await inserir('Admin', {
    nome: 'Super Admin',
    cpf: CPF.superAdmin,
    senhaHash: senhaAdmin,
    papel: 'SUPER_ADMIN',
    deveTrocarSenha: false,
  });
  await inserir('Admin', {
    nome: 'Ana Admin',
    cpf: CPF.admin,
    senhaHash: senhaAdmin,
    deveTrocarSenha: false,
  });
  const senhaMotorista = await hash(SENHA_MOTORISTA);
  const base = {
    senhaHash: senhaMotorista,
    regiaoId: regiao.id,
    deveTrocarSenha: false,
    ultimaPlaca: 'ABC1D23',
  };
  const joao = await inserir('Motorista', { ...base, nome: 'João da Silva', cpf: CPF.joao });
  const maria = await inserir('Motorista', { ...base, nome: 'Maria Souza', cpf: CPF.maria });
  await inserir('Motorista', {
    ...base,
    nome: 'Novato Teste',
    cpf: CPF.novato,
    deveTrocarSenha: true,
    ultimaPlaca: null,
  });
  return { galpao, regiao, joao, maria };
}

/** Controle do servidor (só existe com E2E=1): relógio e varredura. */
export async function servidor(
  request: APIRequestContext,
  corpo: { adiantarMs?: number; zerar?: boolean; varrer?: boolean },
) {
  const r = await request.post('/api/e2e', { data: corpo });
  expect(r.ok()).toBe(true);
  return r.json();
}

const abertos: BrowserContext[] = [];

/** Fecha os contextos do teste, para nenhum polling vazar para o próximo. */
export async function fecharContextos() {
  await Promise.all(abertos.splice(0).map((c) => c.close().catch(() => {})));
}

/** Contexto de celular no pátio, com GPS liberado e (por padrão) sem a pergunta de notificações. */
export async function contextoMotorista(
  browser: Browser,
  opcoes: { semGps?: boolean; perguntarNotificacoes?: boolean; largura?: number } = {},
): Promise<BrowserContext> {
  const ctx = await browser.newContext({
    viewport: { width: opcoes.largura ?? 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    ...(opcoes.semGps ? {} : { geolocation: PATIO, permissions: ['geolocation'] }),
  });
  abertos.push(ctx);
  if (!opcoes.perguntarNotificacoes) {
    await ctx.addInitScript((flag) => localStorage.setItem(flag, '1'), FLAG_AGORA_NAO);
  }
  return ctx;
}

export async function contextoAdmin(browser: Browser, largura = 1440) {
  const ctx = await browser.newContext({
    viewport: { width: largura, height: 900 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  });
  abertos.push(ctx);
  return ctx;
}

export async function entrarMotorista(page: Page, documento: string, senha = SENHA_MOTORISTA) {
  await page.goto('/login');
  await page.getByLabel('CPF').fill(documento);
  await page.getByLabel('Senha').fill(senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

export async function entrarAdmin(page: Page, documento = CPF.superAdmin, senha = SENHA_ADMIN) {
  await page.goto('/admin/login');
  await page.getByLabel('CPF').fill(documento);
  await page.getByLabel('Senha').fill(senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Fila ao Vivo' })).toBeVisible();
}

/** Gera a senha pela tela (o GPS do contexto está no pátio). */
export async function gerarSenhaPelaTela(page: Page) {
  await page.goto('/fila');
  await expect(page.getByText('Dentro do pátio - gerar senha disponível')).toBeVisible();
  await page.getByRole('button', { name: 'Gerar senha' }).click();
  await expect(page.getByText('Aguardando na fila')).toBeVisible();
}

/** Clica em "Chamar" na linha da senha, na Fila ao Vivo. */
export async function chamarNoPainel(admin: Page, codigo: string) {
  const linha = admin.getByRole('row').filter({ hasText: codigo });
  await linha.getByRole('button', { name: 'Chamar' }).click();
}
