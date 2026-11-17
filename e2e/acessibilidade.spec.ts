import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
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
  SENHA_MOTORISTA,
  servidor,
} from './apoio';

/**
 * Pares de cor abaixo do AA que vêm do Figma validado pelo cliente; o PRD (RNF04, Contraste)
 * manda manter o Figma nesses casos. Qualquer outro par reprova.
 */
const PARES_DO_FIGMA = [
  { fg: '#8892a5', bg: '#12315a' }, // text-muted sobre elevated (Option Card selecionado)
  { fg: '#ef4444', bg: '#0a1f3d' }, // danger sobre surface (botão Danger no overlay 144:447)
];

function parDoFigma(dados: unknown): boolean {
  const d = dados as { fgColor?: string; bgColor?: string } | null;
  return PARES_DO_FIGMA.some((p) => p.fg === d?.fgColor && p.bg === d?.bgColor);
}

/** Regras WCAG 2.1 níveis A e AA verificadas pelo axe em cada tela. */
async function auditar(page: Page, tela: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const achados = violations
    .map((v) => ({
      ...v,
      nodes:
        v.id === 'color-contrast'
          ? v.nodes.filter((n) => !n.any.some((c) => parDoFigma(c.data)))
          : v.nodes,
    }))
    .filter((v) => v.nodes.length > 0)
    .map(
      (v) =>
        `${tela} · ${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
    );
  expect.soft(achados, `violações de acessibilidade em ${tela}`).toEqual([]);
}

test.afterEach(fecharContextos);
test.beforeEach(async ({ request }) => {
  await prepararBase();
  await servidor(request, { zerar: true });
});

test('FE-03: telas públicas e de acesso do motorista sem violações WCAG A/AA', async ({
  browser,
}) => {
  const page = await (await contextoMotorista(browser)).newPage();
  for (const rota of ['/login', '/instalar', '/termos']) {
    await page.goto(rota);
    await auditar(page, rota);
  }
  await entrarMotorista(page, CPF.novato);
  await expect(page).toHaveURL(/\/trocar-senha$/);
  await auditar(page, '/trocar-senha');

  const ctx = await contextoMotorista(browser, { perguntarNotificacoes: true });
  await ctx.addInitScript(() =>
    Object.defineProperty(Notification, 'permission', { get: () => 'default' }),
  );
  const outro = await ctx.newPage();
  await entrarMotorista(outro, CPF.maria);
  await expect(outro).toHaveURL(/\/notificacoes$/);
  await expect(outro.getByRole('button', { name: 'Ativar notificações' })).toBeVisible();
  await auditar(outro, '/notificacoes');
});

test('FE-03: telas da fila do motorista sem violações WCAG A/AA', async ({ browser }) => {
  const page = await (await contextoMotorista(browser)).newPage();
  await entrarMotorista(page, CPF.joao);
  await expect(page).toHaveURL(/\/fila$/);
  await expect(page.getByText('Dentro do pátio - gerar senha disponível')).toBeVisible();
  await auditar(page, '/fila (sem senha)');
  for (const rota of ['/historico', '/em-breve']) {
    await page.goto(rota);
    await auditar(page, rota);
  }

  await gerarSenhaPelaTela(page);
  await auditar(page, '/fila (aguardando)');
  await page.getByRole('button', { name: 'Cancelar senha' }).click();
  await auditar(page, '/fila (confirmar cancelamento)');
  await page.getByRole('button', { name: 'Voltar' }).click();

  const admin = await (await contextoAdmin(browser)).newPage();
  await entrarAdmin(admin);
  await chamarNoPainel(admin, 'A-001');
  await expect(page.getByText('Você foi chamado')).toBeVisible();
  await auditar(page, '/fila (chamado)');
  await page.getByRole('button', { name: 'Estou a caminho' }).click();
  await expect(page.getByRole('button', { name: 'Concluir atendimento' })).toBeVisible();
  await auditar(page, '/fila (em atendimento)');
  await page.getByRole('button', { name: 'Concluir atendimento' }).click();
  await expect(page.getByText('Confirme só depois de terminar o carregamento.')).toBeVisible();
  await auditar(page, '/fila (confirmar conclusão)');
  await page.getByRole('button', { name: 'Concluir', exact: true }).click();
  await expect(page.getByText('Carregamento concluído')).toBeVisible();
  await auditar(page, '/fila (concluído)');
  await page.goto('/historico');
  await auditar(page, '/historico (com atendimento)');
});

test('FE-03: telas do painel sem violações WCAG A/AA', async ({ browser }) => {
  const motorista = await (await contextoMotorista(browser)).newPage();
  await entrarMotorista(motorista, CPF.joao);
  await expect(motorista).toHaveURL(/\/fila$/);
  await gerarSenhaPelaTela(motorista);

  const admin = await (await contextoAdmin(browser)).newPage();
  await admin.goto('/admin/login');
  await auditar(admin, '/admin/login');
  await entrarAdmin(admin);
  await expect(admin.getByRole('row').filter({ hasText: 'A-001' })).toBeVisible();
  await auditar(admin, '/admin');
  await admin.getByText('Configurações da fila').click();
  await expect(admin.getByRole('button', { name: 'Salvar configurações' })).toBeVisible();
  await auditar(admin, '/admin (configurações abertas)');
  for (const rota of [
    '/admin/historico',
    '/admin/motoristas',
    '/admin/bancadas',
    '/admin/regioes',
    '/admin/administradores',
  ]) {
    await admin.goto(rota);
    await expect(admin.getByRole('heading', { level: 1 })).toBeVisible();
    await auditar(admin, rota);
  }

  await admin.goto('/admin/motoristas');
  await admin.getByRole('button', { name: 'Ações de João da Silva' }).click();
  await expect(admin.getByRole('menu')).toBeVisible();
  await auditar(admin, '/admin/motoristas (menu de ações aberto)');
  await admin.keyboard.press('Escape');
  await admin.getByRole('button', { name: 'Filtrar por' }).click();
  await admin.getByRole('menuitem', { name: 'Situação' }).click();
  await expect(admin.getByRole('menuitemcheckbox').first()).toBeVisible();
  await auditar(admin, '/admin/motoristas (subfiltro aberto)');
  await admin.keyboard.press('Escape');

  await admin.getByRole('button', { name: '+ Novo motorista' }).click();
  await expect(admin.getByRole('dialog')).toBeVisible();
  await auditar(admin, '/admin/motoristas (novo motorista)');
});

async function focado(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    const s = el ? getComputedStyle(el) : null;
    return {
      nome: el?.getAttribute('aria-label') || el?.textContent?.trim() || el?.id || '',
      tag: el?.tagName.toLowerCase(),
      contorno: s ? `${s.outlineStyle} ${s.outlineWidth}` : '',
      borda: s?.borderColor ?? '',
    };
  });
}

test('FE-03: o motorista entra só com o teclado e o foco fica visível', async ({ browser }) => {
  const page = await (await contextoMotorista(browser)).newPage();
  await page.goto('/login', { waitUntil: 'networkidle' });
  // primeiro Tab cai no CPF; o campo focado troca a borda para a cor primária
  await page.keyboard.press('Tab');
  expect((await focado(page)).tag).toBe('input');
  expect((await focado(page)).borda).toBe('rgb(245, 197, 24)');
  await page.keyboard.type(CPF.joao);
  await page.keyboard.press('Tab');
  await page.keyboard.type(SENHA_MOTORISTA);
  // botões e links mostram o contorno de foco
  await page.keyboard.press('Tab');
  const botao = await focado(page);
  expect(botao.contorno).toBe('solid 2px');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/fila$/);
});

test('FE-03: no painel, Esc fecha o diálogo e o foco volta ao botão que o abriu', async ({
  browser,
}) => {
  const admin = await (await contextoAdmin(browser)).newPage();
  await entrarAdmin(admin);
  await admin.goto('/admin/motoristas');
  const novo = admin.getByRole('button', { name: '+ Novo motorista' });
  await novo.focus();
  await admin.keyboard.press('Enter');
  const dialogo = admin.getByRole('dialog', { name: 'Novo motorista' });
  await expect(dialogo).toBeVisible();
  await expect(dialogo.getByLabel('Nome completo')).toBeFocused();
  await admin.keyboard.press('Escape');
  await expect(dialogo).toBeHidden();
  await expect(novo).toBeFocused();
});

test('FE-11: os campos de Bancadas e Regiões têm nome acessível, inclusive na edição', async ({
  browser,
}) => {
  const admin = await (await contextoAdmin(browser)).newPage();
  await entrarAdmin(admin);
  await admin.goto('/admin/bancadas');
  await expect(admin.getByLabel('Nova bancada no galpão F SDR')).toBeVisible();

  await admin.getByRole('button', { name: 'Renomear Bancada 08' }).click();
  const campo = admin.getByLabel('Novo nome da bancada 08 do galpão F SDR');
  await expect(campo).toBeFocused();
  await auditar(admin, '/admin/bancadas (renomeando)');
  await campo.fill('09');
  await admin.keyboard.press('Enter');
  await expect(admin.getByRole('button', { name: 'Renomear Bancada 09' })).toBeVisible();

  await admin.goto('/admin/regioes');
  await expect(admin.getByLabel('Código da região')).toBeVisible();
  await expect(admin.getByLabel('Bairro da região')).toBeVisible();
});
