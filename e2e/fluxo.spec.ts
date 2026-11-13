import { expect, test, type Browser, type Page } from '@playwright/test';
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
} from './apoio';

const MIN = 60_000;
/** RNF01-CA1: eventos da fila chegam às telas abertas em até 5 s. */
const ATE_5S = { timeout: 5_000 };

async function motoristaAguardando(browser: Browser, documento: string): Promise<Page> {
  const page = await (await contextoMotorista(browser)).newPage();
  await entrarMotorista(page, documento);
  await expect(page).toHaveURL(/\/fila$/);
  await gerarSenhaPelaTela(page);
  return page;
}

async function painel(browser: Browser): Promise<Page> {
  const admin = await (await contextoAdmin(browser)).newPage();
  await entrarAdmin(admin);
  return admin;
}

test.afterEach(fecharContextos);
test.beforeEach(async ({ request }) => {
  await prepararBase();
  await servidor(request, { zerar: true });
});

test('RF17-CA8 / RNF01-CA1: a senha nova aparece no painel sem recarregar, em até 5 s', async ({
  browser,
}) => {
  const admin = await painel(browser);
  await expect(admin.getByText('Nenhum motorista na fila agora')).toBeVisible();
  await motoristaAguardando(browser, CPF.joao);
  await expect(admin.getByRole('row').filter({ hasText: 'A-001' })).toBeVisible(ATE_5S);
});

test('RF11-CA3 / RNF01-CA1: a chamada troca a tela do motorista em até 5 s, mesmo sem push', async ({
  browser,
}) => {
  const motorista = await motoristaAguardando(browser, CPF.joao);
  const admin = await painel(browser);
  await chamarNoPainel(admin, 'A-001');
  await expect(motorista.getByText('Você foi chamado')).toBeVisible(ATE_5S);
  await expect(motorista.getByText('Dirija-se à bancada')).toBeVisible();
  await expect(motorista.getByText('07', { exact: true })).toBeVisible();
});

test('RF11-CA2: quem está atrás sobe de posição em até 5 s quando o da frente é chamado', async ({
  browser,
}) => {
  await motoristaAguardando(browser, CPF.joao);
  const maria = await motoristaAguardando(browser, CPF.maria);
  await expect(maria.getByText('2º', { exact: true })).toBeVisible();
  const admin = await painel(browser);
  await chamarNoPainel(admin, 'A-001');
  await expect(maria.getByText('1º', { exact: true })).toBeVisible(ATE_5S);
});

test('RF17-CA5: Chamar, contagem com Confirmar chegada, Concluir e bancada ocupada', async ({
  browser,
}) => {
  await motoristaAguardando(browser, CPF.joao);
  await motoristaAguardando(browser, CPF.maria);
  const admin = await painel(browser);
  const joao = admin.getByRole('row').filter({ hasText: 'A-001' });
  const maria = admin.getByRole('row').filter({ hasText: 'A-002' });
  await expect(joao.getByRole('button', { name: 'Chamar' })).toBeEnabled();

  await chamarNoPainel(admin, 'A-001');
  await expect(joao.getByRole('button', { name: 'Confirmar chegada' })).toBeVisible();
  await expect(joao.getByText(/^[0-5]:\d{2}$/)).toBeVisible(); // contagem da tolerância
  await expect(maria.getByRole('button', { name: 'Bancada ocupada' })).toBeDisabled();

  await joao.getByRole('button', { name: 'Confirmar chegada' }).click();
  await expect(joao.getByRole('button', { name: 'Concluir' })).toBeVisible();
  await expect(joao.getByText('Em atendimento')).toBeVisible();
});

test('RF14-CA1 / RF14-CA5 / RF14-CA6: Em atendimento mostra conferente e cronômetro, sem etapas nem seta', async ({
  browser,
}) => {
  const motorista = await motoristaAguardando(browser, CPF.joao);
  const admin = await painel(browser);
  await chamarNoPainel(admin, 'A-001');
  await motorista.getByRole('button', { name: 'Estou a caminho' }).click();
  await expect(motorista.getByText('Vá para a bancada')).toBeVisible();
  await expect(motorista.getByText('Super Admin')).toBeVisible(); // conferente = quem chamou
  await expect(motorista.getByText(/^\d{2}:\d{2}:\d{2}$/)).toBeVisible();
  await expect(motorista.getByText(/Etapa \d de \d/)).toHaveCount(0);
  await expect(motorista.getByRole('link')).toHaveCount(0); // sem a seta "←"
});

