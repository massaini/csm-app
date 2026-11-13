import type { Senha } from '@/generated/prisma/client';
import { limitesDoDia, ultimosDias } from '@/domain/dia';
import { formatarPlaca } from '@/domain/documentos';
import {
  mediaDoDiaMin,
  minutosExibidos,
  posicaoNaFila,
  temposDaSenha,
  textoFilaEstimada,
  textoProximidade,
  textoTempoEstimado,
  type TemposDaSenha,
} from '@/domain/fila';
import { estaAtiva, limiteDeChegada, statusEfetivo } from '@/domain/senha';
import { expirarVencidas, type Deps } from '@/server/senhas';

/** Dados da senha que as telas exibem (vêm do snapshot gravado na geração). */
export interface SenhaVisao {
  id: number;
  codigo: string;
  placa: string;
  galpaoNome: string;
  galpaoEndereco: string;
  bancada: string;
  rota: string;
  motoristaNome: string;
}

export interface GalpaoParaGerar {
  id: number;
  nome: string;
  endereco: string;
  local: { lat: number; lng: number; raioM: number };
  /** RF08-CA3: a região do motorista tem bancada ativa neste galpão */
  habilitado: boolean;
  /** RF08-CA5: "Fila estimada agora" */
  textoFila: string | null;
}

export type ResultadoFinal = 'CONCLUIDA' | 'ENCERRADA_SISTEMA' | 'EXPIRADA' | 'FIM_DO_DIA';

export type EstadoMotorista = { agora: string } & (
  | {
      tela: 'GERAR';
      nome: string;
      ultimaPlaca: string | null;
      ultimoGalpaoId: number | null;
      liberado: boolean;
      galpoes: GalpaoParaGerar[];
    }
  | {
      tela: 'AGUARDANDO';
      nome: string;
      senha: SenhaVisao;
      posicao: number;
      textoTempo: string;
      textoProximidade: string;
    }
  | {
      tela: 'CHAMADA';
      senha: SenhaVisao;
      prazoEm: string;
      /** prazo + carência: até quando "Estou a caminho" é aceito (RF13-CA4) */
      limiteEm: string;
      toleranciaMin: number;
    }
  | { tela: 'EM_ATENDIMENTO'; senha: SenhaVisao; chamadaEm: string; conferente: string | null }
  | {
      tela: 'RESULTADO';
      resultado: ResultadoFinal;
      senha: SenhaVisao;
      tempos: TemposDaSenha | null;
    }
);

function visao(s: Senha): SenhaVisao {
  return {
    id: s.id,
    codigo: s.codigo,
    placa: formatarPlaca(s.placa),
    galpaoNome: s.galpaoNome,
    galpaoEndereco: s.galpaoEndereco,
    bancada: s.bancadaIdentificacao,
    rota: `${s.regiaoCodigo} · ${s.regiaoNome}`,
    motoristaNome: s.motoristaNome,
  };
}

const hora = (d: Deps) => d.horaVirada ?? process.env.HORA_VIRADA ?? '00:00';

