import { expect, test, type Page } from '@playwright/test';
import {
  CPF,
  contextoAdmin,
  contextoMotorista,
  entrarAdmin,
  entrarMotorista,
  fecharContextos,
  permitirNoConsole,
  prepararBase,
  servidor,
} from './apoio';

const FALHA = 'Não foi possível concluir. Verifique sua internet e tente novamente.';

/** Derruba as server actions (POST na própria página) para simular rede ou servidor fora. */
async function derrubarAcoes(page: Page) {
  await page.route('**/*', (rota) =>
    rota.request().method() === 'POST' && rota.request().headers()['next-action']
      ? rota.abort('failed')
      : rota.continue(),
  );
}

test.afterEach(fecharContextos);
test.beforeEach(async ({ request }) => {
  await prepararBase();
  await servidor(request, { zerar: true });
  permitirNoConsole(/net::ERR_FAILED/);
});

test('FE-04: falha ao salvar motorista mostra o erro e libera o botão', async ({ browser }) => {
  const admin = await (await contextoAdmin(browser)).newPage();
  await entrarAdmin(admin);
  await admin.goto('/admin/motoristas');
  await expect(admin.getByRole('cell', { name: 'João da Silva' })).toBeVisible();
  await derrubarAcoes(admin);

  await admin.getByRole('button', { name: '+ Novo motorista' }).click();
  const dialogo = admin.getByRole('dialog', { name: 'Novo motorista' });
  await dialogo.getByLabel('Nome completo').fill('Pedro Teste');
  await dialogo.getByLabel('CPF').fill(CPF.novato);
  await dialogo.getByRole('button', { name: 'Cadastrar' }).click();
  await expect(dialogo.getByRole('alert').filter({ hasText: FALHA })).toBeVisible();
  await expect(dialogo.getByRole('button', { name: 'Cadastrar' })).toBeEnabled();
});

test('FE-04: falha numa confirmação do painel fecha o diálogo e avisa', async ({ browser }) => {
  const admin = await (await contextoAdmin(browser)).newPage();
  await entrarAdmin(admin);
  await admin.goto('/admin/motoristas');
  const linha = admin.getByRole('row').filter({ hasText: 'João da Silva' });
  await expect(linha).toBeVisible();
  await derrubarAcoes(admin);

  await linha.getByRole('button', { name: 'Desativar' }).click();
  await admin.getByRole('dialog').getByRole('button', { name: 'Desativar' }).click();
  await expect(admin.getByRole('dialog')).toBeHidden();
  await expect(admin.getByRole('alert').filter({ hasText: FALHA })).toBeVisible();
  await expect(linha.getByText('Ativo', { exact: true })).toBeVisible();
});

test('FE-04: falha ao salvar configurações mostra o erro e libera o botão', async ({ browser }) => {
  const admin = await (await contextoAdmin(browser)).newPage();
  await entrarAdmin(admin);
  await admin.goto('/admin/configuracoes');
  await expect(admin.getByRole('heading', { name: 'Configurações' })).toBeVisible();
  await derrubarAcoes(admin);
  await admin.getByRole('button', { name: 'Salvar configurações' }).click();
  await expect(admin.getByRole('alert').filter({ hasText: FALHA })).toBeVisible();
  await expect(admin.getByRole('button', { name: 'Salvar configurações' })).toBeEnabled();
});

test('FE-04: "Sair" sem rede avisa o motorista e não fica preso em "Saindo…"', async ({
  browser,
}) => {
  const page = await (await contextoMotorista(browser)).newPage();
  await entrarMotorista(page, CPF.joao);
  await expect(page).toHaveURL(/\/fila$/);
  await page.goto('/historico');
  await expect(page.getByText('Você ainda não tem atendimentos')).toBeVisible();
  await derrubarAcoes(page);
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Não foi possível sair' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sair' })).toBeEnabled();
  await expect(page).toHaveURL(/\/historico$/);
});

test('FE-04: sem resposta do servidor, a Fila ao Vivo avisa em vez de ficar "Carregando…"', async ({
  browser,
}) => {
  const admin = await (await contextoAdmin(browser)).newPage();
  await entrarAdmin(admin);
  await admin.route('**/api/admin/consulta', (rota) => rota.abort('failed'));
  await admin.reload();
  await expect(admin.getByText('Sem conexão com o servidor. Tentando novamente…')).toBeVisible();
  await expect(admin.getByText('Não foi possível carregar.')).toBeVisible();
  await expect(admin.getByText('Carregando…')).toHaveCount(0);
});
