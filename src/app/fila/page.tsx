import { relogioSistema } from '@/domain/clock';
import { db } from '@/server/db';
import { estadoDoMotorista } from '@/server/fila-motorista';
import { exigirMotorista } from '@/server/http-sessao';
import { TelaFila } from './tela-fila';

export const metadata = { title: 'Fila · CSM Fila Digital' };

/** RF07 — uma rota, várias telas: o estado da senha decide qual mostrar. */
export default async function PaginaFila() {
  const motorista = await exigirMotorista();
  const estado = await estadoDoMotorista({ db, clock: relogioSistema }, motorista.id);
  return <TelaFila inicial={estado} />;
}
