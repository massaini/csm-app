import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  cancelarPeloMotorista,
  chamarSenha,
  concluirSenha,
  confirmarChegada,
  gerarSenha,
  varrer,
} from '@/server/senhas';
import {
  LONGE,
  PLACA,
  T0,
  cenario,
  db,
  dentro,
  limpar,
  novoMotorista,
  novoRelogio,
} from './helpers';

const MIN = 60_000;
let c: Awaited<ReturnType<typeof cenario>>;
let clock: ReturnType<typeof novoRelogio>;
const deps = () => ({ db, clock, horaVirada: '00:00' });

async function gerar(
  motoristaId: number,
  leitura: Parameters<typeof gerarSenha>[1]['leitura'] = dentro,
) {
  return gerarSenha(deps(), { motoristaId, galpaoId: c.galpao.id, placa: PLACA, leitura });
}

beforeEach(async () => {
  await limpar();
  c = await cenario();
  clock = novoRelogio();
});
afterAll(() => db.$disconnect());

describe('gerar senha', () => {
  it('RF10-CA1: cria AGUARDANDO na bancada mapeada, com código, dia e snapshot', async () => {
    const m = await novoMotorista(c.regiao.id, 'João');
    const r = await gerar(m.id);
    expect(r).toMatchObject({ ok: true, codigo: 'OK' });
    expect(r.senha).toMatchObject({
      status: 'AGUARDANDO',
      codigo: 'A-001',
      dia: '2026-11-11',
      bancadaId: c.bancada.id,
      placa: 'ABC1D23',
      motoristaNome: m.nome,
      galpaoNome: 'F SDR',
      bancadaIdentificacao: '07',
      regiaoCodigo: '500',
      regiaoNome: 'Centro de Santo André',
    });
  });

  it('RF10-CA1: editar cadastros depois não altera o snapshot da senha', async () => {
    const m = await novoMotorista(c.regiao.id);
    const r = await gerar(m.id);
    await db.bancada.update({ where: { id: c.bancada.id }, data: { identificacao: '99' } });
    await db.regiao.update({ where: { id: c.regiao.id }, data: { nome: 'Outro nome' } });
    const lida = await db.senha.findUniqueOrThrow({ where: { id: r.senha!.id } });
    expect(lida.bancadaIdentificacao).toBe('07');
    expect(lida.regiaoNome).toBe('Centro de Santo André');
  });

  it('RF10-CA2: requisições simultâneas do mesmo motorista criam uma única senha ativa', async () => {
    const m = await novoMotorista(c.regiao.id);
    const rs = await Promise.all(Array.from({ length: 5 }, () => gerar(m.id)));
    expect(rs.filter((r) => r.ok)).toHaveLength(1);
    expect(rs.filter((r) => r.codigo === 'CONFLITO')).toHaveLength(4);
    expect(await db.senha.count({ where: { motoristaId: m.id } })).toBe(1);
  });

  it('RF10-CA3: 20 gerações simultâneas no mesmo galpão dão 20 códigos distintos e sequenciais', async () => {
    const motoristas = await Promise.all(
      Array.from({ length: 20 }, () => novoMotorista(c.regiao.id)),
    );
    const rs = await Promise.all(motoristas.map((m) => gerar(m.id)));
    expect(rs.every((r) => r.ok)).toBe(true);
    const codigos = rs.map((r) => r.senha!.codigo).sort();
    expect(new Set(codigos).size).toBe(20);
    expect(codigos[0]).toBe('A-001');
    expect(codigos[19]).toBe('A-020');
  });

  it('RF10-CA3: o contador reinicia no dia operacional seguinte', async () => {
    const a = await novoMotorista(c.regiao.id);
    const b = await novoMotorista(c.regiao.id);
    expect((await gerar(a.id)).senha!.codigo).toBe('A-001');
    clock.avancar(24 * 60 * MIN);
    expect((await gerar(b.id)).senha!.codigo).toBe('A-001');
  });

  it('RF10-CA4: a liberação usada é marcada e não serve para uma segunda senha', async () => {
    const m = await novoMotorista(c.regiao.id);
    await db.liberacaoGeofence.create({
      data: {
        motoristaId: m.id,
        adminId: c.admin.id,
        expiraEm: new Date(T0.getTime() + 8 * 60 * MIN),
      },
    });
    const r1 = await gerar(m.id, null);
    expect(r1).toMatchObject({ ok: true });
    expect(r1.senha).toMatchObject({ lat: null, lng: null, distanciaM: null });
    expect(r1.senha!.liberacaoId).not.toBeNull();
    const lib = await db.liberacaoGeofence.findFirstOrThrow();
    expect(lib.usadaEm).not.toBeNull();

    await db.senha.update({
      where: { id: r1.senha!.id },
      data: { status: 'CANCELADA', motivoCancelamento: 'MOTORISTA' },
    });
    expect((await gerar(m.id, null)).codigo).toBe('FORA_DO_RAIO');
  });

  it('RF10-CA5: atualiza a última placa e o último galpão', async () => {
    const m = await novoMotorista(c.regiao.id);
    await gerar(m.id);
    const lido = await db.motorista.findUniqueOrThrow({ where: { id: m.id } });
    expect(lido).toMatchObject({ ultimaPlaca: 'ABC1D23', ultimoGalpaoId: c.galpao.id });
  });

  it('RF10-CA6: com CHAMADA expirada e não varrida, gerar nova senha funciona e persiste a expiração', async () => {
    const m = await novoMotorista(c.regiao.id);
    const r1 = await gerar(m.id);
    await chamarSenha(deps(), { senhaId: r1.senha!.id, adminId: c.admin.id });
    clock.avancar(6 * MIN); // tolerância 5 min + carência 30 s já passaram
    const r2 = await gerar(m.id);
    expect(r2).toMatchObject({ ok: true, codigo: 'OK' });
    const antiga = await db.senha.findUniqueOrThrow({ where: { id: r1.senha!.id } });
    expect(antiga).toMatchObject({ status: 'CANCELADA', motivoCancelamento: 'EXPIRADA' });
  });

  it('RF10-CA7: rejeita galpão sem mapeamento para a região ou com bancada inativa', async () => {
    const outra = await db.regiao.create({ data: { codigo: '320', nome: 'Zona Leste' } });
    const sem = await novoMotorista(outra.id);
    expect((await gerar(sem.id)).codigo).toBe('SEM_BANCADA');

    await db.bancada.update({ where: { id: c.bancada.id }, data: { ativa: false } });
    const m = await novoMotorista(c.regiao.id);
    expect((await gerar(m.id)).codigo).toBe('SEM_BANCADA');
  });

  it('RF09-CA7: fora do raio e sem liberação o servidor recusa, mesmo com requisição forjada', async () => {
    const m = await novoMotorista(c.regiao.id);
    expect((await gerar(m.id, { ...LONGE, precisaoM: 10 })).codigo).toBe('FORA_DO_RAIO');
    expect((await gerar(m.id, null)).codigo).toBe('FORA_DO_RAIO');
    expect(await db.senha.count()).toBe(0);
  });

  it('RF09-CA8: grava latitude, longitude, precisão e distância na senha', async () => {
    const m = await novoMotorista(c.regiao.id);
    const r = await gerar(m.id, { ...dentro, precisaoM: 12 });
    expect(r.senha).toMatchObject({ lat: dentro.lat, lng: dentro.lng, precisaoM: 12 });
    expect(r.senha!.distanciaM).toBeCloseTo(0, 3);
  });
});

