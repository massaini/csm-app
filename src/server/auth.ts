import { createHash, randomBytes, randomInt } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import type { Clock } from '@/domain/clock';
import { cpfValido, somenteDigitos } from '@/domain/documentos';

export type TipoUsuario = 'MOTORISTA' | 'ADMIN';

export interface AuthDeps {
  db: PrismaClient;
  clock: Clock;
}

const MIN = 60_000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

export const LIMITES = {
  falhasPorCpf: 5,
  falhasPorIp: 100,
  janelaBloqueioMs: 15 * MIN,
  sessaoMotoristaMs: 30 * DIA,
  sessaoAdminMs: 12 * HORA,
  /** a sessão deslizante do motorista só é regravada se passou mais que isso */
  renovacaoMinimaMs: HORA,
  senhaTemporariaMs: 72 * HORA,
  senhaMinima: 8,
} as const;

export const MENSAGEM_LOGIN_INVALIDO =
  'CPF ou senha inválidos. Após várias tentativas o acesso é bloqueado por 15 minutos.';

export async function hashDaSenha(senha: string): Promise<string> {
  return hash(senha); // argon2id
}

let hashFalso: Promise<string> | null = null;

/** Senha temporária legível: 8 caracteres sem 0/O/1/l/I. */
export function gerarSenhaTemporaria(): string {
  const alfabeto = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => alfabeto[randomInt(alfabeto.length)]).join('');
}

export function hashDoToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function duracaoDaSessao(tipo: TipoUsuario): number {
  return tipo === 'MOTORISTA' ? LIMITES.sessaoMotoristaMs : LIMITES.sessaoAdminMs;
}

export type ResultadoLogin =
  | {
      ok: true;
      token: string;
      expiraEm: Date;
      tipo: TipoUsuario;
      usuarioId: number;
      nome: string;
      deveTrocarSenha: boolean;
      papel?: 'ADMIN' | 'SUPER_ADMIN';
    }
  | { ok: false; codigo: 'CREDENCIAIS_INVALIDAS'; mensagem: string };

const FALHA: ResultadoLogin = {
  ok: false,
  codigo: 'CREDENCIAIS_INVALIDAS',
  mensagem: MENSAGEM_LOGIN_INVALIDO,
};

async function cpfBloqueado(db: PrismaClient, cpf: string, agora: Date): Promise<boolean> {
  const ultimas = await db.tentativaLogin.findMany({
    where: { cpf },
    orderBy: { instante: 'desc' },
    take: LIMITES.falhasPorCpf,
  });
  if (ultimas.length < LIMITES.falhasPorCpf) return false;
  // 5 falhas seguidas (sem sucesso no meio) dentro de uma janela de 15 min bloqueiam por 15 min
  // a partir da última; falhas espalhadas ao longo de dias não bloqueiam
  if (ultimas.some((t) => t.sucesso)) return false;
  const [maisRecente, maisAntiga] = [ultimas[0].instante, ultimas[ultimas.length - 1].instante];
  if (maisRecente.getTime() - maisAntiga.getTime() > LIMITES.janelaBloqueioMs) return false;
  return agora.getTime() < maisRecente.getTime() + LIMITES.janelaBloqueioMs;
}

async function ipBloqueado(db: PrismaClient, ip: string, agora: Date): Promise<boolean> {
  const desde = new Date(agora.getTime() - LIMITES.janelaBloqueioMs);
  const falhas = await db.tentativaLogin.count({
    where: { ip, sucesso: false, instante: { gt: desde } },
  });
  return falhas >= LIMITES.falhasPorIp;
}

/**
 * Login por CPF + senha. Toda falha devolve a mesma resposta (RF01-CA2): CPF inexistente,
 * senha errada, usuário inativo, senha temporária vencida e bloqueios.
 */
