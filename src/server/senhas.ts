import { Prisma, type PrismaClient, type Senha } from '@/generated/prisma/client';
import type { Clock } from '@/domain/clock';
import { limitesDoDia, codigoSenha } from '@/domain/dia';
import { normalizarPlaca, placaValida } from '@/domain/documentos';
import { avaliarGeofence } from '@/domain/geofence';

export interface Deps {
  db: PrismaClient;
  clock: Clock;
  /** HORA_VIRADA, "HH:MM" */
  horaVirada?: string;
}

type Tx = Prisma.TransactionClient;

export type CodigoResultado =
  'OK' | 'CONFLITO' | 'FORA_DO_RAIO' | 'SEM_BANCADA' | 'PLACA_INVALIDA' | 'NAO_ENCONTRADO';

export interface Resultado {
  ok: boolean;
  codigo: CodigoResultado;
  /** estado atual da senha, para a UI renderizar em vez de mostrar erro (PRD §6.0) */
  senha?: Senha | null;
}

/** Folga para rajadas de conexões simultâneas (PRD RNF01). */
const TX = { maxWait: 15_000, timeout: 30_000 } as const;
const ATIVAS = ['AGUARDANDO', 'CHAMADA', 'EM_ATENDIMENTO'] as const;
const hora = (d: Deps) => d.horaVirada ?? process.env.HORA_VIRADA ?? '00:00';