async function senhaAguardando(nome = 'M') {
  const m = await novoMotorista(c.regiao.id, nome);
  const r = await gerar(m.id);
  clock.avancar(1000); // garante geradaEm distintos para a ordem FIFO
  return { m, senha: r.senha! };
}

describe('chamar', () => {
  it('RF18-CA1: grava chamadaEm, admin e prazoEm (chamadaEm + tolerância) e audita', async () => {
    const { senha } = await senhaAguardando();
    const r = await chamarSenha(deps(), { senhaId: senha.id, adminId: c.admin.id });
    expect(r.ok).toBe(true);
    expect(r.senha).toMatchObject({
      status: 'CHAMADA',
      chamadaPorAdminId: c.admin.id,
      foraDeOrdem: false,
    });
    expect(r.senha!.prazoEm!.getTime() - r.senha!.chamadaEm!.getTime()).toBe(5 * MIN);
    expect(await db.auditoria.count({ where: { acao: 'senha.chamar' } })).toBe(1);
  });

  it('RF18-CA2: chamar quem não é o 1º da bancada marca foraDeOrdem', async () => {
    await senhaAguardando('Primeiro');
    const segundo = await senhaAguardando('Segundo');
    const r = await chamarSenha(deps(), { senhaId: segundo.senha.id, adminId: c.admin.id });
    expect(r.ok).toBe(true);
    expect(r.senha!.foraDeOrdem).toBe(true);
  });

  it('RF18-CA3: dois admins chamando a mesma senha: só um vale', async () => {
    const { senha } = await senhaAguardando();
    const outro = await db.admin.create({
      data: { nome: 'Outro', cpf: '11144477735', senhaHash: 'x' },
    });
    const rs = await Promise.all([
      chamarSenha(deps(), { senhaId: senha.id, adminId: c.admin.id }),
      chamarSenha(deps(), { senhaId: senha.id, adminId: outro.id }),
    ]);
    expect(rs.filter((r) => r.ok)).toHaveLength(1);
    expect(rs.filter((r) => r.codigo === 'CONFLITO')).toHaveLength(1);
    expect(await db.auditoria.count({ where: { acao: 'senha.chamar' } })).toBe(1);
  });

  it('RF18-CA6: a bancada atende um por vez: chamar para bancada ocupada dá CONFLITO', async () => {
    const a = await senhaAguardando('A');
    const b = await senhaAguardando('B');
    expect((await chamarSenha(deps(), { senhaId: a.senha.id, adminId: c.admin.id })).ok).toBe(true);
    const r = await chamarSenha(deps(), { senhaId: b.senha.id, adminId: c.admin.id });
    expect(r).toMatchObject({ ok: false, codigo: 'CONFLITO' });
    expect((await db.senha.findUniqueOrThrow({ where: { id: b.senha.id } })).status).toBe(
      'AGUARDANDO',
    );
  });

  it('RF18-CA6: duas chamadas simultâneas para a mesma bancada: só uma passa', async () => {
    const a = await senhaAguardando('A');
    const b = await senhaAguardando('B');
    const rs = await Promise.all([
      chamarSenha(deps(), { senhaId: a.senha.id, adminId: c.admin.id }),
      chamarSenha(deps(), { senhaId: b.senha.id, adminId: c.admin.id }),
    ]);
    expect(rs.filter((r) => r.ok)).toHaveLength(1);
    expect(await db.senha.count({ where: { status: 'CHAMADA' } })).toBe(1);
  });

  it('RF18-CA6: uma chamada vencida libera a bancada para a próxima', async () => {
    const a = await senhaAguardando('A');
    const b = await senhaAguardando('B');
    await chamarSenha(deps(), { senhaId: a.senha.id, adminId: c.admin.id });
    clock.avancar(5 * MIN + 31_000);
    const r = await chamarSenha(deps(), { senhaId: b.senha.id, adminId: c.admin.id });
    expect(r.ok).toBe(true);
    expect(
      (await db.senha.findUniqueOrThrow({ where: { id: a.senha.id } })).motivoCancelamento,
    ).toBe('EXPIRADA');
  });
});

