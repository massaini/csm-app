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
  excluirAdmin,
  excluirBancada,
  excluirMotorista,
  excluirRegiao,
  lerConfiguracoes,
  liberarGeofence,
  listarMotoristas,
  reativarMotorista,
  redefinirSenhaDoMotorista,
  removerBairro,
  renomearAdmin,
  renomearBairro,
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

  it('RF24-CA9: só o super-admin exclui, e só motorista sem histórico', async () => {
    const r = await novo();
    if (!r.ok) throw new Error('falhou');
    const comum = { id: c.admin.id, papel: 'ADMIN' as const };
    const superAdmin = { id: c.admin.id, papel: 'SUPER_ADMIN' as const };
    expect(await excluirMotorista(deps(), comum, r.id)).toEqual({
      ok: false,
      erros: { geral: 'Só o super-administrador pode excluir motoristas.' },
    });

    // com senha no histórico, o caminho é desativar
    const outro = await novo({ nome: 'Marcos Oliveira', cpf: '11144477735' });
    if (!outro.ok) throw new Error('falhou');
    await db.motorista.update({ where: { id: outro.id }, data: { deveTrocarSenha: false } });
    await gerarSenha(deps(), {
      motoristaId: outro.id,
      galpaoId: c.galpao.id,
      placa: PLACA,
      leitura: dentro,
    });
    expect(await excluirMotorista(deps(), superAdmin, outro.id)).toMatchObject({
      ok: false,
      erros: { geral: expect.stringContaining('Use Desativar') },
    });

    // sem histórico: sai do cadastro, com sessões, e fica na auditoria
    await login(deps(), { tipo: 'MOTORISTA', cpf: CPF, senha: r.senhaTemporaria, ip: '1.1.1.1' });
    expect(await excluirMotorista(deps(), superAdmin, r.id)).toEqual({ ok: true });
    expect(await db.motorista.findUnique({ where: { id: r.id } })).toBeNull();
    expect(await db.sessao.count({ where: { motoristaId: r.id } })).toBe(0);
    const aud = await db.auditoria.findFirstOrThrow({
      where: { acao: 'cadastro.motorista.excluir' },
    });
    expect(aud).toMatchObject({ atorId: c.admin.id, alvoId: String(r.id) });
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

  it('RF25-CA2 / RF25-CA6: código novo cria a região; código existente ganha bairro, sem repetir', async () => {
    expect(await criarRegiao(deps(), c.admin.id, { codigo: '545', nome: 'Paranapiacaba' })).toEqual(
      { ok: true, bairroAdicionado: false },
    );
    expect(
      await criarRegiao(deps(), c.admin.id, { codigo: '545', nome: 'Represa Billings' }),
    ).toEqual({ ok: true, bairroAdicionado: true });
    const r = await db.regiao.findUniqueOrThrow({ where: { codigo: '545' } });
    expect(r).toMatchObject({
      bairros: ['Paranapiacaba', 'Represa Billings'],
      nome: 'Paranapiacaba, Represa Billings',
    });
    expect(await db.regiao.count({ where: { codigo: '545' } })).toBe(1);
    // repetido no mesmo código, sem diferença de maiúsculas ou acento
    expect(await criarRegiao(deps(), c.admin.id, { codigo: '545', nome: 'paranapiacabá' })).toEqual(
      { ok: false, erros: { nome: 'A região 545 já tem o bairro paranapiacabá' } },
    );
    // região criada antes da lista de bairros: o nome atual conta como o primeiro
    expect(
      (await criarRegiao(deps(), c.admin.id, { codigo: '500', nome: 'Vila Assunção' })).ok,
    ).toBe(true);
    expect((await db.regiao.findUniqueOrThrow({ where: { codigo: '500' } })).bairros).toEqual([
      'Centro de Santo André',
      'Vila Assunção',
    ]);
  });

  it('RF25-CA2: região sem lista de bairros (nula no banco) usa o nome como bairro, sem quebrar', async () => {
    await db.$executeRaw`UPDATE "Regiao" SET bairros = NULL WHERE id = ${c.regiao.id}`;
    const d = await dadosBancadasRegioes(deps());
    expect(d.regioes.find((r) => r.id === c.regiao.id)?.bairros).toEqual(['Centro de Santo André']);
    expect(await criarRegiao(deps(), c.admin.id, { codigo: '500', nome: 'Vila Assunção' })).toEqual(
      { ok: true, bairroAdicionado: true },
    );
    expect((await db.regiao.findUniqueOrThrow({ where: { id: c.regiao.id } })).bairros).toEqual([
      'Centro de Santo André',
      'Vila Assunção',
    ]);
  });

  it('RF25-CA2: dois admins adicionando bairros ao mesmo código ao mesmo tempo não perdem nenhum', async () => {
    const bairros = ['Paranapiacaba', 'Represa Billings', 'Campo Grande', 'Rio Grande'];
    // código novo: as quatro chamadas disputam quem cria; as outras acrescentam o bairro
    const r = await Promise.all(
      bairros.map((nome) => criarRegiao(deps(), c.admin.id, { codigo: '545', nome })),
    );
    expect(r.every((x) => x.ok)).toBe(true);
    const regiao = await db.regiao.findUniqueOrThrow({ where: { codigo: '545' } });
    expect([...regiao.bairros].sort()).toEqual([...bairros].sort());
    expect(regiao.nome.split(', ').sort()).toEqual([...bairros].sort());
  });

  it('RF25-CA2: renomeia e remove bairro, e a região fica com pelo menos um', async () => {
    await criarRegiao(deps(), c.admin.id, { codigo: '545', nome: 'Paranapiacaba' });
    await criarRegiao(deps(), c.admin.id, { codigo: '545', nome: 'Represa' });
    const r = await db.regiao.findUniqueOrThrow({ where: { codigo: '545' } });
    expect(await renomearBairro(deps(), c.admin.id, r.id, 'Represa', 'Represa Billings')).toEqual({
      ok: true,
    });
    expect(
      await renomearBairro(deps(), c.admin.id, r.id, 'Represa Billings', 'Paranapiacaba'),
    ).toEqual({ ok: false, erros: { nome: 'A região 545 já tem o bairro Paranapiacaba' } });
    expect(await removerBairro(deps(), c.admin.id, r.id, 'Paranapiacaba')).toEqual({ ok: true });
    expect(await db.regiao.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({
      bairros: ['Represa Billings'],
      nome: 'Represa Billings',
    });
    expect(await removerBairro(deps(), c.admin.id, r.id, 'Represa Billings')).toMatchObject({
      ok: false,
      erros: { geral: expect.stringContaining('pelo menos um bairro') },
    });
  });

  it('RF25-CA8: exclui bancada e região sem uso; com histórico, mapeamento ou motoristas, bloqueia', async () => {
    // bancada mapeada: bloqueia e diz qual região
    expect(await excluirBancada(deps(), c.admin.id, c.bancada.id)).toMatchObject({
      ok: false,
      erros: { geral: expect.stringContaining('atende a região 500') },
    });
    // bancada com senha no histórico: bloqueia mesmo fora do mapeamento
    const r = await novo();
    if (!r.ok) throw new Error('falhou');
    await db.motorista.update({ where: { id: r.id }, data: { deveTrocarSenha: false } });
    await gerarSenha(deps(), {
      motoristaId: r.id,
      galpaoId: c.galpao.id,
      placa: PLACA,
      leitura: dentro,
    });
    await db.regiaoBancada.deleteMany({});
    expect(await excluirBancada(deps(), c.admin.id, c.bancada.id)).toMatchObject({
      ok: false,
      erros: { geral: expect.stringContaining('Use Desativar') },
    });
    // bancada nova, sem uso: sai
    const livre = await db.bancada.create({ data: { galpaoId: c.galpao.id, identificacao: '09' } });
    expect(await excluirBancada(deps(), c.admin.id, livre.id)).toEqual({ ok: true });
    expect(await db.bancada.findUnique({ where: { id: livre.id } })).toBeNull();

    // região com motorista cadastrado (mesmo inativo): bloqueia
    await desativarMotorista(deps(), c.admin.id, r.id);
    expect(await excluirRegiao(deps(), c.admin.id, c.regiao.id)).toMatchObject({
      ok: false,
      erros: { geral: expect.stringContaining('1 motorista cadastrado') },
    });
    // região sem motoristas: sai junto com o mapeamento; a senha guarda o snapshot
    await criarRegiao(deps(), c.admin.id, { codigo: '545', nome: 'Paranapiacaba' });
    const nova = await db.regiao.findUniqueOrThrow({ where: { codigo: '545' } });
    await definirMapeamento(deps(), c.admin.id, {
      galpaoId: c.galpao.id,
      regiaoId: nova.id,
      bancadaId: c.bancada.id,
    });
    expect(await excluirRegiao(deps(), c.admin.id, nova.id)).toEqual({ ok: true });
    expect(await db.regiao.findUnique({ where: { id: nova.id } })).toBeNull();
    expect(await db.regiaoBancada.count({ where: { regiaoId: nova.id } })).toBe(0);
    expect(await db.senha.findFirstOrThrow()).toMatchObject({ regiaoCodigo: '500' });
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

  it('RF27-CA4: o super-admin edita o nome de um admin, inclusive o próprio, com auditoria', async () => {
    const s = await db.admin.update({ where: { id: c.admin.id }, data: { papel: 'SUPER_ADMIN' } });
    expect(await renomearAdmin(deps(), s.id, s.id, '  Marcos Tavares  ')).toEqual({ ok: true });
    expect((await db.admin.findUniqueOrThrow({ where: { id: s.id } })).nome).toBe('Marcos Tavares');
    expect(await renomearAdmin(deps(), s.id, s.id, 'ab')).toEqual({
      ok: false,
      erros: { nome: 'Informe o nome completo' },
    });
    const aud = await db.auditoria.findFirstOrThrow({ where: { acao: 'cadastro.admin.renomear' } });
    expect(aud.dados).toMatchObject({ para: 'Marcos Tavares' });
  });

  it('RF27-CA5: o super-admin exclui admin que nunca atendeu; não exclui a si nem o super', async () => {
    const s = await db.admin.update({ where: { id: c.admin.id }, data: { papel: 'SUPER_ADMIN' } });
    expect(await excluirAdmin(deps(), s.id, s.id)).toEqual({
      ok: false,
      erros: { geral: 'Você não pode excluir a si mesmo.' },
    });
    const novoAdmin = await criarAdmin(deps(), s.id, { nome: 'Ana Souza', cpf: '11144477735' });
    if (!novoAdmin.ok) throw new Error('falhou');

    // admin que já liberou geração de senha aparece no histórico: bloqueia
    const m = await novo();
    if (!m.ok) throw new Error('falhou');
    await liberarGeofence(deps(), novoAdmin.id, m.id);
    expect(await excluirAdmin(deps(), s.id, novoAdmin.id)).toMatchObject({
      ok: false,
      erros: { geral: expect.stringContaining('Use Desativar') },
    });

    // sem nada no histórico: sai, e a auditoria antiga dele continua
    const outro = await criarAdmin(deps(), s.id, { nome: 'Bruno Lima', cpf: '39053344705' });
    if (!outro.ok) throw new Error('falhou');
    await renomearAdmin(deps(), s.id, outro.id, 'Bruno Lima Souza');
    expect(await excluirAdmin(deps(), s.id, outro.id)).toEqual({ ok: true });
    expect(await db.admin.findUnique({ where: { id: outro.id } })).toBeNull();
    expect(
      await db.auditoria.count({ where: { alvoTipo: 'ADMIN', alvoId: String(outro.id) } }),
    ).toBeGreaterThanOrEqual(3); // criar, renomear e excluir
  });

  it('RF27-CA5: o super-admin não pode ser excluído', async () => {
    const s = await db.admin.update({ where: { id: c.admin.id }, data: { papel: 'SUPER_ADMIN' } });
    const a = await criarAdmin(deps(), s.id, { nome: 'Ana Souza', cpf: '11144477735' });
    if (!a.ok) throw new Error('falhou');
    // um super-admin tentando excluir outro super (após transferência) também é barrado
    await transferirSuperAdmin(deps(), '111.444.777-35');
    expect(await excluirAdmin(deps(), s.id, a.id)).toEqual({
      ok: false,
      erros: { geral: 'O super-admin não pode ser excluído.' },
    });
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
