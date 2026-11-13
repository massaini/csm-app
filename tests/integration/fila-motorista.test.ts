import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  estadoDoMotorista,
  historicoDoMotorista,
  marcarResultadoVisto,
} from '@/server/fila-motorista';
import {
  cancelarPeloMotorista,
  chamarSenha,
  concluirSenha,
  confirmarChegada,
  gerarSenha,
  varrer,
} from '@/server/senhas';
import { PLACA, cenario, db, dentro, limpar, novoMotorista, novoRelogio } from './helpers';

const MIN = 60_000;
let c: Awaited<ReturnType<typeof cenario>>;
let clock: ReturnType<typeof novoRelogio>;
const deps = () => ({ db, clock, horaVirada: '00:00' });

beforeEach(async () => {
  await limpar();
  c = await cenario();
  clock = novoRelogio();
});
afterAll(() => db.$disconnect());

async function gerar(motoristaId: number) {
  const r = await gerarSenha(deps(), {
    motoristaId,
    galpaoId: c.galpao.id,
    placa: PLACA,
    leitura: dentro,
  });
  clock.avancar(1000);
  return r.senha!;
}
const estado = (id: number) => estadoDoMotorista(deps(), id);
const comoMotorista = (id: number) => ({ tipo: 'MOTORISTA' as const, motoristaId: id });

describe('roteamento de /fila', () => {
  it('RF07-CA3: sem senha mostra Gerar senha, com a lista de galpões', async () => {
    const m = await novoMotorista(c.regiao.id);
    const e = await estado(m.id);
    expect(e.tela).toBe('GERAR');
    if (e.tela !== 'GERAR') return;
    expect(e.galpoes).toHaveLength(1);
    expect(e.galpoes[0]).toMatchObject({ nome: 'F SDR', habilitado: true });
  });

  it('RF07-CA1: senha ativa mostra a tela do status (aguardando, chamado, em atendimento)', async () => {
    const m = await novoMotorista(c.regiao.id);
    const s = await gerar(m.id);
    expect((await estado(m.id)).tela).toBe('AGUARDANDO');
    await chamarSenha(deps(), { senhaId: s.id, adminId: c.admin.id });
    expect((await estado(m.id)).tela).toBe('CHAMADA');
    await confirmarChegada(deps(), { senhaId: s.id, por: comoMotorista(m.id) });
    expect((await estado(m.id)).tela).toBe('EM_ATENDIMENTO');
  });

  it('RF07-CA1: CHAMADA vencida aparece como "perdeu a vez" mesmo antes da varredura', async () => {
    const m = await novoMotorista(c.regiao.id);
    const s = await gerar(m.id);
    await chamarSenha(deps(), { senhaId: s.id, adminId: c.admin.id });
    clock.avancar(6 * MIN);
    const e = await estado(m.id);
    expect(e).toMatchObject({ tela: 'RESULTADO', resultado: 'EXPIRADA' });
    expect((await db.senha.findUniqueOrThrow({ where: { id: s.id } })).status).toBe('CHAMADA'); // leitura não grava
  });

  it('RF07-CA2: concluída mostra o resumo; encerrada pelo sistema e fim do dia têm telas próprias', async () => {
    const m = await novoMotorista(c.regiao.id);
    const s = await gerar(m.id);
    await chamarSenha(deps(), { senhaId: s.id, adminId: c.admin.id });
    await confirmarChegada(deps(), { senhaId: s.id, por: comoMotorista(m.id) });
    clock.avancar(20 * MIN);
    await concluirSenha(deps(), { senhaId: s.id, por: comoMotorista(m.id) });
    expect(await estado(m.id)).toMatchObject({ tela: 'RESULTADO', resultado: 'CONCLUIDA' });

    const m2 = await novoMotorista(c.regiao.id);
    await gerar(m2.id);
    clock.avancar(24 * 60 * MIN);
    await varrer(deps());
    expect(await estado(m2.id)).toMatchObject({ tela: 'RESULTADO', resultado: 'FIM_DO_DIA' });
  });

  it('RF07-CA2: cancelamento pelo próprio motorista não tem tela de resultado', async () => {
    const m = await novoMotorista(c.regiao.id);
    const s = await gerar(m.id);
    await cancelarPeloMotorista(deps(), { senhaId: s.id, motoristaId: m.id });
    expect((await estado(m.id)).tela).toBe('GERAR');
  });

  it('RF07-CA4: o botão do resultado persiste a expiração e grava resultadoVistoEm', async () => {
    const m = await novoMotorista(c.regiao.id);
    const s = await gerar(m.id);
    await chamarSenha(deps(), { senhaId: s.id, adminId: c.admin.id });
    clock.avancar(6 * MIN);
    await marcarResultadoVisto(deps(), m.id);
    const lida = await db.senha.findUniqueOrThrow({ where: { id: s.id } });
    expect(lida).toMatchObject({ status: 'CANCELADA', motivoCancelamento: 'EXPIRADA' });
    expect(lida.resultadoVistoEm).not.toBeNull();
    expect((await estado(m.id)).tela).toBe('GERAR');
  });

  it('RF07-CA4: não marca como vista uma senha que ainda está ativa', async () => {
    const m = await novoMotorista(c.regiao.id);
    const s = await gerar(m.id);
    await marcarResultadoVisto(deps(), m.id);
    expect((await db.senha.findUniqueOrThrow({ where: { id: s.id } })).resultadoVistoEm).toBeNull();
  });
});