async function configuracao(tx: Tx) {
  return tx.configuracao.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

async function auditar(
  tx: Tx,
  agora: Date,
  ator: { tipo: 'MOTORISTA' | 'ADMIN'; id: number } | null,
  acao: string,
  senhaId: number | string,
  dados?: Prisma.InputJsonValue,
) {
  await tx.auditoria.create({
    data: {
      atorTipo: ator?.tipo ?? null,
      atorId: ator?.id ?? null,
      acao,
      alvoTipo: 'Senha',
      alvoId: String(senhaId),
      dados: dados ?? Prisma.JsonNull,
      instante: agora,
    },
  });
}

/**
 * Persiste a expiração de CHAMADAs vencidas (prazo + carência), com auditoria por senha.
 * Idempotente e segura com 2 instâncias: só audita quem ela mesma transitou.
 */
export async function expirarVencidas(
  tx: Tx,
  agora: Date,
  carenciaSeg: number,
  filtro: Prisma.SenhaWhereInput = {},
): Promise<number> {
  const limite = new Date(agora.getTime() - carenciaSeg * 1000);
  const vencidas = await tx.senha.findMany({
    where: { status: 'CHAMADA', prazoEm: { lt: limite }, ...filtro },
    select: { id: true },
  });
  let total = 0;
  for (const { id } of vencidas) {
    const r = await tx.senha.updateMany({
      where: { id, status: 'CHAMADA', prazoEm: { lt: limite } },
      data: { status: 'CANCELADA', motivoCancelamento: 'EXPIRADA', canceladaEm: agora },
    });
    if (r.count === 1) {
      total++;
      await auditar(tx, agora, null, 'senha.expirar', id);
    }
  }
  return total;
}

export interface GerarSenhaEntrada {
  motoristaId: number;
  galpaoId: number;
  placa: string;
  /** null quando o GPS falhou, foi negado ou deu timeout */
  leitura: { lat: number; lng: number; precisaoM: number } | null;
}

export async function gerarSenha(deps: Deps, e: GerarSenhaEntrada): Promise<Resultado> {
  const { db, clock } = deps;
  if (!placaValida(e.placa)) return { ok: false, codigo: 'PLACA_INVALIDA' };
  const placa = normalizarPlaca(e.placa);

  try {
    return await db.$transaction(async (tx) => {
      const agora = clock.agora();
      const cfg = await configuracao(tx);
      await expirarVencidas(tx, agora, cfg.carenciaSeg, { motoristaId: e.motoristaId });

      const ativa = await tx.senha.findFirst({
        where: { motoristaId: e.motoristaId, status: { in: [...ATIVAS] } },
      });
      if (ativa) return { ok: false, codigo: 'CONFLITO', senha: ativa } as Resultado;

      const motorista = await tx.motorista.findUnique({
        where: { id: e.motoristaId },
        include: { regiao: true },
      });
      const galpao = await tx.galpao.findUnique({
        where: { id: e.galpaoId },
        include: { local: true },
      });
      if (!motorista?.ativo || !galpao?.ativo) return { ok: false, codigo: 'NAO_ENCONTRADO' };

      const mapa = await tx.regiaoBancada.findUnique({
        where: { galpaoId_regiaoId: { galpaoId: galpao.id, regiaoId: motorista.regiaoId } },
        include: { bancada: true },
      });
      if (!mapa?.bancada.ativa) return { ok: false, codigo: 'SEM_BANCADA' };

      const liberacao = await tx.liberacaoGeofence.findFirst({
        where: { motoristaId: motorista.id, usadaEm: null, expiraEm: { gt: agora } },
        orderBy: { criadaEm: 'asc' },
      });
      const geo = avaliarGeofence({
        leitura: e.leitura
          ? { posicao: { lat: e.leitura.lat, lng: e.leitura.lng }, precisaoM: e.leitura.precisaoM }
          : null,
        local: { lat: galpao.local.latitude, lng: galpao.local.longitude },
        raioM: galpao.local.raioMetros,
        liberadoPeloAdmin: liberacao !== null,
      });
      if (!geo.podeGerar) return { ok: false, codigo: 'FORA_DO_RAIO' };

      const { dia } = limitesDoDia(agora, hora(deps));
      const [{ ultimo }] = await tx.$queryRaw<{ ultimo: number }[]>`
        INSERT INTO "ContadorSenha" ("galpaoId", "dia", "ultimo")
        VALUES (${galpao.id}, ${dia}, 1)
        ON CONFLICT ("galpaoId", "dia") DO UPDATE SET "ultimo" = "ContadorSenha"."ultimo" + 1
        RETURNING "ultimo"`;

      const senha = await tx.senha.create({
        data: {
          codigo: codigoSenha(galpao.prefixoSenha, ultimo),
          dia,
          motoristaId: motorista.id,
          galpaoId: galpao.id,
          bancadaId: mapa.bancadaId,
          placa,
          motoristaNome: motorista.nome,
          galpaoNome: galpao.nome,
          galpaoEndereco: galpao.endereco,
          bancadaIdentificacao: mapa.bancada.identificacao,
          regiaoCodigo: motorista.regiao.codigo,
          regiaoNome: motorista.regiao.nome,
          geradaEm: agora,
          lat: e.leitura?.lat ?? null,
          lng: e.leitura?.lng ?? null,
          precisaoM: e.leitura?.precisaoM ?? null,
          distanciaM: geo.distanciaM,
          liberacaoId: liberacao?.id ?? null,
        },
      });
      if (liberacao) {
        await tx.liberacaoGeofence.update({
          where: { id: liberacao.id },
          data: { usadaEm: agora },
        });
      }
      await tx.motorista.update({
        where: { id: motorista.id },
        data: { ultimaPlaca: placa, ultimoGalpaoId: galpao.id },
      });
      await auditar(tx, agora, { tipo: 'MOTORISTA', id: motorista.id }, 'senha.gerar', senha.id);
      return { ok: true, codigo: 'OK', senha } as Resultado;
    }, TX);
  } catch (erro) {
    // duas gerações simultâneas do mesmo motorista: o índice parcial barra a segunda
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
      const existente = await db.senha.findFirst({
        where: { motoristaId: e.motoristaId, status: { in: [...ATIVAS] } },
      });
      return { ok: false, codigo: 'CONFLITO', senha: existente };
    }
    throw erro;
  }
}

