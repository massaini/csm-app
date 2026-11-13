import { z } from 'zod';

const opcionalNumero = z.coerce.number().int().positive().nullish();
const opcionalTexto = z.string().trim().max(60).nullish();
const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const esquemaFiltrosFila = z.object({
  galpaoId: opcionalNumero,
  bancadaId: opcionalNumero,
  motorista: opcionalTexto,
  codigo: opcionalTexto,
});

export const esquemaFiltrosPeriodo = z
  .object({
    galpaoId: opcionalNumero,
    motorista: opcionalTexto,
    codigo: opcionalTexto,
    diaInicio: dia,
    diaFim: dia,
    pagina: z.coerce.number().int().min(1).max(10_000).optional(),
  })
  .refine((f) => f.diaInicio <= f.diaFim, { message: 'período invertido' });

export const esquemaConsulta = z.discriminatedUnion('tela', [
  z.object({ tela: z.literal('fila-ao-vivo'), filtros: esquemaFiltrosFila }),
  z.object({ tela: z.literal('atendimentos'), filtros: esquemaFiltrosPeriodo }),
  z.object({ tela: z.literal('senhas'), filtros: esquemaFiltrosPeriodo }),
]);

export type Consulta = z.infer<typeof esquemaConsulta>;
