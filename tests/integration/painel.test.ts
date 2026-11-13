import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  LIMITE_EXPORTACAO,
  exportarCsv,
  filaAoVivo,
  historicoAtendimentos,
  historicoSenhas,
} from '@/server/painel';
import {
  cancelarPeloMotorista,
  chamarSenha,
  concluirSenha,
  confirmarChegada,
  gerarSenha,
} from '@/server/senhas';
import { PLACA, cenario, db, dentro, limpar, novoMotorista, novoRelogio } from './helpers';

const MIN = 60_000;
let c: Awaited<ReturnType<typeof cenario>>;
let clock: ReturnType<typeof novoRelogio>;
const deps = () => ({ db, clock, horaVirada: '00:00' });
const HOJE = '2026-11-11';

beforeEach(async () => {
  await limpar();
  c = await cenario();
  clock = novoRelogio();
});
afterAll(() => db.$disconnect());

async function gerar(nome = 'M', galpaoId = c.galpao.id, regiaoId = c.regiao.id) {
  const m = await novoMotorista(regiaoId, nome);
  const r = await gerarSenha(deps(), {
    motoristaId: m.id,
    galpaoId,
    placa: PLACA,
    leitura: dentro,
  });
  clock.avancar(MIN);
  return { m, senha: r.senha! };
}
const motorista = (id: number) => ({ tipo: 'MOTORISTA' as const, motoristaId: id });

async function atender(nome = 'M') {
  const { m, senha } = await gerar(nome);
  await chamarSenha(deps(), { senhaId: senha.id, adminId: c.admin.id });
  await confirmarChegada(deps(), { senhaId: senha.id, por: motorista(m.id) });
  return { m, senha };
}

async function segundaBancada() {
  const regiao = await db.regiao.create({ data: { codigo: '320', nome: 'Zona Leste' } });
  const bancada = await db.bancada.create({ data: { galpaoId: c.galpao.id, identificacao: '08' } });
  await db.regiaoBancada.create({
    data: { galpaoId: c.galpao.id, regiaoId: regiao.id, bancadaId: bancada.id },
  });
  return { regiao, bancada };
}

