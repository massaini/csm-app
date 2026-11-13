import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { enviarChamada, inscrever, topicoDaSenha, type EnviarPush } from '@/server/push';
import { chamarSenha, gerarSenha } from '@/server/senhas';
import { PLACA, cenario, db, dentro, limpar, novoMotorista, novoRelogio } from './helpers';

let c: Awaited<ReturnType<typeof cenario>>;
let clock: ReturnType<typeof novoRelogio>;
const deps = () => ({ db, clock });
const sub = (n: string) => ({
  endpoint: `https://push.exemplo/${n}`,
  keys: { p256dh: `k-${n}`, auth: `a-${n}` },
});

beforeEach(async () => {
  await limpar();
  c = await cenario();
  clock = novoRelogio();
});
afterAll(() => db.$disconnect());

async function chamada() {
  const m = await novoMotorista(c.regiao.id);
  const g = await gerarSenha(deps(), {
    motoristaId: m.id,
    galpaoId: c.galpao.id,
    placa: PLACA,
    leitura: dentro,
  });
  await chamarSenha(deps(), { senhaId: g.senha!.id, adminId: c.admin.id });
  return { m, senha: g.senha! };
}

describe('inscrição', () => {
  it('RF05-CA2: upsert pela endpoint; num celular compartilhado passa para o motorista logado', async () => {
    const a = await novoMotorista(c.regiao.id, 'A');
    const b = await novoMotorista(c.regiao.id, 'B');
    await inscrever(deps(), a.id, sub('1'));
    await inscrever(deps(), a.id, { ...sub('1'), keys: { p256dh: 'nova', auth: 'nova' } });
    expect(await db.pushSubscription.count()).toBe(1);
    await inscrever(deps(), b.id, sub('1'));
    const s = await db.pushSubscription.findUniqueOrThrow({
      where: { endpoint: sub('1').endpoint },
    });
    expect(s.motoristaId).toBe(b.id);
  });
});

describe('envio da chamada', () => {
  it('RF18-CA4: vai para todas as inscrições, com título, corpo, urgência alta, TTL e Topic curto', async () => {
    const { m, senha } = await chamada();
    await inscrever(deps(), m.id, sub('1'));
    await inscrever(deps(), m.id, sub('2'));
    const chamadas: Parameters<EnviarPush>[] = [];
    const enviar: EnviarPush = async (...args) => {
      chamadas.push(args);
      return 201;
    };
    const r = await enviarChamada({ ...deps(), enviar }, senha.id);
    expect(r).toEqual({ enviados: 2, removidos: 0 });
    expect(chamadas.map(([s]) => s.endpoint).sort()).toEqual([
      sub('1').endpoint,
      sub('2').endpoint,
    ]);
    const [, carga, opcoes] = chamadas[0];
    expect(JSON.parse(carga)).toMatchObject({
      titulo: 'Você foi chamado',
      corpo: `Dirija-se à bancada 07 · Senha ${senha.codigo}`,
      url: '/fila',
    });
    expect(opcoes).toEqual({ TTL: 300, urgency: 'high', topic: topicoDaSenha(senha.id) });
    expect(opcoes.topic.length).toBeLessThanOrEqual(32);
    expect(opcoes.topic).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('RF18-CA5: grava cada envio com o status, apaga inscrições 404/410 e não falha a chamada', async () => {
    const { m, senha } = await chamada();
    await inscrever(deps(), m.id, sub('ok'));
    await inscrever(deps(), m.id, sub('expirada'));
    await inscrever(deps(), m.id, sub('quebrada'));
    const enviar: EnviarPush = async (s) => {
      if (s.endpoint.endsWith('expirada')) return 410;
      if (s.endpoint.endsWith('quebrada')) throw new Error('rede caiu');
      return 201;
    };
    const r = await enviarChamada({ ...deps(), enviar }, senha.id);
    expect(r).toEqual({ enviados: 1, removidos: 1 });
    const envios = await db.envioPush.findMany({ orderBy: { id: 'asc' } });
    expect(envios.map((e) => e.statusHttp).sort()).toEqual([201, 410, null].sort());
    expect((await db.pushSubscription.findMany()).map((s) => s.endpoint).sort()).toEqual(
      [sub('ok').endpoint, sub('quebrada').endpoint].sort(),
    );
    expect((await db.senha.findUniqueOrThrow({ where: { id: senha.id } })).status).toBe('CHAMADA');
  });

  it('RF18-CA4: não envia se a senha não está mais CHAMADA', async () => {
    const m = await novoMotorista(c.regiao.id);
    const g = await gerarSenha(deps(), {
      motoristaId: m.id,
      galpaoId: c.galpao.id,
      placa: PLACA,
      leitura: dentro,
    });
    await inscrever(deps(), m.id, sub('1'));
    let chamou = false;
    await enviarChamada({ ...deps(), enviar: async () => ((chamou = true), 201) }, g.senha!.id);
    expect(chamou).toBe(false);
  });
});
