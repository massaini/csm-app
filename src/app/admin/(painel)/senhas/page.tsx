import { relogioSistema } from '@/domain/clock';
import { limitesDoDia, quinzenaDoDia } from '@/domain/dia';
import { db } from '@/server/db';
import { HistoricoSenhas } from '../historicos';

export const metadata = { title: 'Histórico de Senhas · Painel CSM' };

export default async function PaginaSenhas() {
  const { dia } = limitesDoDia(relogioSistema.agora(), process.env.HORA_VIRADA ?? '00:00');
  const galpoes = await db.galpao.findMany({
    where: { ativo: true },
    orderBy: { prefixoSenha: 'asc' },
    select: { id: true, nome: true },
  });
  const q = quinzenaDoDia(dia); // RF21-CA3: padrão = quinzena atual
  return <HistoricoSenhas padrao={q} galpoes={galpoes} />;
}