export async function login(
  deps: AuthDeps,
  e: { tipo: TipoUsuario; cpf: string; senha: string; ip: string },
): Promise<ResultadoLogin> {
  const { db, clock } = deps;
  const agora = clock.agora();
  const cpf = somenteDigitos(e.cpf);

  if (!cpfValido(cpf)) return FALHA;
  if ((await cpfBloqueado(db, cpf, agora)) || (await ipBloqueado(db, e.ip, agora))) return FALHA;

  const usuario =
    e.tipo === 'MOTORISTA'
      ? await db.motorista.findUnique({ where: { cpf } })
      : await db.admin.findUnique({ where: { cpf } });

  // sempre faz uma verificação de hash para não vazar a existência do CPF pelo tempo de resposta
  hashFalso ??= hash('senha-falsa-para-temporizacao');
  const senhaOk = usuario
    ? await verify(usuario.senhaHash, e.senha).catch(() => false)
    : (await verify(await hashFalso, e.senha).catch(() => false), false);

  const temporariaVencida =
    !!usuario?.senhaTemporariaExpiraEm &&
    usuario.senhaTemporariaExpiraEm.getTime() <= agora.getTime();
  const sucesso = !!usuario && usuario.ativo && senhaOk && !temporariaVencida;

  await db.tentativaLogin.create({ data: { cpf, ip: e.ip, sucesso, instante: agora } });
  if (!sucesso || !usuario) return FALHA;

  const token = randomBytes(32).toString('base64url');
  const expiraEm = new Date(agora.getTime() + duracaoDaSessao(e.tipo));
  await db.sessao.create({
    data: {
      tipo: e.tipo,
      motoristaId: e.tipo === 'MOTORISTA' ? usuario.id : null,
      adminId: e.tipo === 'ADMIN' ? usuario.id : null,
      tokenHash: hashDoToken(token),
      criadaEm: agora,
      expiraEm,
    },
  });
  await db.auditoria.create({
    data: { atorTipo: e.tipo, atorId: usuario.id, acao: 'auth.login', instante: agora },
  });
  return {
    ok: true,
    token,
    expiraEm,
    tipo: e.tipo,
    usuarioId: usuario.id,
    nome: usuario.nome,
    deveTrocarSenha: usuario.deveTrocarSenha,
    papel: e.tipo === 'ADMIN' ? (usuario as { papel: 'ADMIN' | 'SUPER_ADMIN' }).papel : undefined,
  };
}

export interface UsuarioAutenticado {
  tipo: TipoUsuario;
  id: number;
  nome: string;
  deveTrocarSenha: boolean;
  papel?: 'ADMIN' | 'SUPER_ADMIN';
  sessaoId: number;
}

/**
 * Valida o cookie de sessão: existe, não expirou e o usuário continua ativo (RF06-CA2).
 * Sessão do motorista desliza (30 dias, no máximo uma gravação por hora); a do admin não renova.
 */
export async function validarSessao(
  deps: AuthDeps,
  token: string | undefined,
  tipoEsperado?: TipoUsuario,
): Promise<UsuarioAutenticado | null> {
  if (!token) return null;
  const { db, clock } = deps;
  const agora = clock.agora();
  const sessao = await db.sessao.findUnique({
    where: { tokenHash: hashDoToken(token) },
    include: { motorista: true, admin: true },
  });
  if (!sessao || sessao.expiraEm.getTime() <= agora.getTime()) return null;
  if (tipoEsperado && sessao.tipo !== tipoEsperado) return null;
  const usuario = sessao.tipo === 'MOTORISTA' ? sessao.motorista : sessao.admin;
  if (!usuario?.ativo) return null;

  if (sessao.tipo === 'MOTORISTA') {
    const novoFim = agora.getTime() + LIMITES.sessaoMotoristaMs;
    if (novoFim - sessao.expiraEm.getTime() >= LIMITES.renovacaoMinimaMs) {
      await db.sessao.update({ where: { id: sessao.id }, data: { expiraEm: new Date(novoFim) } });
    }
  }
  return {
    tipo: sessao.tipo,
    id: usuario.id,
    nome: usuario.nome,
    deveTrocarSenha: usuario.deveTrocarSenha,
    papel: sessao.tipo === 'ADMIN' ? sessao.admin!.papel : undefined,
    sessaoId: sessao.id,
  };
}

/** Logout: apaga a sessão e a inscrição de push do aparelho (RF04). */
export async function logout(
  deps: AuthDeps,
  token: string | undefined,
  endpointPush?: string,
): Promise<void> {
  if (token) await deps.db.sessao.deleteMany({ where: { tokenHash: hashDoToken(token) } });
  if (endpointPush)
    await deps.db.pushSubscription.deleteMany({ where: { endpoint: endpointPush } });
}

export type ResultadoTrocaDeSenha =
  { ok: true } | { ok: false; codigo: 'SENHA_CURTA' | 'IGUAL_A_ATUAL' | 'SENHA_ATUAL_INVALIDA' };