test('RF14-CA2: concluir pelo motorista pede confirmação e mostra o resumo', async ({
  browser,
}) => {
  const motorista = await motoristaAguardando(browser, CPF.joao);
  const admin = await painel(browser);
  await chamarNoPainel(admin, 'A-001');
  await motorista.getByRole('button', { name: 'Estou a caminho' }).click();
  await motorista.getByRole('button', { name: 'Concluir atendimento' }).click();
  await expect(motorista.getByText('Confirme só depois de terminar o carregamento.')).toBeVisible();
  await motorista.getByRole('button', { name: 'Concluir', exact: true }).click();
  await expect(motorista.getByText('Carregamento concluído')).toBeVisible();
  await expect(motorista.getByText('Resumo do atendimento')).toBeVisible();
});

test('RF14-CA3: concluído pelo admin, a tela do motorista vira o resumo em até 5 s', async ({
  browser,
}) => {
  const motorista = await motoristaAguardando(browser, CPF.joao);
  const admin = await painel(browser);
  await chamarNoPainel(admin, 'A-001');
  const linha = admin.getByRole('row').filter({ hasText: 'A-001' });
  await linha.getByRole('button', { name: 'Confirmar chegada' }).click();
  await linha.getByRole('button', { name: 'Concluir' }).click();
  await admin.getByRole('dialog').getByRole('button', { name: 'Concluir' }).click();
  await expect(motorista.getByText('Carregamento concluído')).toBeVisible(ATE_5S);
});

test('RF13-CA4: zerada a contagem, "Confirme agora" vale até a carência; depois, "Você perdeu a vez"', async ({
  browser,
  request,
}) => {
  const motorista = await motoristaAguardando(browser, CPF.joao);
  const admin = await painel(browser);
  await chamarNoPainel(admin, 'A-001');
  await expect(motorista.getByText('Você foi chamado')).toBeVisible(ATE_5S);

  await servidor(request, { adiantarMs: 5 * MIN + 5_000 }); // passou do prazo, dentro da carência
  await motorista.reload();
  await expect(motorista.getByRole('button', { name: 'Confirme agora' })).toBeEnabled();

  await servidor(request, { adiantarMs: 30_000 }); // passou da carência
  await motorista.reload();
  await expect(motorista.getByText('Você perdeu a vez')).toBeVisible();
  await expect(motorista.getByRole('button', { name: 'Gerar nova senha' })).toBeVisible();
});

test('RF28-CA2: a senha encerrada na virada do dia mostra a tela de resultado', async ({
  browser,
  request,
}) => {
  const motorista = await motoristaAguardando(browser, CPF.joao);
  await servidor(request, { adiantarMs: 24 * 60 * MIN, varrer: true });
  await motorista.reload();
  await expect(motorista.getByText('Sua senha expirou')).toBeVisible();
  await motorista.getByRole('button', { name: 'Gerar nova senha' }).click();
  await expect(
    motorista.getByRole('heading', { name: 'Gere sua senha para o carregamento' }),
  ).toBeVisible();
});

test('RF17-CA10: o subtítulo da Fila ao Vivo mostra data por extenso e hora', async ({
  browser,
}) => {
  const admin = await painel(browser);
  await expect(admin.getByText(/^Estado em tempo real · \S+-feira|sábado|domingo/)).toBeVisible();
  await expect(admin.getByText(/Estado em tempo real · .+ de \d{4} — \d{2}:\d{2}$/)).toBeVisible();
});

test('RF11-CA4: ao voltar para o primeiro plano, o app busca o estado em até 2 s', async ({
  browser,
}) => {
  const motorista = await motoristaAguardando(browser, CPF.joao);
  const pedido = motorista.waitForRequest((r) => r.url().includes('/api/fila/estado'), {
    timeout: 2_000,
  });
  await motorista.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await pedido;
});