async function configuracao(deps: Deps) {
  return deps.db.configuracao.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

async function mediaDoGalpao(deps: Deps, galpaoId: number, dia: string) {
  const cfg = await configuracao(deps);
  const concluidas = await deps.db.senha.findMany({
    where: {
      galpaoId,
      dia,
      status: 'CONCLUIDA',
      chamadaEm: { not: null },
      concluidaEm: { not: null },
    },
    select: { chamadaEm: true, concluidaEm: true, concluidaPor: true },
  });
  return mediaDoDiaMin(
    concluidas.map((c) => ({
      chamadaEm: c.chamadaEm!,
      concluidaEm: c.concluidaEm!,
      concluidaPor: c.concluidaPor ?? 'MOTORISTA',
    })),
    cfg.tempoPadraoMin,
    cfg.ocupacaoMaxMin,
  );
}

function resultadoDe(s: Senha): ResultadoFinal | null {
  if (s.status === 'CONCLUIDA')
    return s.concluidaPor === 'SISTEMA' ? 'ENCERRADA_SISTEMA' : 'CONCLUIDA';
  if (s.status === 'CANCELADA' && s.motivoCancelamento === 'EXPIRADA') return 'EXPIRADA';
  if (s.status === 'CANCELADA' && s.motivoCancelamento === 'FIM_DO_DIA') return 'FIM_DO_DIA';
  return null;
}

function tempos(s: Senha): TemposDaSenha | null {
  if (s.status !== 'CONCLUIDA' || !s.chamadaEm || !s.concluidaEm) return null;
  return temposDaSenha({
    geradaEm: s.geradaEm,
    chamadaEm: s.chamadaEm,
    aCaminhoEm: s.aCaminhoEm,
    concluidaEm: s.concluidaEm,
    concluidaPor: s.concluidaPor ?? 'MOTORISTA',
  });
}

/**
 * Qual tela `/fila` mostra e com quais dados (RF07). Só lê: uma CHAMADA vencida aparece
 * como "perdeu a vez" pelo status efetivo, sem gravar.
 */
export async function estadoDoMotorista(deps: Deps, motoristaId: number): Promise<EstadoMotorista> {
  const { db, clock } = deps;
  const agora = clock.agora();
  const base = { agora: agora.toISOString() };
  const cfg = await configuracao(deps);
  const motorista = await db.motorista.findUniqueOrThrow({ where: { id: motoristaId } });
  const ultima = await db.senha.findFirst({
    where: { motoristaId },
    orderBy: [{ geradaEm: 'desc' }, { id: 'desc' }],
    include: { chamadaPorAdmin: { select: { nome: true } } },
  });

  if (ultima && estaAtiva(ultima.status)) {
    const efetivo = statusEfetivo(ultima, agora, cfg.carenciaSeg);
    if (efetivo.status === 'CANCELADA') {
      return {
        ...base,
        tela: 'RESULTADO',
        resultado: 'EXPIRADA',
        senha: visao(ultima),
        tempos: null,
      };
    }
    if (ultima.status === 'AGUARDANDO') {
      const fila = await db.senha.findMany({
        where: { bancadaId: ultima.bancadaId, status: 'AGUARDANDO' },
        orderBy: [{ geradaEm: 'asc' }, { id: 'asc' }],
        select: { id: true, geradaEm: true },
      });
      const posicao =
        posicaoNaFila(
          fila.map((f) => ({ id: String(f.id), geradaEm: f.geradaEm })),
          String(ultima.id),
        ) ?? 1;
      const media = await mediaDoGalpao(deps, ultima.galpaoId, limitesDoDia(agora, hora(deps)).dia);
      return {
        ...base,
        tela: 'AGUARDANDO',
        nome: motorista.nome,
        senha: visao(ultima),
        posicao,
        textoTempo: textoTempoEstimado(posicao, media),
        textoProximidade: textoProximidade(posicao),
      };
    }
    if (ultima.status === 'CHAMADA') {
      return {
        ...base,
        tela: 'CHAMADA',
        senha: visao(ultima),
        prazoEm: ultima.prazoEm!.toISOString(),
        limiteEm: limiteDeChegada(ultima.prazoEm!, cfg.carenciaSeg).toISOString(),
        toleranciaMin: ultima.toleranciaMinNaChamada ?? cfg.toleranciaMin,
      };
    }
    return {
      ...base,
      tela: 'EM_ATENDIMENTO',
      senha: visao(ultima),
      chamadaEm: ultima.chamadaEm!.toISOString(),
      conferente: ultima.chamadaPorAdmin?.nome ?? null,
    };
  }

  if (ultima && !ultima.resultadoVistoEm) {
    const resultado = resultadoDe(ultima);
    if (resultado) {
      return {
        ...base,
        tela: 'RESULTADO',
        resultado,
        senha: visao(ultima),
        tempos: tempos(ultima),
      };
    }
  }

  return {
    ...base,
    tela: 'GERAR',
    nome: motorista.nome,
    ...(await dadosParaGerar(deps, motoristaId)),
  };
}

async function dadosParaGerar(deps: Deps, motoristaId: number) {
  const { db, clock } = deps;
  const agora = clock.agora();
  const { dia } = limitesDoDia(agora, hora(deps));
  const motorista = await db.motorista.findUniqueOrThrow({ where: { id: motoristaId } });
  const galpoes = await db.galpao.findMany({
    where: { ativo: true },
    orderBy: { prefixoSenha: 'asc' },
    include: {
      local: true,
      mapeamentos: { where: { regiaoId: motorista.regiaoId }, include: { bancada: true } },
    },
  });
  const liberacao = await db.liberacaoGeofence.findFirst({
    where: { motoristaId, usadaEm: null, expiraEm: { gt: agora } },
  });

  const lista: GalpaoParaGerar[] = [];
  for (const g of galpoes) {
    const bancada = g.mapeamentos[0]?.bancada;
    const habilitado = !!bancada?.ativa;
    let textoFila: string | null = null;
    if (habilitado) {
      const n = await db.senha.count({ where: { bancadaId: bancada.id, status: 'AGUARDANDO' } });
      textoFila = textoFilaEstimada(n, await mediaDoGalpao(deps, g.id, dia));
    }
    lista.push({
      id: g.id,
      nome: g.nome,
      endereco: g.endereco,
      local: { lat: g.local.latitude, lng: g.local.longitude, raioM: g.local.raioMetros },
      habilitado,
      textoFila,
    });
  }
  return {
    ultimaPlaca: motorista.ultimaPlaca ? formatarPlaca(motorista.ultimaPlaca) : null,
    ultimoGalpaoId: motorista.ultimoGalpaoId,
    liberado: liberacao !== null,
    galpoes: lista,
  };
}

/**
 * Botão da tela de resultado (RF07-CA4): persiste a expiração se a senha ainda estiver
 * CHAMADA no banco e só então grava `resultadoVistoEm` (status persistido final).
 */
export async function marcarResultadoVisto(deps: Deps, motoristaId: number): Promise<void> {
  const { db, clock } = deps;
  await db.$transaction(async (tx) => {
    const agora = clock.agora();
    const cfg = await tx.configuracao.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
    await expirarVencidas(tx, agora, cfg.carenciaSeg, { motoristaId });
    const ultima = await tx.senha.findFirst({
      where: { motoristaId },
      orderBy: [{ geradaEm: 'desc' }, { id: 'desc' }],
    });
    if (ultima && !estaAtiva(ultima.status) && !ultima.resultadoVistoEm) {
      await tx.senha.update({ where: { id: ultima.id }, data: { resultadoVistoEm: agora } });
    }
  });
}

export interface ItemHistorico {
  id: number;
  geradaEm: string;
  codigo: string;
  bancada: string;
  regiaoCodigo: string;
  totalMin: number | null;
  status: 'CONCLUIDA' | 'CANCELADA';
}

/** RF15 — histórico do motorista nos últimos 90 dias operacionais. */
export async function historicoDoMotorista(deps: Deps, motoristaId: number) {
  const { db, clock } = deps;
  const { dia } = limitesDoDia(clock.agora(), hora(deps));
  const { diaInicio } = ultimosDias(dia, 90);
  const senhas = await db.senha.findMany({
    where: { motoristaId, status: { in: ['CONCLUIDA', 'CANCELADA'] }, dia: { gte: diaInicio } },
    orderBy: [{ geradaEm: 'desc' }, { id: 'desc' }],
  });
  const esperas = senhas
    .filter((s) => s.chamadaEm)
    .map((s) => s.chamadaEm!.getTime() - s.geradaEm.getTime());
  const itens: ItemHistorico[] = senhas.map((s) => ({
    id: s.id,
    geradaEm: s.geradaEm.toISOString(),
    codigo: s.codigo,
    bancada: s.bancadaIdentificacao,
    regiaoCodigo: s.regiaoCodigo,
    totalMin: tempos(s)?.totalMin ?? null,
    status: s.status as 'CONCLUIDA' | 'CANCELADA',
  }));
  return {
    atendimentos: senhas.filter((s) => s.status === 'CONCLUIDA').length,
    esperaMediaMin: esperas.length
      ? minutosExibidos(esperas.reduce((a, b) => a + b, 0) / esperas.length)
      : null,
    itens,
  };
}