describe('estou a caminho / confirmar chegada / concluir', () => {
  async function chamada() {
    const { m, senha } = await senhaAguardando();
    await chamarSenha(deps(), { senhaId: senha.id, adminId: c.admin.id });
    return { m, senha };
  }
  const motorista = (m: { id: number }) => ({ tipo: 'MOTORISTA' as const, motoristaId: m.id });

  it('RF13-CA2: aceita "Estou a caminho" até prazo + carência (inclusivo)', async () => {
    const { m, senha } = await chamada();
    clock.avancar(5 * MIN + 30_000 - 1000); // exatamente prazo + carência (a chamada ocorreu 1 s após T0)
    const r = await confirmarChegada(deps(), { senhaId: senha.id, por: motorista(m) });
    expect(r.ok).toBe(true);
    expect(r.senha).toMatchObject({ status: 'EM_ATENDIMENTO', aCaminhoPor: 'MOTORISTA' });
    expect(r.senha!.aCaminhoEm).not.toBeNull();
  });

  it('RF13-CA3: depois do limite devolve CONFLITO e a senha fica EXPIRADA', async () => {
    const { m, senha } = await chamada();
    clock.avancar(5 * MIN + 31_000);
    const r = await confirmarChegada(deps(), { senhaId: senha.id, por: motorista(m) });
    expect(r).toMatchObject({ ok: false, codigo: 'CONFLITO' });
    expect(r.senha).toMatchObject({ status: 'CANCELADA', motivoCancelamento: 'EXPIRADA' });
  });

  it('RF13-CA6: mudar a tolerância não altera o prazo de chamadas já feitas', async () => {
    const { senha } = await chamada();
    const antes = (await db.senha.findUniqueOrThrow({ where: { id: senha.id } })).prazoEm!;
    await db.configuracao.update({ where: { id: 1 }, data: { toleranciaMin: 30 } });
    const depois = (await db.senha.findUniqueOrThrow({ where: { id: senha.id } })).prazoEm!;
    expect(depois.getTime()).toBe(antes.getTime());
  });

  it('RF13-CA5 / RNF01-CA2: a varredura persiste a expiração depois de prazo + carência', async () => {
    const { senha } = await chamada();
    clock.avancar(5 * MIN);
    expect((await varrer(deps())).expiradas).toBe(0); // dentro da carência
    clock.avancar(31_000);
    expect((await varrer(deps())).expiradas).toBe(1);
    expect((await db.senha.findUniqueOrThrow({ where: { id: senha.id } })).status).toBe(
      'CANCELADA',
    );
  });

  it('RF19-CA1: o admin confirma a chegada dentro do limite, gravando aCaminhoEm e quem', async () => {
    const { senha } = await chamada();
    const r = await confirmarChegada(deps(), {
      senhaId: senha.id,
      por: { tipo: 'ADMIN', adminId: c.admin.id },
    });
    expect(r.senha).toMatchObject({
      status: 'EM_ATENDIMENTO',
      aCaminhoPor: 'ADMIN',
      aCaminhoAdminId: c.admin.id,
    });
    expect(r.senha!.aCaminhoEm).not.toBeNull();
  });

  it('RF19-CA1: o admin não confirma chegada depois do prazo + carência', async () => {
    const { senha } = await chamada();
    clock.avancar(6 * MIN);
    const r = await confirmarChegada(deps(), {
      senhaId: senha.id,
      por: { tipo: 'ADMIN', adminId: c.admin.id },
    });
    expect(r).toMatchObject({ ok: false, codigo: 'CONFLITO' });
  });

  it('RF19-CA2: o admin conclui; o motorista também pode concluir', async () => {
    const { m, senha } = await chamada();
    await confirmarChegada(deps(), { senhaId: senha.id, por: motorista(m) });
    const r = await concluirSenha(deps(), {
      senhaId: senha.id,
      por: { tipo: 'ADMIN', adminId: c.admin.id },
    });
    expect(r.senha).toMatchObject({
      status: 'CONCLUIDA',
      concluidaPor: 'ADMIN',
      concluidaAdminId: c.admin.id,
    });

    const outra = await senhaAguardando('Outro');
    await chamarSenha(deps(), { senhaId: outra.senha.id, adminId: c.admin.id });
    await confirmarChegada(deps(), { senhaId: outra.senha.id, por: motorista(outra.m) });
    const r2 = await concluirSenha(deps(), { senhaId: outra.senha.id, por: motorista(outra.m) });
    expect(r2.senha).toMatchObject({ status: 'CONCLUIDA', concluidaPor: 'MOTORISTA' });
  });

  it('RF19-CA3 / RF30-CA3: repetir a ação sobre estado que já mudou devolve CONFLITO e não audita de novo', async () => {
    const { m, senha } = await chamada();
    await confirmarChegada(deps(), { senhaId: senha.id, por: motorista(m) });
    const de_novo = await confirmarChegada(deps(), { senhaId: senha.id, por: motorista(m) });
    expect(de_novo).toMatchObject({ ok: false, codigo: 'CONFLITO' });
    expect(de_novo.senha!.status).toBe('EM_ATENDIMENTO');
    expect(await db.auditoria.count({ where: { acao: 'senha.confirmar_chegada' } })).toBe(1);
  });

  it('RNF02-CA3: o motorista só age sobre a própria senha', async () => {
    const { senha } = await chamada();
    const estranho = await novoMotorista(c.regiao.id);
    const r = await confirmarChegada(deps(), { senhaId: senha.id, por: motorista(estranho) });
    expect(r.codigo).toBe('NAO_ENCONTRADO');
  });

  it('libera a bancada ao concluir: a próxima pode ser chamada', async () => {
    const a = await senhaAguardando('A');
    const b = await senhaAguardando('B');
    await chamarSenha(deps(), { senhaId: a.senha.id, adminId: c.admin.id });
    await confirmarChegada(deps(), { senhaId: a.senha.id, por: motorista(a.m) });
    await concluirSenha(deps(), { senhaId: a.senha.id, por: motorista(a.m) });
    expect((await chamarSenha(deps(), { senhaId: b.senha.id, adminId: c.admin.id })).ok).toBe(true);
  });
});

