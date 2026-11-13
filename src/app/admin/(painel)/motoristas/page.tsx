import { relogioApp } from '@/server/relogio';
import { db } from '@/server/db';
import { listarMotoristas } from '@/server/cadastros';
import { exigirAdmin } from '@/server/http-sessao';
import { Motoristas } from './motoristas';

export const metadata = { title: 'Motoristas · Painel CSM' };

export default async function PaginaMotoristas() {
  await exigirAdmin();
  const [inicial, regioes] = await Promise.all([
    listarMotoristas({ db, clock: relogioApp }),
    db.regiao.findMany({
      where: { ativa: true },
      orderBy: { codigo: 'asc' },
      select: { id: true, codigo: true, nome: true },
    }),
  ]);
  return <Motoristas inicial={inicial} regioes={regioes} />;
}
