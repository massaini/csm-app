import { expect, test, type Page } from '@playwright/test';
import {
  CPF,
  contextoMotorista,
  entrarMotorista,
  fecharContextos,
  gerarSenhaPelaTela,
  prepararBase,
  servidor,
} from './apoio';

test.afterEach(fecharContextos);
test.beforeEach(async ({ request }) => {
  await prepararBase();
  await servidor(request, { zerar: true });
});

async function naFila(page: Page, documento = CPF.joao) {
  await entrarMotorista(page, documento);
  await expect(page).toHaveURL(/\/fila$/);
}

test('RF08-CA6 / RF16-CA1: cabeçalho com nome e "Histórico"; Tab Bar na fila e no histórico', async ({
  browser,
}) => {
  const page = await (await contextoMotorista(browser)).newPage();
  await naFila(page);
  await expect(page.getByText('Olá, motorista')).toBeVisible();
  await expect(page.getByText('João da Silva')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible();
  await page.getByRole('link', { name: 'Histórico' }).click();
  await expect(page).toHaveURL(/\/historico$/);
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible();
});

test('RF16-CA2: Disponibilidade e Demonstrativo abrem "Em breve"', async ({ browser }) => {
  const page = await (await contextoMotorista(browser)).newPage();
  await naFila(page);
  for (const aba of ['Disponibilidade', 'Demonstrativo']) {
    await page.getByRole('link', { name: aba }).click();
    await expect(page.getByRole('heading', { name: 'Em breve' })).toBeVisible();
    await expect(page.getByRole('link', { name: aba })).toHaveAttribute('aria-current', 'page');
  }
});

test('RF09-CA4: sem permissão de localização, chip "Localização indisponível" e botão bloqueado', async ({
  browser,
}) => {
  const page = await (await contextoMotorista(browser, { semGps: true })).newPage();
  await naFila(page);
  await expect(page.getByText('Localização indisponível')).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByText('Ative a localização ou peça liberação ao administrador'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gerar senha' })).toBeDisabled();
});

test('RF12-CA1: "Cancelar senha" abre o overlay com a posição; "Voltar" não altera nada', async ({
  browser,
}) => {
  const page = await (await contextoMotorista(browser)).newPage();
  await naFila(page);
  await gerarSenhaPelaTela(page);
  await page.getByRole('button', { name: 'Cancelar senha' }).click();
  const dialogo = page.getByRole('dialog');
  await expect(
    dialogo.getByText('Você perderá sua posição atual (1º)', { exact: false }),
  ).toBeVisible();
  await dialogo.getByRole('button', { name: 'Voltar' }).click();
  await expect(dialogo).toBeHidden();
  await page.reload();
  await expect(page.getByText('Aguardando na fila')).toBeVisible();
});

test('RF15-CA3 / RF15-CA4: histórico vazio com cards zerados e sem "Exportar"', async ({
  browser,
}) => {
  const page = await (await contextoMotorista(browser)).newPage();
  await naFila(page);
  await page.goto('/historico');
  await expect(page.getByText('Você ainda não tem atendimentos')).toBeVisible();
  await expect(page.getByText('Atendimentos', { exact: true })).toBeVisible();
  await expect(page.getByText('—', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Exportar/ })).toHaveCount(0);
});

test('RF30-CA1 / RF30-CA2: sem rede, a ação mostra "Enviando…", repete 3 vezes e exibe o banner', async ({
  browser,
}) => {
  const ctx = await contextoMotorista(browser);
  const page = await ctx.newPage();
  await naFila(page);
  await expect(page.getByText('Dentro do pátio - gerar senha disponível')).toBeVisible();
  const falhas: string[] = [];
  page.on('requestfailed', (r) => {
    if (r.method() === 'POST' && new URL(r.url()).pathname === '/fila') falhas.push(r.url());
  });
  await ctx.setOffline(true);
  await page.getByRole('button', { name: 'Gerar senha' }).click();
  await expect(page.getByRole('button', { name: 'Enviando…' })).toBeVisible();
  await expect(
    page.getByText('Sem conexão. Verifique sua internet e tente novamente.'),
  ).toBeVisible({
    timeout: 15_000,
  });
  await expect.poll(() => falhas.length, { timeout: 15_000 }).toBe(4); // 1 envio + 3 repetições
  await ctx.setOffline(false);
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByText('Sem conexão.', { exact: false })).toBeHidden();
});

test('RF05-CA1 / RF05-CA6: logo após o login pergunta das notificações; "Agora não" vale até sair', async ({
  browser,
}) => {
  const ctx = await contextoMotorista(browser, { perguntarNotificacoes: true });
  // o Chromium de teste não começa em "default"; simula um aparelho que ainda não respondeu
  await ctx.addInitScript(() =>
    Object.defineProperty(Notification, 'permission', { get: () => 'default' }),
  );
  const page = await ctx.newPage();
  await entrarMotorista(page, CPF.joao);
  await expect(page).toHaveURL(/\/notificacoes$/);
  await expect(page.getByRole('button', { name: 'Ativar notificações' })).toBeVisible();
  await page.getByRole('button', { name: 'Agora não' }).click();
  await expect(page).toHaveURL(/\/fila$/);
  await page.reload();
  await expect(page).toHaveURL(/\/fila$/); // abrir de novo não pergunta
  await page.goto('/historico');
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await entrarMotorista(page, CPF.joao);
  await expect(page).toHaveURL(/\/notificacoes$/); // volta a perguntar no próximo login
});

test('RF05-CA3: com notificações negadas, a tela Aguardando avisa para manter o app aberto', async ({
  browser,
}) => {
  const ctx = await contextoMotorista(browser);
  await ctx.addInitScript(() =>
    Object.defineProperty(Notification, 'permission', { get: () => 'denied' }),
  );
  const page = await ctx.newPage();
  await naFila(page);
  await gerarSenhaPelaTela(page);
  await expect(
    page.getByText('Notificações desativadas — mantenha o app aberto para ver a chamada.'),
  ).toBeVisible();
});

for (const largura of [360, 430]) {
  test(`RNF04-CA1: sem rolagem horizontal e alvos de toque ≥ 44 px em ${largura} px`, async ({
    browser,
  }) => {
    const page = await (await contextoMotorista(browser, { largura })).newPage();
    await page.goto('/login');
    await naFila(page);
    for (const rota of ['/login', '/instalar', '/termos', '/fila', '/historico', '/em-breve']) {
      if (rota === '/login') continue; // já logado: /login redireciona
      await page.goto(rota);
      await page.waitForLoadState('networkidle');
      const largo = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(largo, `rolagem horizontal em ${rota}`).toBe(false);
      // botões e links "soltos" (fora de parágrafos de texto, onde WCAG isenta links inline)
      const pequenos = await page.evaluate(() =>
        [...document.querySelectorAll('button, a')]
          .filter((el) => !el.closest('p') && !el.closest('[data-nextjs-toast]'))
          .map((el) => ({
            texto: (el.textContent ?? '').trim(),
            altura: el.getBoundingClientRect().height,
          }))
          .filter((e) => e.altura > 0 && e.altura < 44),
      );
      expect(pequenos, `alvos menores que 44 px em ${rota}`).toEqual([]);
    }
  });
}
