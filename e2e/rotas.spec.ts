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

test.afterEach(fecharContextos);
test.beforeEach(async ({ request }) => {
  await prepararBase();
  await servidor(request, { zerar: true });
});

/** Visita as telas, junta os links internos e confere que cada um responde sem erro. */
async function conferirLinks(page: Page, telas: string[]) {
  const links = new Set<string>();
  for (const tela of telas) {
    await page.goto(tela);
    await expect(page.locator('main').first()).toBeVisible();
    for (const href of await page
      .locator('a[href^="/"]')
      .evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''))) {
      links.add(href);
    }
  }
  expect(links.size).toBeGreaterThan(0);
  for (const href of links) {
    const r = await page.request.get(href);
    expect(r.status(), href).toBeLessThan(400);
  }
  return links;
}

test('FE-05: os links das telas do motorista levam a rotas que existem', async ({ browser }) => {
  const page = await (await contextoMotorista(browser)).newPage();
  await conferirLinks(page, ['/login', '/instalar', '/termos']);
  await entrarMotorista(page, CPF.joao);
  await expect(page).toHaveURL(/\/fila$/);
  const links = await conferirLinks(page, ['/fila', '/historico', '/em-breve']);
  expect([...links]).toEqual(expect.arrayContaining(['/fila', '/historico']));
});

test('FE-05: os links do painel levam a rotas que existem', async ({ browser }) => {
  const admin = await (await contextoAdmin(browser)).newPage();
  await entrarAdmin(admin);
  // em Bancadas o grupo "Bancadas e Regiões" já vem aberto, com os dois subitens visíveis
  const links = await conferirLinks(admin, ['/admin/bancadas']);
  // as 6 telas da barra lateral do super-admin: Fila ao Vivo, Histórico, Motoristas,
  // Bancadas, Regiões e Administradores
  expect([...links].sort()).toEqual(
    [
      '/admin',
      '/admin/administradores',
      '/admin/bancadas',
      '/admin/historico',
      '/admin/motoristas',
      '/admin/regioes',
    ].sort(),
  );
});

test('FE-05: rota inexistente mostra a página 404 em português com volta ao início', async ({
  browser,
}) => {
  permitirNoConsole(/status of 404/);
  const page = await (await contextoMotorista(browser)).newPage();
  const r = await page.goto('/nao-existe');
  expect(r?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible();
  await page.getByRole('link', { name: 'Voltar ao início' }).click();
  await expect(page).toHaveURL(/\/login$/);

  const admin = await (await contextoAdmin(browser)).newPage();
  await entrarAdmin(admin);
  await admin.goto('/admin/nao-existe');
  await admin.getByRole('link', { name: 'Voltar ao painel' }).click();
  await expect(admin.getByRole('heading', { name: 'Fila ao Vivo' })).toBeVisible();
});