describe('cancelar', () => {
  it('RF12-CA2: o motorista cancela em AGUARDANDO e a tela de resultado é dispensada', async () => {
    const { m, senha } = await senhaAguardando();
    const r = await cancelarPeloMotorista(deps(), { senhaId: senha.id, motoristaId: m.id });
    expect(r.senha).toMatchObject({ status: 'CANCELADA', motivoCancelamento: 'MOTORISTA' });
    expect(r.senha!.resultadoVistoEm).not.toBeNull();
  });

  it('RF12-CA3: só aceita cancelar em AGUARDANDO', async () => {
    const { m, senha } = await senhaAguardando();
    await chamarSenha(deps(), { senhaId: senha.id, adminId: c.admin.id });
    const r = await cancelarPeloMotorista(deps(), { senhaId: senha.id, motoristaId: m.id });
    expect(r).toMatchObject({ ok: false, codigo: 'CONFLITO' });
  });
});

describe('virada do dia', () => {
  it('RF28-CA1: cancela AGUARDANDO de dia anterior e conclui pelo SISTEMA o atendimento antigo', async () => {
    const aguardando = await senhaAguardando('Aguardando');
    const atend = await senhaAguardando('Atendimento');
    // a bancada é compartilhada: coloca o 2º em outra bancada para poder ocupá-la
    const b2 = await db.bancada.create({ data: { galpaoId: c.galpao.id, identificacao: '08' } });
    await db.senha.update({ where: { id: atend.senha.id }, data: { bancadaId: b2.id } });
    await chamarSenha(deps(), { senhaId: atend.senha.id, adminId: c.admin.id });
    await confirmarChegada(deps(), {
      senhaId: atend.senha.id,
      por: { tipo: 'MOTORISTA', motoristaId: atend.m.id },
    });

    clock.avancar(13 * 60 * MIN); // 01:00 do dia seguinte (T0 = 12:00 local)
    const r = await varrer(deps());
    expect(r).toMatchObject({ canceladasNaVirada: 1, concluidasNaVirada: 1 });

    const a = await db.senha.findUniqueOrThrow({ where: { id: aguardando.senha.id } });
    expect(a).toMatchObject({ status: 'CANCELADA', motivoCancelamento: 'FIM_DO_DIA' });
    expect(a.canceladaEm!.toISOString()).toBe('2026-11-12T03:00:00.000Z');
    const s = await db.senha.findUniqueOrThrow({ where: { id: atend.senha.id } });
    expect(s).toMatchObject({ status: 'CONCLUIDA', concluidaPor: 'SISTEMA' });
    expect(s.concluidaEm!.toISOString()).toBe('2026-11-12T03:00:00.000Z');
  });

  it('RF28-CA1: atendimento iniciado depois da virada só é encerrado na virada seguinte', async () => {
    const { m, senha } = await senhaAguardando();
    await db.configuracao.update({ where: { id: 1 }, data: { toleranciaMin: 30 } });
    clock.avancar(11 * 60 * MIN + 45 * MIN); // 23:45 de 11/11 (T0 = 12:00 local)
    await chamarSenha(deps(), { senhaId: senha.id, adminId: c.admin.id });
    clock.avancar(16 * MIN); // 00:01 do dia 12
    await confirmarChegada(deps(), {
      senhaId: senha.id,
      por: { tipo: 'MOTORISTA', motoristaId: m.id },
    });
    const r = await varrer(deps());
    expect(r.concluidasNaVirada).toBe(0);
    expect((await db.senha.findUniqueOrThrow({ where: { id: senha.id } })).status).toBe(
      'EM_ATENDIMENTO',
    );
  });

  it('RF28-CA3: rodar a virada duas vezes produz o mesmo resultado', async () => {
    await senhaAguardando();
    clock.avancar(12 * 60 * MIN);
    const primeira = await varrer(deps());
    const segunda = await varrer(deps());
    expect(primeira.canceladasNaVirada).toBe(1);
    expect(segunda).toEqual({ expiradas: 0, canceladasNaVirada: 0, concluidasNaVirada: 0 });
  });

  it('RNF06-CA1: duas varreduras simultâneas geram uma única transição e uma única auditoria', async () => {
    const { senha } = await senhaAguardando();
    await chamarSenha(deps(), { senhaId: senha.id, adminId: c.admin.id });
    clock.avancar(6 * MIN);
    const [a, b] = await Promise.all([varrer(deps()), varrer(deps())]);
    expect(a.expiradas + b.expiradas).toBe(1);
    expect(await db.auditoria.count({ where: { acao: 'senha.expirar' } })).toBe(1);
  });
});
