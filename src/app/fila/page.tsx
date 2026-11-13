import { relogioApp } from '@/server/relogio';
import { db } from '@/server/db';
import { estadoDoMotorista } from '@/server/fila-motorista';
import { exigirMotorista } from '@/server/http-sessao';
import { TelaFila } from './tela-fila';

export const metadata = { title: 'Fila · CSM Fila Digital' };

/** RF07 — uma rota, várias telas: o estado da senha decide qual mostrar. */
export default async function PaginaFila({ searchParams }: PageProps<'/fila'>) {
  const motorista = await exigirMotorista();
  const estado = await estadoDoMotorista({ db, clock: relogioApp }, motorista.id);
  const { entrou } = await searchParams;
  return (
    <TelaFila
      inicial={estado}
      chavePublica={process.env.VAPID_PUBLIC_KEY ?? ''}
      acabouDeEntrar={entrou === '1'}
    />
  );
}
