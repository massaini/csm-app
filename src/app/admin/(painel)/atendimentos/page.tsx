import { relogioSistema } from '@/domain/clock';
import { limitesDoDia, ultimosDias } from '@/domain/dia';
import { db } from '@/server/db';
import { HistoricoAtendimentos } from '../historicos';

export const metadata = { title: 'Histórico de Atendimentos · Painel CSM' };

export default async function PaginaAtendimentos() {
  const { dia } = limitesDoDia(relogioSistema.agora(), process.env.HORA_VIRADA ?? '00:00');
  const galpoes = await db.galpao.findMany({
    where: { ativo: true },
    orderBy: { prefixoSenha: 'asc' },
    select: { id: true, nome: true },
  });
  // RF20-CA3: padrão = últimos 7 dias operacionais, incluindo hoje
  return <HistoricoAtendimentos padrao={ultimosDias(dia, 7)} galpoes={galpoes} />;
}
