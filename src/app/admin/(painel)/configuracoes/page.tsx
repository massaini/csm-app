import { relogioApp } from '@/server/relogio';
import { db } from '@/server/db';
import { lerConfiguracoes } from '@/server/cadastros';
import { exigirAdmin } from '@/server/http-sessao';
import { Configuracoes } from './configuracoes';

export const metadata = { title: 'Configurações · Painel CSM' };

export default async function PaginaConfiguracoes() {
  await exigirAdmin();
  const cfg = await lerConfiguracoes({ db, clock: relogioApp });
  return <Configuracoes inicial={cfg} />;
}