describe('Fila ao Vivo', () => {
  it('RF17-CA1: KPIs de aguardando, em atendimento (chamada + atendimento) e tempo médio na fila', async () => {
    const outra = await segundaBancada();
    await gerar('A'); // fica aguardando
    const ch = await gerar('B', c.galpao.id, outra.regiao.id);
    clock.avancar(9 * MIN);
    await chamarSenha(deps(), { senhaId: ch.senha.id, adminId: c.admin.id });
    const f = await filaAoVivo(deps());
    expect(f.kpis.aguardando).toBe(1);
    expect(f.kpis.emAtendimento).toBe(1);
    expect(f.kpis.tempoMedioFilaMin).toBe(10); // gerada → chamada
  });

  it('RF17-CA2: mostra todas as ativas, sem período, e tira a CHAMADA vencida', async () => {
    const velha = await gerar('Ontem');
    await db.senha.update({ where: { id: velha.senha.id }, data: { dia: '2026-11-10' } });
    const vencida = await gerar('Vencida', c.galpao.id, (await segundaBancada()).regiao.id);
    await chamarSenha(deps(), { senhaId: vencida.senha.id, adminId: c.admin.id });
    clock.avancar(6 * MIN);
    const f = await filaAoVivo(deps());
    expect(f.linhas.map((l) => l.id)).toEqual([velha.senha.id]);
    expect(f.linhas[0].diaAnterior).toBe('2026-11-10');
  });

  it('RF17-CA3 / RF17-CA4: posição na bancada e tempo desde a geração ou a chamada', async () => {
    const a = await gerar('A');
    await gerar('B');
    clock.avancar(3 * MIN);
    await chamarSenha(deps(), { senhaId: a.senha.id, adminId: c.admin.id });
    clock.avancar(2 * MIN);
    const f = await filaAoVivo(deps());
    const [chamada, aguardando] = f.linhas;
    expect(chamada).toMatchObject({ status: 'CHAMADA', posicao: null, tempoMin: 2, bancada: '07' });
    expect(aguardando).toMatchObject({ status: 'AGUARDANDO', posicao: 1, tempoMin: 6 });
    expect(chamada.prazoEm).not.toBeNull();
  });

  it('RF17-CA6: ordena por galpão, bancada, status (atendimento, chamada, aguardando) e posição', async () => {
    const outra = await segundaBancada();
    const b08 = await gerar('B08', c.galpao.id, outra.regiao.id);
    const p1 = await gerar('P1');
    const p2 = await gerar('P2');
    const p3 = await gerar('P3');
    await chamarSenha(deps(), { senhaId: p1.senha.id, adminId: c.admin.id });
    const f = await filaAoVivo(deps());
    expect(f.linhas.map((l) => l.id)).toEqual([
      p1.senha.id,
      p2.senha.id,
      p3.senha.id,
      b08.senha.id,
    ]);
  });

  it('RF17-CA7: filtra por nome, CPF, nº da senha, galpão e bancada', async () => {
    const outra = await segundaBancada();
    const joao = await gerar('João');
    const maria = await gerar('Maria', c.galpao.id, outra.regiao.id);
    expect((await filaAoVivo(deps(), { motorista: 'joão' })).linhas.map((l) => l.id)).toEqual([
      joao.senha.id,
    ]);
    expect(
      (await filaAoVivo(deps(), { motorista: maria.m.cpf.slice(-4) })).linhas.map((l) => l.id),
    ).toEqual([maria.senha.id]);
    expect(
      (await filaAoVivo(deps(), { codigo: maria.senha.codigo.toLowerCase() })).linhas,
    ).toHaveLength(1);
    expect(
      (await filaAoVivo(deps(), { bancadaId: outra.bancada.id })).linhas.map((l) => l.id),
    ).toEqual([maria.senha.id]);
    expect((await filaAoVivo(deps(), { galpaoId: c.galpao.id })).linhas).toHaveLength(2);
  });

  it('RF17-CA1: KPIs seguem galpão e bancada, mas não motorista nem nº da senha', async () => {
    await gerar('João');
    await gerar('Maria');
    const f = await filaAoVivo(deps(), { motorista: 'joão' });
    expect(f.linhas).toHaveLength(1);
    expect(f.kpis.aguardando).toBe(2);
  });

  it('RF17-CA9: sem senhas ativas a lista vem vazia', async () => {
    expect((await filaAoVivo(deps())).linhas).toEqual([]);
  });

  it('RF18-CA6: marca as aguardando cuja bancada está ocupada', async () => {
    const a = await gerar('A');
    await gerar('B');
    await chamarSenha(deps(), { senhaId: a.senha.id, adminId: c.admin.id });
    const f = await filaAoVivo(deps());
    expect(f.linhas.find((l) => l.status === 'AGUARDANDO')!.bancadaOcupada).toBe(true);
    expect(f.linhas.find((l) => l.status === 'CHAMADA')!.bancadaOcupada).toBe(false);
  });
});

