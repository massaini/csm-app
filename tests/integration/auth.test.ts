import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { verify } from '@node-rs/argon2';
import type { Prisma } from '@/generated/prisma/client';
import {
  LIMITES,
  MENSAGEM_LOGIN_INVALIDO,
  desativarUsuario,
  gerarSenhaTemporaria,
  hashDaSenha,
  hashDoToken,
  login,
  logout,
  redefinirSenha,
  trocarSenha,
  validarSessao,
} from '@/server/auth';
import { gerarSenha } from '@/server/senhas';
import { cenario, db, dentro, limpar, novoRelogio } from './helpers';

const MIN = 60_000;
const HORA = 60 * MIN;
const CPF = '52998224725';
const CPF_ADMIN = '11144477735';
const SENHA = 'senha-boa-123';

let clock: ReturnType<typeof novoRelogio>;
let c: Awaited<ReturnType<typeof cenario>>;
let motoristaId: number;
const deps = () => ({ db, clock });

async function criarMotorista(
  extra: Partial<
    Pick<Prisma.MotoristaUncheckedCreateInput, 'deveTrocarSenha' | 'senhaTemporariaExpiraEm'>
  > = {},
) {
  const m = await db.motorista.create({
    data: {
      nome: 'João',
      cpf: CPF,
      senhaHash: await hashDaSenha(SENHA),
      regiaoId: c.regiao.id,
      deveTrocarSenha: false,
      ...extra,
    },
  });
  motoristaId = m.id;
  return m;
}

const entrar = (
  senha = SENHA,
  cpf = CPF,
  ip = '10.0.0.1',
  tipo: 'MOTORISTA' | 'ADMIN' = 'MOTORISTA',
) => login(deps(), { tipo, cpf, senha, ip });

beforeEach(async () => {
  await limpar();
  c = await cenario();
  clock = novoRelogio();
});
afterAll(() => db.$disconnect());

describe('login do motorista', () => {
  it('RF01-CA1: credenciais corretas abrem sessão e informam se a troca de senha é obrigatória', async () => {
    await criarMotorista({ deveTrocarSenha: true });
    const r = await entrar();
    expect(r).toMatchObject({ ok: true, tipo: 'MOTORISTA', nome: 'João', deveTrocarSenha: true });
  });

  it('RF01-CA2: CPF inexistente, senha errada, inativo e CPF inválido devolvem a mesma resposta', async () => {
    await criarMotorista();
    await db.motorista.create({
      data: {
        nome: 'Inativo',
        cpf: '11144477735',
        senhaHash: await hashDaSenha(SENHA),
        regiaoId: c.regiao.id,
        ativo: false,
      },
    });
    const respostas = [
      await entrar('errada'),
      await entrar(SENHA, '39053344705'), // CPF válido, inexistente
      await entrar(SENHA, '11144477735'), // inativo, senha certa
      await entrar(SENHA, '123'), // inválido
    ];
    for (const r of respostas) {
      expect(r).toEqual({
        ok: false,
        codigo: 'CREDENCIAIS_INVALIDAS',
        mensagem: MENSAGEM_LOGIN_INVALIDO,
      });
    }
  });

  it('RF01-CA3: 5 falhas seguidas bloqueiam o CPF por 15 min, mesmo com a senha certa', async () => {
    await criarMotorista();
    for (let i = 0; i < 5; i++) await entrar('errada');
    expect((await entrar()).ok).toBe(false); // bloqueado
    clock.avancar(14 * MIN);
    expect((await entrar()).ok).toBe(false);
    clock.avancar(2 * MIN); // 16 min depois da última falha
    expect((await entrar()).ok).toBe(true);
  });

  it('RF01-CA3: as tentativas feitas durante o bloqueio não o prolongam', async () => {
    await criarMotorista();
    for (let i = 0; i < 5; i++) await entrar('errada');
    for (let i = 0; i < 3; i++) {
      clock.avancar(3 * MIN);
      await entrar('errada');
    }
    clock.avancar(7 * MIN); // 16 min depois da 5ª falha
    expect((await entrar()).ok).toBe(true);
  });

  it('RF01-CA3: um login com sucesso zera o contador de falhas', async () => {
    await criarMotorista();
    for (let i = 0; i < 4; i++) await entrar('errada');
    expect((await entrar()).ok).toBe(true);
    for (let i = 0; i < 4; i++) await entrar('errada');
    expect((await entrar()).ok).toBe(true); // 4 falhas depois do sucesso: ainda não bloqueia
  });

  it('RF01-CA4: 100 falhas do mesmo IP em 15 min bloqueiam o IP, não outros', async () => {
    await criarMotorista();
    await db.tentativaLogin.createMany({
      data: Array.from({ length: 100 }, (_, i) => ({
        cpf: String(30000000000 + i),
        ip: '10.9.9.9',
        sucesso: false,
        instante: clock.agora(),
      })),
    });
    expect((await entrar(SENHA, CPF, '10.9.9.9')).ok).toBe(false);
    expect((await entrar(SENHA, CPF, '10.0.0.1')).ok).toBe(true);
    clock.avancar(16 * MIN);
    expect((await entrar(SENHA, CPF, '10.9.9.9')).ok).toBe(true);
  });

  it('RF02-CA4: senha temporária vence em 72 h e deixa de autenticar', async () => {
    await criarMotorista({
      deveTrocarSenha: true,
      senhaTemporariaExpiraEm: new Date(clock.agora().getTime() + LIMITES.senhaTemporariaMs),
    });
    clock.avancar(71 * HORA);
    expect((await entrar()).ok).toBe(true);
    clock.avancar(2 * HORA);
    expect((await entrar()).ok).toBe(false);
  });
});

