import { relogioApp } from '@/server/relogio';
import { db } from '@/server/db';
import { dadosBancadasRegioes } from '@/server/cadastros';
import { exigirAdmin } from '@/server/http-sessao';
import { Regioes } from './regioes';

export const metadata = { title: 'Regiões · Painel CSM' };

export default async function PaginaRegioes() {
  await exigirAdmin();
  const dados = await dadosBancadasRegioes({ db, clock: relogioApp });
  return <Regioes dados={dados} />;
}