export async function chamarSenha(
  deps: Deps,
  e: { senhaId: number; adminId: number },
): Promise<Resultado> {
  const { db, clock } = deps;
  try {
    return await db.$transaction(async (tx) => {
      const agora = clock.agora();
      const cfg = await configuracao(tx);
      const atual = await tx.senha.findUnique({ where: { id: e.senhaId } });
      if (!atual) return { ok: false, codigo: 'NAO_ENCONTRADO' } as Resultado;
      if (atual.status !== 'AGUARDANDO') {
        return { ok: false, codigo: 'CONFLITO', senha: atual } as Resultado;
      }
      // um ocupante com chamada vencida libera a bancada
      await expirarVencidas(tx, agora, cfg.carenciaSeg, { bancadaId: atual.bancadaId });

      const aFrente = await tx.senha.count({
        where: {
          bancadaId: atual.bancadaId,
          status: 'AGUARDANDO',
          OR: [
            { geradaEm: { lt: atual.geradaEm } },
            { geradaEm: atual.geradaEm, id: { lt: atual.id } },
          ],
        },
      });
      const r = await tx.senha.updateMany({
        where: { id: atual.id, status: 'AGUARDANDO' },
        data: {
          status: 'CHAMADA',
          chamadaEm: agora,
          chamadaPorAdminId: e.adminId,
          prazoEm: new Date(agora.getTime() + cfg.toleranciaMin * 60_000),
          toleranciaMinNaChamada: cfg.toleranciaMin,
          foraDeOrdem: aFrente > 0,
        },
      });
      const senha = await tx.senha.findUnique({ where: { id: atual.id } });
      if (r.count === 0) return { ok: false, codigo: 'CONFLITO', senha } as Resultado;
      await auditar(tx, agora, { tipo: 'ADMIN', id: e.adminId }, 'senha.chamar', atual.id, {
        foraDeOrdem: aFrente > 0,
        aFrente,
      });
      return { ok: true, codigo: 'OK', senha } as Resultado;
    }, TX);
  } catch (erro) {
    // bancada já ocupada: o índice parcial barra a segunda chamada
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
      const senha = await db.senha.findUnique({ where: { id: e.senhaId } });
      return { ok: false, codigo: 'CONFLITO', senha };
    }
    throw erro;
  }
}

/** "Estou a caminho" (motorista) ou "Confirmar chegada" (admin). */
export async function confirmarChegada(
  deps: Deps,
  e: {
    senhaId: number;
    por: { tipo: 'MOTORISTA'; motoristaId: number } | { tipo: 'ADMIN'; adminId: number };
  },
): Promise<Resultado> {
  const { db, clock } = deps;
  return db.$transaction(async (tx) => {
    const agora = clock.agora();
    const cfg = await configuracao(tx);
    const atual = await tx.senha.findUnique({ where: { id: e.senhaId } });
    if (!atual) return { ok: false, codigo: 'NAO_ENCONTRADO' } as Resultado;
    if (e.por.tipo === 'MOTORISTA' && atual.motoristaId !== e.por.motoristaId) {
      return { ok: false, codigo: 'NAO_ENCONTRADO' } as Resultado;
    }
    // escrita sobre senha vencida persiste a expiração antes (status efetivo)
    await expirarVencidas(tx, agora, cfg.carenciaSeg, { id: atual.id });
    const r = await tx.senha.updateMany({
      where: {
        id: atual.id,
        status: 'CHAMADA',
        prazoEm: { gte: new Date(agora.getTime() - cfg.carenciaSeg * 1000) },
      },
      data: {
        status: 'EM_ATENDIMENTO',
        aCaminhoEm: agora,
        aCaminhoPor: e.por.tipo,
        aCaminhoAdminId: e.por.tipo === 'ADMIN' ? e.por.adminId : null,
      },
    });
    const senha = await tx.senha.findUnique({ where: { id: atual.id } });
    if (r.count === 0) return { ok: false, codigo: 'CONFLITO', senha } as Resultado;
    await auditar(
      tx,
      agora,
      e.por.tipo === 'ADMIN'
        ? { tipo: 'ADMIN', id: e.por.adminId }
        : { tipo: 'MOTORISTA', id: e.por.motoristaId },
      'senha.confirmar_chegada',
      atual.id,
    );
    return { ok: true, codigo: 'OK', senha } as Resultado;
  });
}

