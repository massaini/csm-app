import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { login } from '@/server/auth';
import {
  alternarBancada,
  alternarRegiao,
  criarAdmin,
  criarBancada,
  criarMotorista,
  criarRegiao,
  dadosBancadasRegioes,
  definirMapeamento,
  desativarAdmin,
  desativarMotorista,
  editarMotorista,
  lerConfiguracoes,
  liberarGeofence,
  listarMotoristas,
  reativarMotorista,
  redefinirSenhaDoMotorista,
  renomearBancada,
  salvarConfiguracoes,
  transferirSuperAdmin,
} from '@/server/cadastros';
import { gerarSenha } from '@/server/senhas';
import { PLACA, cenario, db, dentro, limpar, novoRelogio } from './helpers';

let c: Awaited<ReturnType<typeof cenario>>;
let clock: ReturnType<typeof novoRelogio>;
const deps = () => ({ db, clock });
const CPF = '52998224725';

beforeEach(async () => {
  await limpar();
  c = await cenario();
  clock = novoRelogio();
});
afterAll(() => db.$disconnect());

const novo = (
  extra: Partial<{ nome: string; cpf: string; telefone: string; regiaoId: number }> = {},
) =>
  criarMotorista(deps(), c.admin.id, {
    nome: 'João da Silva',
    cpf: CPF,
    telefone: '(11) 98765-4321',
    regiaoId: c.regiao.id,
    ...extra,
  });

describe('motoristas', () => {
  it('RF24-CA1: cria com senha temporária de 8 caracteres e troca obrigatória', async () => {
    const r = await novo();
    if (!r.ok) throw new Error(JSON.stringify(r.erros));
    expect(r.senhaTemporaria).toHaveLength(8);
    const m = await db.motorista.findUniqueOrThrow({ where: { id: r.id } });
    expect(m).toMatchObject({ cpf: CPF, telefone: '11987654321', deveTrocarSenha: true });
    const entrou = await login(deps(), {
      tipo: 'MOTORISTA',
      cpf: CPF,
      senha: r.senhaTemporaria,
      ip: '1.1.1.1',
    });
    expect(entrou).toMatchObject({ ok: true, deveTrocarSenha: true });
  });

  it('RF24-CA2: CPF inválido ou duplicado vira erro no campo', async () => {
    expect(await novo({ cpf: '123.456.789-00' })).toEqual({
      ok: false,
      erros: { cpf: 'CPF inválido' },
    });
    await novo();
    expect(await novo({ nome: 'Outro Nome' })).toEqual({
      ok: false,
      erros: { cpf: 'CPF já cadastrado' },
    });
  });

  it('RF24-CA1: valida nome, telefone e região', async () => {
    const r = await novo({ nome: 'Jo', telefone: '123', regiaoId: 9999 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.erros).sort()).toEqual(['nome', 'telefone']);
    const semRegiao = await novo({ regiaoId: 9999 });
    expect(semRegiao).toEqual({ ok: false, erros: { regiaoId: 'Região inválida' } });
  });

  it('RF24-CA3: editar a região não altera a senha ativa', async () => {
    const r = await novo();
    if (!r.ok) throw new Error('falhou');
    await db.motorista.update({ where: { id: r.id }, data: { deveTrocarSenha: false } });
    const g = await gerarSenha(deps(), {
      motoristaId: r.id,
      galpaoId: c.galpao.id,
      placa: PLACA,
      leitura: dentro,
    });
    const outra = await db.regiao.create({ data: { codigo: '320', nome: 'Zona Leste' } });
    expect(
      (
        await editarMotorista(deps(), c.admin.id, r.id, {
          nome: 'João S.',
          telefone: '',
          regiaoId: outra.id,
        })
      ).ok,
    ).toBe(true);
    const s = await db.senha.findUniqueOrThrow({ where: { id: g.senha!.id } });
    expect(s).toMatchObject({ status: 'AGUARDANDO', bancadaId: c.bancada.id, regiaoCodigo: '500' });
    expect((await db.motorista.findUniqueOrThrow({ where: { id: r.id } })).regiaoId).toBe(outra.id);
  });

  it('RF24-CA4: desativa e reativa, sem excluir', async () => {
    const r = await novo();
    if (!r.ok) throw new Error('falhou');
    await desativarMotorista(deps(), c.admin.id, r.id);
    expect((await db.motorista.findUniqueOrThrow({ where: { id: r.id } })).ativo).toBe(false);
    await reativarMotorista(deps(), c.admin.id, r.id);
    expect((await db.motorista.findUniqueOrThrow({ where: { id: r.id } })).ativo).toBe(true);
  });

  it('RF24-CA5: redefinir senha gera nova temporária', async () => {
    const r = await novo();
    if (!r.ok) throw new Error('falhou');
    const { senhaTemporaria } = await redefinirSenhaDoMotorista(deps(), c.admin.id, r.id);
    expect(senhaTemporaria).not.toBe(r.senhaTemporaria);
    expect(
      (await login(deps(), { tipo: 'MOTORISTA', cpf: CPF, senha: senhaTemporaria, ip: '1.1.1.1' }))
        .ok,
    ).toBe(true);
  });

  it('RF24-CA6: liberação vale até o fim do dia operacional e aparece na lista', async () => {
    const r = await novo();
    if (!r.ok) throw new Error('falhou');
    const l = await liberarGeofence(deps(), c.admin.id, r.id);
    expect(l.expiraEm.toISOString()).toBe('2026-11-12T03:00:00.000Z'); // 00:00 de 12/11 em São Paulo
    expect((await listarMotoristas(deps()))[0].liberado).toBe(true);
    const de_novo = await liberarGeofence(deps(), c.admin.id, r.id);
    expect(de_novo.id).toBe(l.id); // não duplica
  });

  it('RF24-CA7: busca por nome ou por parte do CPF', async () => {
    await novo();
    await novo({ nome: 'Marcos Oliveira', cpf: '11144477735' });
    expect((await listarMotoristas(deps(), 'marc')).map((m) => m.nome)).toEqual([
      'Marcos Oliveira',
    ]);
    expect((await listarMotoristas(deps(), '529.982')).map((m) => m.nome)).toEqual([
      'João da Silva',
    ]);
    expect(await listarMotoristas(deps(), '')).toHaveLength(2);
  });
});

