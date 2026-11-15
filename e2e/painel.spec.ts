import { expect, test } from '@playwright/test';
import {
  CPF,
  chamarNoPainel,
  contextoAdmin,
  contextoMotorista,
  entrarAdmin,
  entrarMotorista,
  fecharContextos,
  gerarSenhaPelaTela,
  prepararBase,
  servidor,
  sql,
} from './apoio';

test.afterEach(fecharContextos);
test.beforeEach(async ({ request }) => {
  await prepararBase();
  await servidor(request, { zerar: true });
});

test('RF17-CA9: sem senhas ativas, a Fila ao Vivo mostra o estado vazio', async ({ browser }) => {
  const admin = await (await contextoAdmin(browser)).newPage();
  await entrarAdmin(admin);
  await expect(admin.getByText('Nenhum motorista na fila agora')).toBeVisible();
});

test('RF20-CA5 / RF20-CA6: Histórico vazio e subtítulo com período e contagens', async ({
  browser,
}) => {
  const admin = await (await contextoAdmin(browser)).newPage();
  await entrarAdmin(admin);
  await admin.goto('/admin/historico');
  await expect(admin.getByText('Nenhuma senha no período')).toBeVisible();
  await expect(
    admin.getByText(
      /^\d{2}\/\d{2}\/\d{4} – \d{2}\/\d{2}\/\d{4} · 0 senhas · 0 concluídas · 0 canceladas$/,
    ),
  ).toBeVisible();
  // as rotas antigas levam ao Histórico unificado
  await admin.goto('/admin/senhas');
  await expect(admin).toHaveURL(/\/admin\/historico$/);
  await admin.goto('/admin/atendimentos');
  await expect(admin).toHaveURL(/\/admin\/historico$/);
});

test('RF22-CA1: "Exportar" abre o modal; "Cancelar" fecha e "Sim, exportar" baixa o CSV', async ({
  browser,
}) => {
  const admin = await (await contextoAdmin(browser)).newPage();
  await entrarAdmin(admin);
  await admin.goto('/admin/historico');
  await admin.getByRole('button', { name: '↓ Exportar' }).click();
  const modal = admin.getByRole('dialog');
  await expect(modal.getByRole('heading', { name: 'Exportar?' })).toBeVisible();
  await expect(
    modal.getByText('Isso vai baixar os dados desta tabela para o seu computador.'),
  ).toBeVisible();
  await modal.getByRole('button', { name: 'Cancelar' }).click();
  await expect(modal).toBeHidden();

  await admin.getByRole('button', { name: '↓ Exportar' }).click();
  const download = admin.waitForEvent('download');
  await modal.getByRole('button', { name: 'Sim, exportar' }).click();
  expect((await download).suggestedFilename()).toMatch(/^historico_\d{4}-\d{2}-\d{2}_\d{4}\.csv$/);
});

test('RNF04-CA2: telas do admin sem rolagem horizontal da página a 1280 px', async ({
  browser,
}) => {
  const admin = await (await contextoAdmin(browser, 1280)).newPage();
  await entrarAdmin(admin);
  for (const rota of [
    '/admin',
    '/admin/historico',
    '/admin/motoristas',
    '/admin/bancadas-regioes',
    '/admin/configuracoes',
    '/admin/administradores',
  ]) {
    await admin.goto(rota);
    await admin.waitForLoadState('networkidle');
    const largo = await admin.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(largo, `rolagem horizontal em ${rota}`).toBe(false);
  }
});

test('RF27-CA4: o super-admin edita o próprio nome e o motorista o vê como Conferente', async ({
  browser,
}) => {
  const admin = await (await contextoAdmin(browser)).newPage();
  await entrarAdmin(admin);
  await admin.goto('/admin/administradores');
  // cada linha tem as 5 colunas do cabeçalho
  const linhaSuper = admin.getByRole('row').filter({ hasText: 'Super Admin' });
  await expect(linhaSuper.getByRole('cell')).toHaveCount(5);
  await expect(linhaSuper.getByRole('cell').nth(2)).toHaveText('Super-administrador');
  await expect(linhaSuper.getByRole('cell').nth(3)).toHaveText('Ativo');
  await admin
    .getByRole('row')
    .filter({ hasText: 'Super Admin' })
    .getByRole('button', { name: 'Editar nome' })
    .click();
  const dialogo = admin.getByRole('dialog', { name: 'Editar nome' });
  await dialogo.getByLabel('Nome completo').fill('Marcos Tavares');
  await dialogo.getByRole('button', { name: 'Salvar' }).click();
  await expect(dialogo).toBeHidden();
  await expect(admin.getByRole('cell', { name: /^Marcos Tavares/ })).toBeVisible();
  await expect(admin.getByRole('complementary').getByText('Marcos Tavares')).toBeVisible();

  const motorista = await (await contextoMotorista(browser)).newPage();
  await entrarMotorista(motorista, CPF.joao);
  await expect(motorista).toHaveURL(/\/fila$/);
  await gerarSenhaPelaTela(motorista);
  await admin.goto('/admin');
  await chamarNoPainel(admin, 'A-001');
  await motorista.getByRole('button', { name: 'Estou a caminho' }).click();
  await expect(motorista.getByText('Marcos Tavares')).toBeVisible();
});

