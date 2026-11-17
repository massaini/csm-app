import { relogioApp } from '@/server/relogio';
import { db } from '@/server/db';
import { dadosBancadasRegioes } from '@/server/cadastros';
import { exigirAdmin } from '@/server/http-sessao';
import { Bancadas } from './bancadas';

export const metadata = { title: 'Bancadas · Painel CSM' };

export default async function PaginaBancadas() {
  await exigirAdmin();
  const dados = await dadosBancadasRegioes({ db, clock: relogioApp });
  return <Bancadas dados={dados} />;
}