describe('Histórico de Atendimentos', () => {
  it('RF20-CA1: lista concluídas e canceladas com tempo total ("—" nas canceladas)', async () => {
    const { m, senha } = await atender('Concluiu');
    clock.avancar(20 * MIN);
    await concluirSenha(deps(), { senhaId: senha.id, por: motorista(m.id) });
    const canc = await gerar('Cancelou');
    await cancelarPeloMotorista(deps(), { senhaId: canc.senha.id, motoristaId: canc.m.id });
    await gerar('Aguardando'); // ativa: não entra
    const h = await historicoAtendimentos(deps(), { diaInicio: HOJE, diaFim: HOJE });
    expect(h.linhas.map((l) => [l.motorista.split(' ')[0], l.status, l.totalMin])).toEqual([
      ['Cancelou', 'CANCELADA', null],
      ['Concluiu', 'CONCLUIDA', 21],
    ]);
  });

  it('RF20-CA2: KPIs de concluídos e cancelados hoje e tempo médio sem as do SISTEMA', async () => {
    const a = await atender('A');
    clock.avancar(10 * MIN);
    await concluirSenha(deps(), { senhaId: a.senha.id, por: motorista(a.m.id) });
    const b = await atender('B');
    await db.senha.update({
      where: { id: b.senha.id },
      data: {
        status: 'CONCLUIDA',
        concluidaPor: 'SISTEMA',
        concluidaEm: new Date(clock.agora().getTime() + 600 * MIN),
      },
    });
    const h = await historicoAtendimentos(deps(), { diaInicio: HOJE, diaFim: HOJE });
    expect(h.kpis).toEqual({ concluidosHoje: 2, canceladosHoje: 0, tempoMedioMin: 11 });
  });

  it('RF20-CA3: o período é inclusivo nos dois extremos', async () => {
    const s = await gerar();
    await cancelarPeloMotorista(deps(), { senhaId: s.senha.id, motoristaId: s.m.id });
    expect((await historicoAtendimentos(deps(), { diaInicio: HOJE, diaFim: HOJE })).total).toBe(1);
    expect(
      (await historicoAtendimentos(deps(), { diaInicio: '2026-11-12', diaFim: '2026-11-20' }))
        .total,
    ).toBe(0);
  });

  it('RF20-CA4: pagina em 50 linhas, das mais recentes para as mais antigas', async () => {
    const m = await novoMotorista(c.regiao.id);
    await db.senha.createMany({
      data: Array.from({ length: 55 }, (_, i) => ({
        codigo: `A-${String(i + 1).padStart(3, '0')}`,
        dia: HOJE,
        motoristaId: m.id,
        galpaoId: c.galpao.id,
        bancadaId: c.bancada.id,
        placa: PLACA,
        motoristaNome: m.nome,
        galpaoNome: 'F SDR',
        galpaoEndereco: 'x',
        bancadaIdentificacao: '07',
        regiaoCodigo: '500',
        regiaoNome: 'Centro',
        status: 'CANCELADA' as const,
        motivoCancelamento: 'MOTORISTA' as const,
        geradaEm: new Date(clock.agora().getTime() + i * 1000),
      })),
    });
    const p1 = await historicoAtendimentos(deps(), { diaInicio: HOJE, diaFim: HOJE });
    const p2 = await historicoAtendimentos(deps(), { diaInicio: HOJE, diaFim: HOJE, pagina: 2 });
    expect([p1.total, p1.paginas, p1.linhas.length, p2.linhas.length]).toEqual([55, 2, 50, 5]);
    expect(p1.linhas[0].codigo).toBe('A-055');
  });
});

describe('Histórico de Senhas', () => {
  it('RF21-CA1 / RF21-CA2: rótulos Aguardando, Atendendo, Atendida e Cancelada e os KPIs', async () => {
    await gerar('Aguardando');
    // uma bancada atende um por vez: conclui a "Atendida" antes de chamar a "Atendendo"
    const fim = await atender('Atendida');
    await concluirSenha(deps(), { senhaId: fim.senha.id, por: motorista(fim.m.id) });
    await atender('Atendendo');
    const ca = await gerar('Cancelada');
    await cancelarPeloMotorista(deps(), { senhaId: ca.senha.id, motoristaId: ca.m.id });

    const h = await historicoSenhas(deps(), { diaInicio: HOJE, diaFim: HOJE });
    const porNome = Object.fromEntries(h.linhas.map((l) => [l.motorista.split(' ')[0], l.status]));
    expect(porNome).toMatchObject({
      Aguardando: 'Aguardando',
      Atendida: 'Atendida',
      Cancelada: 'Cancelada',
    });
    expect(porNome.Atendendo).toBe('Atendendo');
    expect(h.kpis).toEqual({ geradasHoje: 4, atendidasHoje: 1, aguardando: 1, canceladasHoje: 1 });
    expect(h.linhas[0].rota).toBe('500 · Centro de Santo André');
  });

  it('RF21-CA3: a quinzena é um filtro de dia inclusivo, com paginação', async () => {
    await gerar();
    const h = await historicoSenhas(deps(), { diaInicio: '2026-11-01', diaFim: '2026-11-15' });
    expect([h.total, h.pagina, h.paginas]).toEqual([1, 1, 1]);
  });
});