describe('login do admin', () => {
  async function criarAdmin(papel: 'ADMIN' | 'SUPER_ADMIN' = 'ADMIN', extra = {}) {
    return db.admin.create({
      data: {
        nome: 'Marcos',
        cpf: CPF_ADMIN,
        senhaHash: await hashDaSenha(SENHA),
        papel,
        deveTrocarSenha: false,
        ...extra,
      },
    });
  }

  it('RF03-CA1: admin ativo autentica e a resposta traz o papel', async () => {
    await criarAdmin('SUPER_ADMIN');
    const r = await entrar(SENHA, CPF_ADMIN, '10.0.0.1', 'ADMIN');
    expect(r).toMatchObject({ ok: true, tipo: 'ADMIN', papel: 'SUPER_ADMIN' });
  });

  it('RF03-CA2: uma sessão de motorista não vale para o admin e vice-versa', async () => {
    await criarMotorista();
    await criarAdmin();
    const m = await entrar();
    const a = await entrar(SENHA, CPF_ADMIN, '10.0.0.1', 'ADMIN');
    if (!m.ok || !a.ok) throw new Error('login falhou');
    expect(await validarSessao(deps(), m.token, 'ADMIN')).toBeNull();
    expect(await validarSessao(deps(), a.token, 'MOTORISTA')).toBeNull();
    expect(await validarSessao(deps(), m.token, 'MOTORISTA')).not.toBeNull();
    expect(await validarSessao(deps(), a.token, 'ADMIN')).not.toBeNull();
  });

  it('RF03-CA1: a sessão do admin dura 12 h a partir do login e não renova', async () => {
    await criarAdmin();
    const r = await entrar(SENHA, CPF_ADMIN, '10.0.0.1', 'ADMIN');
    if (!r.ok) throw new Error('login falhou');
    clock.avancar(11 * HORA);
    expect(await validarSessao(deps(), r.token, 'ADMIN')).not.toBeNull();
    clock.avancar(2 * HORA); // 13 h: o uso na hora 11 não estendeu
    expect(await validarSessao(deps(), r.token, 'ADMIN')).toBeNull();
  });

  it('RF02-CA4: a senha inicial do super-admin exige troca mas não expira', async () => {
    await criarAdmin('SUPER_ADMIN', { deveTrocarSenha: true, senhaTemporariaExpiraEm: null });
    clock.avancar(30 * 24 * HORA);
    const r = await entrar(SENHA, CPF_ADMIN, '10.0.0.1', 'ADMIN');
    expect(r).toMatchObject({ ok: true, deveTrocarSenha: true });
  });
});