describe('tela Gerar senha', () => {
  it('RF08-CA2: devolve a última placa e o último galpão usados', async () => {
    const m = await novoMotorista(c.regiao.id);
    const s = await gerar(m.id);
    await cancelarPeloMotorista(deps(), { senhaId: s.id, motoristaId: m.id });
    const e = await estado(m.id);
    expect(e).toMatchObject({
      tela: 'GERAR',
      ultimaPlaca: 'ABC-1D23',
      ultimoGalpaoId: c.galpao.id,
    });
  });

  it('RF08-CA3: galpão sem bancada para a região, ou com bancada inativa, vem desabilitado', async () => {
    const outro = await db.galpao.create({
      data: { nome: 'DS AET', endereco: 'x', prefixoSenha: 'C', localId: c.local.id },
    });
    const m = await novoMotorista(c.regiao.id);
    let e = await estado(m.id);
    if (e.tela !== 'GERAR') throw new Error('tela errada');
    expect(e.galpoes.find((g) => g.id === outro.id)).toMatchObject({
      habilitado: false,
      textoFila: null,
    });

    await db.bancada.update({ where: { id: c.bancada.id }, data: { ativa: false } });
    e = await estado(m.id);
    if (e.tela !== 'GERAR') throw new Error('tela errada');
    expect(e.galpoes.every((g) => !g.habilitado)).toBe(true); // RF08-CA4 decide a mensagem na tela
  });

  it('RF08-CA4: sem nenhum galpão habilitado a tela recebe todos desabilitados', async () => {
    const outra = await db.regiao.create({ data: { codigo: '999', nome: 'Sem bancada' } });
    const m = await novoMotorista(outra.id);
    const e = await estado(m.id);
    if (e.tela !== 'GERAR') throw new Error('tela errada');
    expect(e.galpoes.some((g) => g.habilitado)).toBe(false);
  });

  it('RF08-CA5: "Fila estimada agora" usa as senhas aguardando na bancada × média do dia', async () => {
    const a = await novoMotorista(c.regiao.id);
    const b = await novoMotorista(c.regiao.id);
    await gerar(a.id);
    await gerar(b.id);
    const m = await novoMotorista(c.regiao.id);
    const e = await estado(m.id);
    if (e.tela !== 'GERAR') throw new Error('tela errada');
    expect(e.galpoes[0].textoFila).toBe('2 motoristas · ~30 min de espera'); // padrão 15 min
  });

  it('RF09-CA5: informa quando há liberação manual válida', async () => {
    const m = await novoMotorista(c.regiao.id);
    await db.liberacaoGeofence.create({
      data: {
        motoristaId: m.id,
        adminId: c.admin.id,
        expiraEm: new Date(clock.agora().getTime() + 60 * MIN),
      },
    });
    expect(await estado(m.id)).toMatchObject({ tela: 'GERAR', liberado: true });
  });
});

