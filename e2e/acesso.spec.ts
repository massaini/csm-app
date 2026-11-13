import { expect, test } from '@playwright/test';
import {
  CPF,
  contextoAdmin,
  contextoMotorista,
  entrarAdmin,
  entrarMotorista,
  fecharContextos,
  prepararBase,
  servidor,
} from './apoio';

test.afterEach(fecharContextos);

test.beforeEach(async ({ request }) => {
  await prepararBase();
  await servidor(request, { zerar: true });
});

test('RF01-CA1: credenciais corretas levam à fila; troca pendente leva à troca de senha', async ({
  browser,
}) => {
  const ctx = await contextoMotorista(browser);
  const page = await ctx.newPage();
  await entrarMotorista(page, CPF.joao);
  await expect(page).toHaveURL(/\/fila$/);
  await expect(page.getByText('João da Silva')).toBeVisible();

  const novato = await (await contextoMotorista(browser)).newPage();
  await entrarMotorista(novato, CPF.novato);
  await expect(novato).toHaveURL(/\/trocar-senha$/);
});

test('RF02-CA1 / RF02-CA3: com troca pendente, qualquer rota vai para a troca; depois segue para a fila', async ({
  browser,
}) => {
  const page = await (await contextoMotorista(browser)).newPage();
  await entrarMotorista(page, CPF.novato);
  await expect(page).toHaveURL(/\/trocar-senha$/);
  await page.goto('/historico');
  await expect(page).toHaveURL(/\/trocar-senha$/);
  await page.getByLabel('Senha atual').fill('Motorista-123');
  await page.getByLabel('Nova senha', { exact: true }).fill('Nova-Senha-1');
  await page.getByLabel('Confirme a nova senha').fill('Nova-Senha-1');
  await page.getByRole('button', { name: 'Salvar nova senha' }).click();
  await expect(page).toHaveURL(/\/fila$/);
});

test('RF01-CA6: o link dos termos de uso abre /termos', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'termos de uso da CSM' }).click();
  await expect(page).toHaveURL(/\/termos$/);
  await expect(page.getByRole('heading', { name: 'Termos de uso' })).toBeVisible();
});

test('RF23-CA2 / RF23-CA3: /instalar é pública, tem link no login e passo a passo para Android e iPhone', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Como instalar o app' }).click();
  await expect(page).toHaveURL(/\/instalar$/);
  await expect(page.getByRole('heading', { name: 'Android (Chrome)' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'iPhone (Safari)' })).toBeVisible();
  await expect(page.getByText('Adicionar à Tela de Início')).toBeVisible();
});

test('RF04-CA3: o motorista sai pelo histórico e o admin pela barra lateral', async ({
  browser,
}) => {
  const motorista = await (await contextoMotorista(browser)).newPage();
  await entrarMotorista(motorista, CPF.joao);
  await expect(motorista).toHaveURL(/\/fila$/);
  await motorista.goto('/historico');
  await motorista.getByRole('button', { name: 'Sair' }).click();
  await expect(motorista).toHaveURL(/\/login$/);
  await motorista.goto('/fila');
  await expect(motorista).toHaveURL(/\/login$/);

  const admin = await (await contextoAdmin(browser)).newPage();
  await entrarAdmin(admin);
  await admin.getByRole('button', { name: 'Sair' }).click();
  await expect(admin).toHaveURL(/\/admin\/login$/);
});

test('RF27-CA2: um admin comum não vê nem acessa Administradores', async ({ browser }) => {
  const admin = await (await contextoAdmin(browser)).newPage();
  await entrarAdmin(admin, CPF.admin);
  await expect(admin.getByRole('link', { name: 'Administradores' })).toHaveCount(0);
  await admin.goto('/admin/administradores');
  await expect(admin).toHaveURL(/\/admin$/);
});

test('RNF02-CA4: buscar motorista por CPF no painel não põe o CPF em nenhuma URL', async ({
  browser,
}) => {
  const admin = await (await contextoAdmin(browser)).newPage();
  const urls: string[] = [];
  admin.on('request', (r) => urls.push(r.url()));
  await entrarAdmin(admin);
  await admin.goto('/admin/motoristas');
  await admin.getByPlaceholder('Nome ou CPF').fill(CPF.joao);
  await expect(admin.getByRole('cell', { name: 'João da Silva' })).toBeVisible();
  await admin.goto('/admin');
  await admin.getByPlaceholder('Buscar nome ou CPF').fill(CPF.maria);
  await admin.waitForTimeout(1_000);
  const comCpf = urls.filter(
    (u) => u.includes(CPF.joao) || u.includes(CPF.maria) || u.includes(CPF.superAdmin),
  );
  expect(comCpf).toEqual([]);
});