describe('sessão', () => {
  it('RNF02-CA2: guarda só o hash do token e a sessão do motorista dura 30 dias deslizantes', async () => {
    await criarMotorista();
    const r = await entrar();
    if (!r.ok) throw new Error('login falhou');
    const linha = await db.sessao.findFirstOrThrow();
    expect(linha.tokenHash).toBe(hashDoToken(r.token));
    expect(linha.tokenHash).not.toContain(r.token);

    clock.avancar(20 * 24 * HORA);
    expect(await validarSessao(deps(), r.token)).not.toBeNull(); // renova até +30 dias
    clock.avancar(20 * 24 * HORA); // 40 dias do login, 20 do último uso
    expect(await validarSessao(deps(), r.token)).not.toBeNull();
    clock.avancar(31 * 24 * HORA);
    expect(await validarSessao(deps(), r.token)).toBeNull();
  });

  it('RNF02-CA2: a renovação grava no máximo uma vez por hora', async () => {
    await criarMotorista();
    const r = await entrar();
    if (!r.ok) throw new Error('login falhou');
    const inicial = (await db.sessao.findFirstOrThrow()).expiraEm;
    clock.avancar(10 * MIN);
    await validarSessao(deps(), r.token);
    expect((await db.sessao.findFirstOrThrow()).expiraEm.getTime()).toBe(inicial.getTime());
    clock.avancar(2 * HORA);
    await validarSessao(deps(), r.token);
    expect((await db.sessao.findFirstOrThrow()).expiraEm.getTime()).toBeGreaterThan(
      inicial.getTime(),
    );
  });

  it('RF04-CA1: o logout apaga a sessão e o cookie antigo deixa de valer', async () => {
    await criarMotorista();
    const r = await entrar();
    if (!r.ok) throw new Error('login falhou');
    await logout(deps(), r.token);
    expect(await validarSessao(deps(), r.token)).toBeNull();
    expect(await db.sessao.count()).toBe(0);
  });

  it('RF04-CA2: o logout apaga a inscrição de push do aparelho atual, só dele', async () => {
    const m = await criarMotorista();
    await db.pushSubscription.createMany({
      data: [
        { endpoint: 'https://push/a', p256dh: 'k', auth: 'a', motoristaId: m.id },
        { endpoint: 'https://push/b', p256dh: 'k', auth: 'a', motoristaId: m.id },
      ],
    });
    const r = await entrar();
    if (!r.ok) throw new Error('login falhou');
    await logout(deps(), r.token, 'https://push/a');
    expect((await db.pushSubscription.findMany()).map((p) => p.endpoint)).toEqual([
      'https://push/b',
    ]);
  });

  it('RNF02-CA1: a senha fica em argon2id, nunca em texto', async () => {
    const m = await criarMotorista();
    expect(m.senhaHash).toMatch(/^\$argon2id\$/);
    expect(m.senhaHash).not.toContain(SENHA);
    expect(await verify(m.senhaHash, SENHA)).toBe(true);
  });
});

describe('troca de senha', () => {
  it('RF02-CA2: exige 8+ caracteres, diferente da atual e a senha atual correta', async () => {
    const m = await criarMotorista({ deveTrocarSenha: true });
    const base = { tipo: 'MOTORISTA' as const, usuarioId: m.id };
    expect(await trocarSenha(deps(), { ...base, senhaAtual: SENHA, novaSenha: 'curta' })).toEqual({
      ok: false,
      codigo: 'SENHA_CURTA',
    });
    expect(await trocarSenha(deps(), { ...base, senhaAtual: SENHA, novaSenha: SENHA })).toEqual({
      ok: false,
      codigo: 'IGUAL_A_ATUAL',
    });
    expect(
      await trocarSenha(deps(), { ...base, senhaAtual: 'errada-123', novaSenha: 'nova-senha-1' }),
    ).toEqual({ ok: false, codigo: 'SENHA_ATUAL_INVALIDA' });
    expect((await db.motorista.findUniqueOrThrow({ where: { id: m.id } })).deveTrocarSenha).toBe(
      true,
    );
  });

  it('RF02-CA3: trocar a senha limpa o flag e a validade da temporária', async () => {
    const m = await criarMotorista({
      deveTrocarSenha: true,
      senhaTemporariaExpiraEm: new Date(clock.agora().getTime() + LIMITES.senhaTemporariaMs),
    });
    const r = await trocarSenha(deps(), {
      tipo: 'MOTORISTA',
      usuarioId: m.id,
      senhaAtual: SENHA,
      novaSenha: 'nova-senha-1',
    });
    expect(r.ok).toBe(true);
    const lido = await db.motorista.findUniqueOrThrow({ where: { id: m.id } });
    expect(lido).toMatchObject({ deveTrocarSenha: false, senhaTemporariaExpiraEm: null });
    clock.avancar(100 * HORA);
    expect((await entrar('nova-senha-1')).ok).toBe(true);
  });
});

