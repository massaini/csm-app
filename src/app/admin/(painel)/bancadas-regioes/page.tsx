import { relogioSistema } from '@/domain/clock';
import { db } from '@/server/db';
import { dadosBancadasRegioes } from '@/server/cadastros';
import { exigirAdmin } from '@/server/http-sessao';
import { BancadasRegioes } from './bancadas-regioes';

export const metadata = { title: 'Bancadas e Regiões · Painel CSM' };

export default async function PaginaBancadasRegioes() {
  await exigirAdmin();
  const dados = await dadosBancadasRegioes({ db, clock: relogioSistema });
  return <BancadasRegioes dados={dados} />;
}
