import { relogioApp } from '@/server/relogio';
import { limitesDoDia, quinzenaDoDia, ultimosDias } from '@/domain/dia';
import { db } from '@/server/db';
import { Historico } from './historico';

export const metadata = { title: 'Histórico · Painel CSM' };

/** RF20 — Histórico. `?motorista=<id>` vem do "Ver histórico" (RF20-CA7): id interno, nunca CPF. */
export default async function PaginaHistorico({ searchParams }: PageProps<'/admin/historico'>) {
  const { dia } = limitesDoDia(relogioApp.agora(), process.env.HORA_VIRADA ?? '00:00');
  const { motorista } = await searchParams;
  const motoristaId = Number(typeof motorista === 'string' ? motorista : NaN);

  const [galpoes, rotas, doMotorista] = await Promise.all([
    db.galpao.findMany({
      where: { ativo: true },
      orderBy: { prefixoSenha: 'asc' },
      select: {
        id: true,
        nome: true,
        bancadas: { orderBy: { identificacao: 'asc' }, select: { id: true, identificacao: true } },
      },
    }),
    db.regiao.findMany({ orderBy: { codigo: 'asc' }, select: { codigo: true, nome: true } }),
    Number.isInteger(motoristaId) && motoristaId > 0
      ? db.motorista.findUnique({ where: { id: motoristaId }, select: { id: true, nome: true } })
      : null,
  ]);

  // RF20-CA3: padrão = últimos 7 dias operacionais, incluindo hoje
  const padrao = ultimosDias(dia, 7);
  const atalhos = [
    { rotulo: 'Hoje', diaInicio: dia, diaFim: dia },
    { rotulo: 'Últimos 7 dias', ...padrao },
    { rotulo: 'Quinzena atual', ...quinzenaDoDia(dia) },
  ];
  return (
    <Historico
      padrao={padrao}
      atalhos={atalhos}
      galpoes={galpoes}
      rotas={rotas}
      motorista={doMotorista}
    />
  );
}