describe('bancadas, regiões e mapeamento', () => {
  it('RF25-CA1 / RF25-CA6: cria e renomeia bancada, sem repetir identificação no galpão', async () => {
    expect((await criarBancada(deps(), c.admin.id, c.galpao.id, '08')).ok).toBe(true);
    expect(await criarBancada(deps(), c.admin.id, c.galpao.id, '07')).toMatchObject({
      ok: false,
      erros: { identificacao: expect.stringContaining('Já existe') },
    });
    const b = await db.bancada.findFirstOrThrow({ where: { identificacao: '08' } });
    expect((await renomearBancada(deps(), c.admin.id, b.id, 'A')).ok).toBe(true);
    expect((await renomearBancada(deps(), c.admin.id, b.id, '07')).ok).toBe(false);
  });

  it('RF25-CA2 / RF25-CA6: cria região com código único', async () => {
    expect(
      (await criarRegiao(deps(), c.admin.id, { codigo: '420', nome: 'ABC Paulista' })).ok,
    ).toBe(true);
    expect(await criarRegiao(deps(), c.admin.id, { codigo: '500', nome: 'Repetida' })).toEqual({
      ok: false,
      erros: { codigo: 'Já existe uma região com esse código' },
    });
  });

  it('RF25-CA3: mapeia (galpão, região) para uma bancada ativa do galpão, ou nenhuma', async () => {
    const outro = await db.galpao.create({
      data: { nome: 'DS AET', endereco: 'x', prefixoSenha: 'C', localId: c.local.id },
    });
    const bOutro = await db.bancada.create({ data: { galpaoId: outro.id, identificacao: '01' } });
    expect(
      (
        await definirMapeamento(deps(), c.admin.id, {
          galpaoId: c.galpao.id,
          regiaoId: c.regiao.id,
          bancadaId: bOutro.id,
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await definirMapeamento(deps(), c.admin.id, {
          galpaoId: outro.id,
          regiaoId: c.regiao.id,
          bancadaId: bOutro.id,
        })
      ).ok,
    ).toBe(true);
    let d = await dadosBancadasRegioes(deps());
    expect(d.mapa[`${outro.id}:${c.regiao.id}`]).toBe(bOutro.id);
    await definirMapeamento(deps(), c.admin.id, {
      galpaoId: outro.id,
      regiaoId: c.regiao.id,
      bancadaId: null,
    });
    d = await dadosBancadasRegioes(deps());
    expect(d.mapa[`${outro.id}:${c.regiao.id}`]).toBeUndefined();
  });

  it('RF25-CA4: bloqueia desativar bancada com senha ativa e região com motorista ativo', async () => {
    const r = await novo();
    if (!r.ok) throw new Error('falhou');
    await db.motorista.update({ where: { id: r.id }, data: { deveTrocarSenha: false } });
    await gerarSenha(deps(), {
      motoristaId: r.id,
      galpaoId: c.galpao.id,
      placa: PLACA,
      leitura: dentro,
    });
    expect(await alternarBancada(deps(), c.admin.id, c.bancada.id, false)).toEqual({
      ok: false,
      erros: { geral: 'Não é possível desativar: há 1 senha ativa nesta bancada.' },
    });
    expect(await alternarRegiao(deps(), c.admin.id, c.regiao.id, false)).toEqual({
      ok: false,
      erros: { geral: 'Não é possível desativar: há 1 motorista ativo nesta região.' },
    });
    const vazia = await db.regiao.create({ data: { codigo: '999', nome: 'Vazia' } });
    expect((await alternarRegiao(deps(), c.admin.id, vazia.id, false)).ok).toBe(true);
  });

  it('RF25-CA5: mudar o mapeamento não altera senhas já geradas', async () => {
    const r = await novo();
    if (!r.ok) throw new Error('falhou');
    await db.motorista.update({ where: { id: r.id }, data: { deveTrocarSenha: false } });
    const g = await gerarSenha(deps(), {
      motoristaId: r.id,
      galpaoId: c.galpao.id,
      placa: PLACA,
      leitura: dentro,
    });
    const b2 = await db.bancada.create({ data: { galpaoId: c.galpao.id, identificacao: '09' } });
    await definirMapeamento(deps(), c.admin.id, {
      galpaoId: c.galpao.id,
      regiaoId: c.regiao.id,
      bancadaId: b2.id,
    });
    expect((await db.senha.findUniqueOrThrow({ where: { id: g.senha!.id } })).bancadaId).toBe(
      c.bancada.id,
    );
  });
});

describe('configurações', () => {
  it('RF26-CA1: aceita valores nos limites e recusa fora deles', async () => {
    const base = {
      toleranciaMin: 5,
      carenciaSeg: 30,
      tempoPadraoMin: 15,
      ocupacaoMaxMin: 120,
      raios: { [c.local.id]: 150 },
    };
    expect(
      (
        await salvarConfiguracoes(deps(), c.admin.id, {
          ...base,
          toleranciaMin: 30,
          raios: { [c.local.id]: 2000 },
        })
      ).ok,
    ).toBe(true);
    const r = await salvarConfiguracoes(deps(), c.admin.id, {
      toleranciaMin: 31,
      carenciaSeg: -1,
      tempoPadraoMin: 0,
      ocupacaoMaxMin: 10,
      raios: { [c.local.id]: 49 },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.erros).sort()).toEqual(
        [
          'carenciaSeg',
          'ocupacaoMaxMin',
          `raio-${c.local.id}`,
          'tempoPadraoMin',
          'toleranciaMin',
        ].sort(),
      );
    }
    const lido = await lerConfiguracoes(deps());
    expect(lido.toleranciaMin).toBe(30);
    expect(lido.locais[0].raioMetros).toBe(2000);
  });

  it('RF26-CA2: cada alteração vai para a auditoria com valor anterior e novo', async () => {
    await salvarConfiguracoes(deps(), c.admin.id, {
      toleranciaMin: 8,
      carenciaSeg: 30,
      tempoPadraoMin: 15,
      ocupacaoMaxMin: 120,
      raios: { [c.local.id]: 200 },
    });
    const a = await db.auditoria.findFirstOrThrow({ where: { acao: 'configuracao.alterar' } });
    expect(a.atorId).toBe(c.admin.id);
    expect(a.dados).toMatchObject({
      toleranciaMin: { antes: 5, depois: 8 },
      [`raio:${c.local.nome}`]: { antes: 150, depois: 200 },
    });
  });
});

describe('administradores', () => {
  it('RF27-CA1: o super-admin cria admin com senha temporária e o desativa', async () => {
    const r = await criarAdmin(deps(), c.admin.id, { nome: 'Ana Souza', cpf: '11144477735' });
    if (!r.ok) throw new Error(JSON.stringify(r.erros));
    const entrou = await login(deps(), {
      tipo: 'ADMIN',
      cpf: '11144477735',
      senha: r.senhaTemporaria,
      ip: '1.1.1.1',
    });
    expect(entrou).toMatchObject({ ok: true, deveTrocarSenha: true, papel: 'ADMIN' });
    expect((await desativarAdmin(deps(), c.admin.id, r.id)).ok).toBe(true);
    expect((await db.admin.findUniqueOrThrow({ where: { id: r.id } })).ativo).toBe(false);
  });

  it('RF27-CA3: o super-admin não pode ser desativado e o papel é transferível', async () => {
    const s = await db.admin.update({ where: { id: c.admin.id }, data: { papel: 'SUPER_ADMIN' } });
    expect(await desativarAdmin(deps(), s.id, s.id)).toEqual({
      ok: false,
      erros: { geral: 'O super-admin não pode ser desativado.' },
    });
    const r = await criarAdmin(deps(), s.id, { nome: 'Ana Souza', cpf: '11144477735' });
    if (!r.ok) throw new Error('falhou');
    expect((await transferirSuperAdmin(deps(), '111.444.777-35')).ok).toBe(true);
    const papeis = await db.admin.findMany({ orderBy: { id: 'asc' }, select: { papel: true } });
    expect(papeis.map((p) => p.papel)).toEqual(['ADMIN', 'SUPER_ADMIN']);
  });

  it('RF29-CA1: as ações de cadastro ficam na auditoria com o admin que fez', async () => {
    await novo();
    await criarRegiao(deps(), c.admin.id, { codigo: '420', nome: 'ABC' });
    const acoes = await db.auditoria.findMany({
      where: { atorId: c.admin.id },
      select: { acao: true },
    });
    expect(acoes.map((a) => a.acao)).toEqual(
      expect.arrayContaining(['cadastro.motorista.criar', 'cadastro.regiao.criar']),
    );
  });
});
