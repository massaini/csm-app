import { expect, test } from '@playwright/test';
import { contextoAdmin, entrarAdmin, fecharContextos, prepararBase, servidor } from './apoio';

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

test('RF20-CA5: Histórico de Atendimentos sem resultado mostra o estado vazio', async ({
  browser,
}) => {
  const admin = await (await contextoAdmin(browser)).newPage();
  await entrarAdmin(admin);
  await admin.goto('/admin/atendimentos');
  await expect(admin.getByText('Nenhum atendimento no período')).toBeVisible();
});

test('RF21-CA4 / RF21-CA5: Histórico de Senhas vazio e subtítulo com período e contagem', async ({
  browser,
}) => {
  const admin = await (await contextoAdmin(browser)).newPage();
  await entrarAdmin(admin);
  await admin.goto('/admin/senhas');
  await expect(admin.getByText('Nenhuma senha no período')).toBeVisible();
  await expect(
    admin.getByText(/^\d{2}\/\d{2}\/\d{4} – \d{2}\/\d{2}\/\d{4} · 0 senhas geradas$/),
  ).toBeVisible();
});

test('RF22-CA1: "Exportar" abre o modal; "Cancelar" fecha e "Sim, exportar" baixa o CSV', async ({
  browser,
}) => {
  const admin = await (await contextoAdmin(browser)).newPage();
  await entrarAdmin(admin);
  await admin.goto('/admin/senhas');
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
  expect((await download).suggestedFilename()).toMatch(/^senhas_\d{4}-\d{2}-\d{2}_\d{4}\.csv$/);
});

test('RNF04-CA2: telas do admin sem rolagem horizontal da página a 1280 px', async ({
  browser,
}) => {
  const admin = await (await contextoAdmin(browser, 1280)).newPage();
  await entrarAdmin(admin);
  for (const rota of [
    '/admin',
    '/admin/atendimentos',
    '/admin/senhas',
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