describe('desativar e redefinir', () => {
  it('RF06-CA1: desativar apaga sessões e inscrições de push; a próxima requisição é recusada', async () => {
    const m = await criarMotorista();
    await db.pushSubscription.create({
      data: { endpoint: 'https://push/x', p256dh: 'k', auth: 'a', motoristaId: m.id },
    });
    const r = await entrar();
    if (!r.ok) throw new Error('login falhou');
    await desativarUsuario(deps(), { tipo: 'MOTORISTA', usuarioId: m.id, porAdminId: c.admin.id });
    expect(await validarSessao(deps(), r.token)).toBeNull();
    expect(await db.sessao.count()).toBe(0);
    expect(await db.pushSubscription.count()).toBe(0);
  });

  it('RF06-CA2: mesmo com a sessão intacta no banco, usuário inativo é recusado', async () => {
    const m = await criarMotorista();
    const r = await entrar();
    if (!r.ok) throw new Error('login falhou');
    await db.motorista.update({ where: { id: m.id }, data: { ativo: false } });
    expect(await validarSessao(deps(), r.token)).toBeNull();
  });

  it('RF06-CA3: desativar o motorista cancela a senha ativa com o motivo e a marca como vista', async () => {
    const m = await criarMotorista();
    const g = await gerarSenha(
      { db, clock },
      { motoristaId: m.id, galpaoId: c.galpao.id, placa: 'ABC1D23', leitura: dentro },
    );
    await desativarUsuario(deps(), { tipo: 'MOTORISTA', usuarioId: m.id, porAdminId: c.admin.id });
    const s = await db.senha.findUniqueOrThrow({ where: { id: g.senha!.id } });
    expect(s).toMatchObject({ status: 'CANCELADA', motivoCancelamento: 'MOTORISTA_DESATIVADO' });
    expect(s.resultadoVistoEm).not.toBeNull();
  });

  it('RF27-CA3: o super-admin não pode ser desativado', async () => {
    const s = await db.admin.create({
      data: { nome: 'Raiz', cpf: CPF_ADMIN, senhaHash: 'x', papel: 'SUPER_ADMIN' },
    });
    await expect(
      desativarUsuario(deps(), { tipo: 'ADMIN', usuarioId: s.id, porAdminId: c.admin.id }),
    ).rejects.toThrow(/super-admin/);
  });

  it('RF24-CA5: redefinir gera temporária, força a troca, derruba sessões e zera o bloqueio do CPF', async () => {
    const m = await criarMotorista();
    for (let i = 0; i < 5; i++) await entrar('errada');
    expect((await entrar()).ok).toBe(false); // bloqueado

    const { senhaTemporaria } = await redefinirSenha(deps(), {
      tipo: 'MOTORISTA',
      usuarioId: m.id,
      porAdminId: c.admin.id,
    });
    expect(senhaTemporaria).toHaveLength(8);
    const lido = await db.motorista.findUniqueOrThrow({ where: { id: m.id } });
    expect(lido.deveTrocarSenha).toBe(true);
    expect(lido.senhaTemporariaExpiraEm!.getTime()).toBe(
      clock.agora().getTime() + LIMITES.senhaTemporariaMs,
    );

    const r = await entrar(senhaTemporaria); // bloqueio zerado
    expect(r).toMatchObject({ ok: true, deveTrocarSenha: true });
    expect((await entrar(SENHA)).ok).toBe(false); // a antiga não vale mais
  });

  it('RF24-CA1: a senha temporária tem 8 caracteres sem símbolos ambíguos', () => {
    for (let i = 0; i < 200; i++)
      expect(gerarSenhaTemporaria()).toMatch(/^[a-hj-km-np-zA-HJ-NP-Z2-9]{8}$/);
  });
});