describe('Exportar CSV', () => {
  it('RF22-CA2: exporta todas as linhas do filtro (todas as páginas), sem a coluna de botões', async () => {
    const m = await novoMotorista(c.regiao.id);
    await db.senha.createMany({
      data: Array.from({ length: 60 }, (_, i) => ({
        codigo: `A-${String(i + 1).padStart(3, '0')}`,
        dia: HOJE,
        motoristaId: m.id,
        galpaoId: c.galpao.id,
        bancadaId: c.bancada.id,
        placa: PLACA,
        motoristaNome: m.nome,
        galpaoNome: 'F SDR',
        galpaoEndereco: 'x',
        bancadaIdentificacao: '07',
        regiaoCodigo: '500',
        regiaoNome: 'Centro',
        status: 'CANCELADA' as const,
        geradaEm: clock.agora(),
      })),
    });
    const r = await exportarCsv(deps(), 'senhas', { diaInicio: HOJE, diaFim: HOJE });
    if (!r.ok) throw new Error('falhou');
    const linhas = r.csv.trim().split('\r\n');
    expect(linhas).toHaveLength(61);
    expect(r.csv.startsWith('﻿')).toBe(true); // .trim() remove o BOM, então checa antes
    expect(linhas[0]).toBe('Senha;Data/Hora;Motorista;Galpão;Rota;Status');
    expect(r.nomeArquivo).toBe('senhas_2026-11-11_1200.csv');

    await gerar('Na fila');
    const fila = await exportarCsv(deps(), 'fila-ao-vivo', {});
    if (!fila.ok) throw new Error('falhou');
    expect(fila.csv).not.toMatch(/Status de chamado|Chamar/);
  });

  it(`RF22-CA2: acima de ${LIMITE_EXPORTACAO} linhas pede para refinar o período`, async () => {
    const m = await novoMotorista(c.regiao.id);
    const base = {
      dia: HOJE,
      motoristaId: m.id,
      galpaoId: c.galpao.id,
      bancadaId: c.bancada.id,
      placa: PLACA,
      motoristaNome: m.nome,
      galpaoNome: 'F SDR',
      galpaoEndereco: 'x',
      bancadaIdentificacao: '07',
      regiaoCodigo: '500',
      regiaoNome: 'Centro',
      status: 'CANCELADA' as const,
    };
    await db.senha.createMany({
      data: Array.from({ length: LIMITE_EXPORTACAO + 1 }, (_, i) => ({
        ...base,
        codigo: `A-${i}`,
      })),
    });
    expect(await exportarCsv(deps(), 'senhas', { diaInicio: HOJE, diaFim: HOJE })).toEqual({
      ok: false,
      erro: 'MUITAS_LINHAS',
    });
  });

  it('RF22-CA5: o CPF nunca sai no CSV', async () => {
    const { m } = await gerar('João');
    for (const tela of ['fila-ao-vivo', 'senhas', 'atendimentos'] as const) {
      const r = await exportarCsv(deps(), tela, { diaInicio: HOJE, diaFim: HOJE });
      if (!r.ok) throw new Error('falhou');
      expect(r.csv).not.toContain(m.cpf);
    }
  });
});