export async function concluirSenha(
  deps: Deps,
  e: {
    senhaId: number;
    por: { tipo: 'MOTORISTA'; motoristaId: number } | { tipo: 'ADMIN'; adminId: number };
  },
): Promise<Resultado> {
  const { db, clock } = deps;
  return db.$transaction(async (tx) => {
    const agora = clock.agora();
    const atual = await tx.senha.findUnique({ where: { id: e.senhaId } });
    if (!atual) return { ok: false, codigo: 'NAO_ENCONTRADO' } as Resultado;
    if (e.por.tipo === 'MOTORISTA' && atual.motoristaId !== e.por.motoristaId) {
      return { ok: false, codigo: 'NAO_ENCONTRADO' } as Resultado;
    }
    const r = await tx.senha.updateMany({
      where: { id: atual.id, status: 'EM_ATENDIMENTO' },
      data: {
        status: 'CONCLUIDA',
        concluidaEm: agora,
        concluidaPor: e.por.tipo,
        concluidaAdminId: e.por.tipo === 'ADMIN' ? e.por.adminId : null,
      },
    });
    const senha = await tx.senha.findUnique({ where: { id: atual.id } });
    if (r.count === 0) return { ok: false, codigo: 'CONFLITO', senha } as Resultado;
    await auditar(
      tx,
      agora,
      e.por.tipo === 'ADMIN'
        ? { tipo: 'ADMIN', id: e.por.adminId }
        : { tipo: 'MOTORISTA', id: e.por.motoristaId },
      'senha.concluir',
      atual.id,
    );
    return { ok: true, codigo: 'OK', senha } as Resultado;
  });
}

/** Cancelamento pelo próprio motorista: só em AGUARDANDO. */
export async function cancelarPeloMotorista(
  deps: Deps,
  e: { senhaId: number; motoristaId: number },
): Promise<Resultado> {
  const { db, clock } = deps;
  return db.$transaction(async (tx) => {
    const agora = clock.agora();
    const atual = await tx.senha.findFirst({
      where: { id: e.senhaId, motoristaId: e.motoristaId },
    });
    if (!atual) return { ok: false, codigo: 'NAO_ENCONTRADO' } as Resultado;
    const r = await tx.senha.updateMany({
      where: { id: atual.id, status: 'AGUARDANDO' },
      data: {
        status: 'CANCELADA',
        motivoCancelamento: 'MOTORISTA',
        canceladaEm: agora,
        resultadoVistoEm: agora,
      },
    });
    const senha = await tx.senha.findUnique({ where: { id: atual.id } });
    if (r.count === 0) return { ok: false, codigo: 'CONFLITO', senha } as Resultado;
    await auditar(tx, agora, { tipo: 'MOTORISTA', id: e.motoristaId }, 'senha.cancelar', atual.id);
    return { ok: true, codigo: 'OK', senha } as Resultado;
  });
}

export interface ResumoDaVarredura {
  expiradas: number;
  canceladasNaVirada: number;
  concluidasNaVirada: number;
}

/**
 * Job de 30 s: expira CHAMADAs vencidas e aplica a virada do dia (RF28-CA1).
 * Idempotente; segura com 2 processos simultâneos (cada transição só conta/audita uma vez).
 */
export async function varrer(deps: Deps): Promise<ResumoDaVarredura> {
  const { db, clock } = deps;
  return db.$transaction(async (tx) => {
    const agora = clock.agora();
    const cfg = await configuracao(tx);
    const { dia, inicio } = limitesDoDia(agora, hora(deps));

    const expiradas = await expirarVencidas(tx, agora, cfg.carenciaSeg);

    const aguardando = await tx.senha.findMany({
      where: { status: 'AGUARDANDO', dia: { lt: dia } },
      select: { id: true },
    });
    let canceladasNaVirada = 0;
    for (const { id } of aguardando) {
      const r = await tx.senha.updateMany({
        where: { id, status: 'AGUARDANDO' },
        data: { status: 'CANCELADA', motivoCancelamento: 'FIM_DO_DIA', canceladaEm: inicio },
      });
      if (r.count === 1) {
        canceladasNaVirada++;
        await auditar(tx, agora, null, 'senha.fim_do_dia', id);
      }
    }

    const emAtendimento = await tx.senha.findMany({
      where: { status: 'EM_ATENDIMENTO', aCaminhoEm: { lt: inicio } },
      select: { id: true },
    });
    let concluidasNaVirada = 0;
    for (const { id } of emAtendimento) {
      const r = await tx.senha.updateMany({
        where: { id, status: 'EM_ATENDIMENTO', aCaminhoEm: { lt: inicio } },
        data: { status: 'CONCLUIDA', concluidaEm: inicio, concluidaPor: 'SISTEMA' },
      });
      if (r.count === 1) {
        concluidasNaVirada++;
        await auditar(tx, agora, null, 'senha.concluir_sistema', id);
      }
    }
    return { expiradas, canceladasNaVirada, concluidasNaVirada };
  });
}
