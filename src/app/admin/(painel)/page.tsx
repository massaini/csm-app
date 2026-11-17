import { relogioApp } from '@/server/relogio';
import { db } from '@/server/db';
import { lerConfiguracoes } from '@/server/cadastros';
import { exigirAdmin } from '@/server/http-sessao';
import { ConfiguracoesDaFila } from './configuracoes-da-fila';
import { FilaAoVivo } from './fila-ao-vivo';

export const metadata = { title: 'Fila ao Vivo · Painel CSM' };

export default async function PaginaFilaAoVivo() {
  await exigirAdmin();
  const cfg = await lerConfiguracoes({ db, clock: relogioApp });
  return <FilaAoVivo configuracoes={<ConfiguracoesDaFila inicial={cfg} />} />;
}