describe('Aguardando, Chamado e Em atendimento', () => {
  it('RF11-CA1: posição e tempo estimado pela fila da bancada', async () => {
    const primeiro = await novoMotorista(c.regiao.id);
    const segundo = await novoMotorista(c.regiao.id);
    const terceiro = await novoMotorista(c.regiao.id);
    await gerar(primeiro.id);
    await gerar(segundo.id);
    await gerar(terceiro.id);
    expect(await estado(primeiro.id)).toMatchObject({
      tela: 'AGUARDANDO',
      posicao: 1,
      textoTempo: 'Você é o próximo',
      textoProximidade: 'Sua vez está próxima',
    });
    expect(await estado(terceiro.id)).toMatchObject({
      posicao: 3,
      textoTempo: '~30 min',
      textoProximidade: 'Acompanhe sua posição',
    });
  });

  it('RF13-CA1 / RF13-CA7: a tela Chamado recebe prazo, limite com carência e a tolerância gravada', async () => {
    const m = await novoMotorista(c.regiao.id);
    const s = await gerar(m.id);
    const ch = await chamarSenha(deps(), { senhaId: s.id, adminId: c.admin.id });
    await db.configuracao.update({ where: { id: 1 }, data: { toleranciaMin: 20 } });
    const e = await estado(m.id);
    if (e.tela !== 'CHAMADA') throw new Error('tela errada');
    expect(e.prazoEm).toBe(ch.senha!.prazoEm!.toISOString());
    expect(new Date(e.limiteEm).getTime() - new Date(e.prazoEm).getTime()).toBe(30_000);
    expect(e.toleranciaMin).toBe(5); // RF13-CA7: a gravada na chamada, não a atual
    expect(e.agora).toBe(clock.agora().toISOString());
  });

  it('RF14-CA1: Em atendimento mostra o conferente (admin que chamou) e o início', async () => {
    const m = await novoMotorista(c.regiao.id);
    const s = await gerar(m.id);
    await chamarSenha(deps(), { senhaId: s.id, adminId: c.admin.id });
    await confirmarChegada(deps(), { senhaId: s.id, por: comoMotorista(m.id) });
    const e = await estado(m.id);
    expect(e).toMatchObject({ tela: 'EM_ATENDIMENTO', conferente: 'Marcos T.' });
    if (e.tela === 'EM_ATENDIMENTO')
      expect(e.senha).toMatchObject({ bancada: '07', placa: 'ABC-1D23' });
  });

  it('RF14-CA4: o resumo traz espera, carregamento e total', async () => {
    const m = await novoMotorista(c.regiao.id);
    const s = await gerar(m.id);
    clock.avancar(17 * MIN);
    await chamarSenha(deps(), { senhaId: s.id, adminId: c.admin.id });
    await confirmarChegada(deps(), { senhaId: s.id, por: comoMotorista(m.id) });
    clock.avancar(22 * MIN);
    await concluirSenha(deps(), { senhaId: s.id, por: comoMotorista(m.id) });
    const e = await estado(m.id);
    expect(e).toMatchObject({
      tela: 'RESULTADO',
      tempos: { esperaMin: 17, carregamentoMin: 22, totalMin: 39 },
    });
  });
});

describe('histórico do motorista', () => {
  it('RF15-CA1: lista concluídas e canceladas dos últimos 90 dias, mais recentes primeiro', async () => {
    const m = await novoMotorista(c.regiao.id);
    const s1 = await gerar(m.id);
    await cancelarPeloMotorista(deps(), { senhaId: s1.id, motoristaId: m.id });
    const s2 = await gerar(m.id);
    await chamarSenha(deps(), { senhaId: s2.id, adminId: c.admin.id });
    await confirmarChegada(deps(), { senhaId: s2.id, por: comoMotorista(m.id) });
    await concluirSenha(deps(), { senhaId: s2.id, por: comoMotorista(m.id) });
    await gerar(m.id); // ativa: não entra
    const h = await historicoDoMotorista(deps(), m.id);
    expect(h.itens.map((i) => i.id)).toEqual([s2.id, s1.id]);
    expect(h.itens[1]).toMatchObject({ status: 'CANCELADA', totalMin: null });
  });

  it('RF15-CA1: senhas com mais de 90 dias ficam de fora', async () => {
    const m = await novoMotorista(c.regiao.id);
    const s = await gerar(m.id);
    await cancelarPeloMotorista(deps(), { senhaId: s.id, motoristaId: m.id });
    clock.avancar(91 * 24 * 60 * MIN);
    expect((await historicoDoMotorista(deps(), m.id)).itens).toHaveLength(0);
  });

  it('RF15-CA2: cards de atendimentos e espera média no mesmo período', async () => {
    const m = await novoMotorista(c.regiao.id);
    const s = await gerar(m.id);
    clock.avancar(10 * MIN);
    await chamarSenha(deps(), { senhaId: s.id, adminId: c.admin.id });
    await confirmarChegada(deps(), { senhaId: s.id, por: comoMotorista(m.id) });
    await concluirSenha(deps(), { senhaId: s.id, por: comoMotorista(m.id) });
    const h = await historicoDoMotorista(deps(), m.id);
    expect(h).toMatchObject({ atendimentos: 1, esperaMediaMin: 10 });
  });
});