/** Troca obrigatória (ou voluntária) de senha. Remove o flag e a validade da temporária. */
export async function trocarSenha(
  deps: AuthDeps,
  e: { tipo: TipoUsuario; usuarioId: number; senhaAtual: string; novaSenha: string },
): Promise<ResultadoTrocaDeSenha> {
  const { db, clock } = deps;
  if (e.novaSenha.length < LIMITES.senhaMinima) return { ok: false, codigo: 'SENHA_CURTA' };
  const usuario =
    e.tipo === 'MOTORISTA'
      ? await db.motorista.findUniqueOrThrow({ where: { id: e.usuarioId } })
      : await db.admin.findUniqueOrThrow({ where: { id: e.usuarioId } });
  if (!(await verify(usuario.senhaHash, e.senhaAtual).catch(() => false))) {
    return { ok: false, codigo: 'SENHA_ATUAL_INVALIDA' };
  }
  if (e.senhaAtual === e.novaSenha) return { ok: false, codigo: 'IGUAL_A_ATUAL' };

  const data = {
    senhaHash: await hashDaSenha(e.novaSenha),
    deveTrocarSenha: false,
    senhaTemporariaExpiraEm: null,
  };
  if (e.tipo === 'MOTORISTA') await db.motorista.update({ where: { id: e.usuarioId }, data });
  else await db.admin.update({ where: { id: e.usuarioId }, data });
  await db.auditoria.create({
    data: {
      atorTipo: e.tipo,
      atorId: e.usuarioId,
      acao: 'auth.trocar_senha',
      instante: clock.agora(),
    },
  });
  return { ok: true };
}

type Tx = Prisma.TransactionClient;

async function revogarAcessos(tx: Tx, tipo: TipoUsuario, id: number) {
  if (tipo === 'MOTORISTA') {
    await tx.sessao.deleteMany({ where: { motoristaId: id } });
    await tx.pushSubscription.deleteMany({ where: { motoristaId: id } });
  } else {
    await tx.sessao.deleteMany({ where: { adminId: id } });
  }
}

/**
 * Redefinição pelo admin: gera senha temporária (72 h), força a troca, derruba sessões e
 * inscrições de push e zera o bloqueio de login do CPF (RF24-CA5, RF06-CA1).
 * Devolve a senha temporária para ser mostrada uma única vez.
 */
export async function redefinirSenha(
  deps: AuthDeps,
  e: { tipo: TipoUsuario; usuarioId: number; porAdminId: number | null },
): Promise<{ senhaTemporaria: string }> {
  const { db, clock } = deps;
  const agora = clock.agora();
  const senhaTemporaria = gerarSenhaTemporaria();
  const senhaHash = await hashDaSenha(senhaTemporaria);
  const data = {
    senhaHash,
    deveTrocarSenha: true,
    senhaTemporariaExpiraEm: new Date(agora.getTime() + LIMITES.senhaTemporariaMs),
  };
  await db.$transaction(async (tx) => {
    const usuario =
      e.tipo === 'MOTORISTA'
        ? await tx.motorista.update({ where: { id: e.usuarioId }, data })
        : await tx.admin.update({ where: { id: e.usuarioId }, data });
    await revogarAcessos(tx, e.tipo, e.usuarioId);
    await tx.tentativaLogin.deleteMany({ where: { cpf: usuario.cpf } });
    await tx.auditoria.create({
      data: {
        atorTipo: e.porAdminId ? 'ADMIN' : null,
        atorId: e.porAdminId,
        acao: 'auth.redefinir_senha',
        alvoTipo: e.tipo,
        alvoId: String(e.usuarioId),
        instante: agora,
      },
    });
  });
  return { senhaTemporaria };
}

/**
 * Desativa o usuário: derruba sessões e push; para motorista, cancela a senha ativa com
 * `MOTORISTA_DESATIVADO` e marca o resultado como visto (RF06-CA1, CA3).
 */
export async function desativarUsuario(
  deps: AuthDeps,
  e: { tipo: TipoUsuario; usuarioId: number; porAdminId: number },
): Promise<void> {
  const { db, clock } = deps;
  const agora = clock.agora();
  await db.$transaction(async (tx) => {
    if (e.tipo === 'MOTORISTA') {
      await tx.motorista.update({ where: { id: e.usuarioId }, data: { ativo: false } });
      const ativas = await tx.senha.findMany({
        where: {
          motoristaId: e.usuarioId,
          status: { in: ['AGUARDANDO', 'CHAMADA', 'EM_ATENDIMENTO'] },
        },
        select: { id: true },
      });
      for (const { id } of ativas) {
        await tx.senha.update({
          where: { id },
          data: {
            status: 'CANCELADA',
            motivoCancelamento: 'MOTORISTA_DESATIVADO',
            canceladaEm: agora,
            resultadoVistoEm: agora,
          },
        });
      }
    } else {
      const alvo = await tx.admin.findUniqueOrThrow({ where: { id: e.usuarioId } });
      if (alvo.papel === 'SUPER_ADMIN') throw new Error('O super-admin não pode ser desativado');
      await tx.admin.update({ where: { id: e.usuarioId }, data: { ativo: false } });
    }
    await revogarAcessos(tx, e.tipo, e.usuarioId);
    await tx.auditoria.create({
      data: {
        atorTipo: 'ADMIN',
        atorId: e.porAdminId,
        acao: 'cadastro.desativar',
        alvoTipo: e.tipo,
        alvoId: String(e.usuarioId),
        instante: agora,
      },
    });
  });
}