test('RF24-CA8 / RF20-CA7: o menu "⋮" do motorista abre pelo teclado e "Ver histórico" filtra por ele', async ({
  browser,
}) => {
  const joao = await (await contextoMotorista(browser)).newPage();
  await entrarMotorista(joao, CPF.joao);
  await expect(joao).toHaveURL(/\/fila$/);
  await gerarSenhaPelaTela(joao);
  const maria = await (await contextoMotorista(browser)).newPage();
  await entrarMotorista(maria, CPF.maria);
  await expect(maria).toHaveURL(/\/fila$/);
  await gerarSenhaPelaTela(maria);

  const admin = await (await contextoAdmin(browser)).newPage();
  await entrarAdmin(admin);
  await admin.goto('/admin/motoristas');
  const botao = admin.getByRole('button', { name: 'Ações de João da Silva' });
  await botao.focus();
  await admin.keyboard.press('Enter');
  const menu = admin.getByRole('menu', { name: 'Ações de João da Silva' });
  await expect(menu.getByRole('menuitem')).toHaveText([
    'Editar',
    'Ver histórico',
    'Redefinir senha',
    'Liberar geração de senha',
    'Desativar',
  ]);
  await expect(menu.getByRole('menuitem', { name: 'Editar' })).toBeFocused();
  await admin.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitem', { name: 'Ver histórico' })).toBeFocused();
  await admin.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(botao).toBeFocused();

  await botao.click();
  await menu.getByRole('menuitem', { name: 'Ver histórico' }).click();
  await expect(admin).toHaveURL(/\/admin\/historico\?motorista=\d+$/);
  await expect(admin.getByText('Motorista: João da Silva')).toBeVisible();
  await expect(admin.getByRole('cell', { name: 'João da Silva', exact: true })).toBeVisible();
  await expect(admin.getByRole('cell', { name: 'Maria Souza', exact: true })).toHaveCount(0);
  await admin.getByRole('button', { name: 'Remover filtro Motorista: João da Silva' }).click();
  await expect(admin).toHaveURL(/\/admin\/historico$/);
  await expect(admin.getByRole('cell', { name: 'Maria Souza', exact: true })).toBeVisible();
});

test('RF31-CA1 / RF31-CA2 / RF31-CA3: busca por campo, subfiltro com etiqueta e colunas ordenáveis', async ({
  browser,
}) => {
  const admin = await (await contextoAdmin(browser)).newPage();
  await entrarAdmin(admin);
  await admin.goto('/admin/motoristas');
  const nomes = () => admin.locator('tbody tr td:first-child').allTextContents();
  await expect(admin.getByPlaceholder('Buscar por nome')).toBeVisible();

  // ordenação: Nome ascendente por padrão; o clique inverte
  expect(await nomes()).toEqual(['João da Silva', 'Maria Souza', 'Novato Teste']);
  await admin.getByRole('button', { name: 'Nome' }).click();
  expect(await nomes()).toEqual(['Novato Teste', 'Maria Souza', 'João da Silva']);
  await expect(admin.getByRole('columnheader', { name: 'Nome' })).toHaveAttribute(
    'aria-sort',
    'descending',
  );

  // campo de texto: a barra passa a buscar por CPF
  await admin.getByRole('button', { name: 'Filtrar por' }).click();
  await admin.getByRole('menuitem', { name: 'CPF' }).click();
  await admin.getByPlaceholder('Buscar por cpf').fill(CPF.maria.slice(-4));
  expect(await nomes()).toEqual(['Maria Souza']);
  await admin.getByPlaceholder('Buscar por cpf').fill('');

  // campo de opções: subfiltro e etiqueta removível
  await admin.getByRole('button', { name: 'Filtrar por' }).click();
  await admin.getByRole('menuitem', { name: 'Situação' }).click();
  await admin.getByRole('menuitemcheckbox', { name: 'Troca pendente' }).click();
  await admin.keyboard.press('Escape');
  await expect(admin.getByText('Situação: Troca pendente')).toBeVisible();
  expect(await nomes()).toEqual(['Novato Teste']);
  await admin.getByRole('button', { name: 'Remover filtro Situação: Troca pendente' }).click();
  await expect(admin.locator('tbody tr')).toHaveCount(3);
  await expect(admin).toHaveURL(/\/admin\/motoristas$/); // nada vai para a URL (RF31-CA4)
});

test('RF25-CA7: o card mostra 5 bancadas; "Ver mais" abre todas, com Desativar em cada uma', async ({
  browser,
}) => {
  const [galpao] = await sql<{ id: number }>('SELECT id FROM "Galpao" LIMIT 1');
  for (const b of ['09', '10', '11', '12']) {
    await sql('INSERT INTO "Bancada" ("galpaoId", identificacao) VALUES ($1, $2)', [galpao.id, b]);
  }
  const admin = await (await contextoAdmin(browser)).newPage();
  await entrarAdmin(admin);
  await admin.goto('/admin/bancadas-regioes');

  // 6 bancadas no galpão: o card mostra só as 5 primeiras
  const card = admin
    .locator('section')
    .filter({ has: admin.getByRole('heading', { name: 'F SDR' }) });
  await expect(card.getByRole('button', { name: /^Renomear Bancada/ })).toHaveCount(5);
  await expect(
    card.getByRole('button', { name: 'Ver mais bancadas do galpão F SDR' }),
  ).toContainText('1');

  // o modal lista todas e mantém o Desativar de cada uma
  await card.getByRole('button', { name: 'Ver mais bancadas do galpão F SDR' }).click();
  const modal = admin.getByRole('dialog', { name: 'Bancadas · F SDR' });
  await expect(modal.getByRole('button', { name: /^Renomear Bancada/ })).toHaveCount(6);
  await expect(modal.getByRole('button', { name: /^Desativar bancada/ })).toHaveCount(6);
  await modal.getByRole('button', { name: 'Desativar bancada 12 do galpão F SDR' }).click();
  await expect(modal.getByText('Inativa')).toBeVisible();
  await expect(
    modal.getByRole('button', { name: 'Reativar bancada 12 do galpão F SDR' }),
  ).toBeVisible();
  await modal.getByRole('button', { name: 'Fechar' }).click();
  await expect(modal).toBeHidden();
});
