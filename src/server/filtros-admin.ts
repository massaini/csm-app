import { z } from 'zod';

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const ids = z.array(z.number().int().positive()).max(100).default([]);

/** RF31-CA1: a barra de busca pesquisa um campo de texto por vez (Nome por padrão). */
const busca = {
  texto: z.string().trim().max(60).default(''),
  campo: z.enum(['nome', 'codigo']).default('nome'),
};

export const esquemaFiltrosFila = z.object({
  ...busca,
  galpaoIds: ids,
  bancadaIds: ids,
  status: z
    .array(z.enum(['AGUARDANDO', 'CHAMADA', 'EM_ATENDIMENTO']))
    .max(3)
    .default([]),
});

/** Colunas do Histórico que ordenam no servidor (RF20-CA4). */
export const COLUNAS_HISTORICO = [
  'geradaEm',
  'codigo',
  'motorista',
  'galpao',
  'bancada',
  'rota',
  'status',
] as const;

export const STATUS_HISTORICO = ['AGUARDANDO', 'ATENDENDO', 'CONCLUIDA', 'CANCELADA'] as const;

export const esquemaFiltrosHistorico = z
  .object({
    ...busca,
    galpaoIds: ids,
    bancadaIds: ids,
    rotas: z.array(z.string().trim().max(20)).max(100).default([]),
    status: z.array(z.enum(STATUS_HISTORICO)).max(4).default([]),
    /** RF20-CA7: id interno do motorista ("Ver histórico"); nunca o CPF */
    motoristaId: z.number().int().positive().nullish(),
    diaInicio: dia,
    diaFim: dia,
    pagina: z.number().int().min(1).max(10_000).optional(),
    ordem: z
      .object({ coluna: z.enum(COLUNAS_HISTORICO), direcao: z.enum(['asc', 'desc']) })
      .default({ coluna: 'geradaEm', direcao: 'desc' }),
  })
  .refine((f) => f.diaInicio <= f.diaFim, { message: 'período invertido' });

export const esquemaConsulta = z.discriminatedUnion('tela', [
  z.object({ tela: z.literal('fila-ao-vivo'), filtros: esquemaFiltrosFila }),
  z.object({ tela: z.literal('historico'), filtros: esquemaFiltrosHistorico }),
]);

export type Consulta = z.input<typeof esquemaConsulta>;
export type FiltrosFila = z.input<typeof esquemaFiltrosFila>;
export type FiltrosHistorico = z.input<typeof esquemaFiltrosHistorico>;
export type ColunaHistorico = (typeof COLUNAS_HISTORICO)[number];
export type StatusHistorico = (typeof STATUS_HISTORICO)[number];
