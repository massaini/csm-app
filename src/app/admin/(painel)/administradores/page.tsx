import { relogioSistema } from '@/domain/clock';
import { db } from '@/server/db';
import { listarAdmins } from '@/server/cadastros';
import { exigirAdmin } from '@/server/http-sessao';
import { Administradores } from './administradores';

export const metadata = { title: 'Administradores · Painel CSM' };

/** RF27 — só o super-admin; um ADMIN é levado de volta à Fila ao Vivo (RF27-CA2). */
export default async function PaginaAdministradores() {
  const eu = await exigirAdmin({ apenasSuper: true });
  const admins = await listarAdmins({ db, clock: relogioSistema });
  return <Administradores admins={admins} meuId={eu.id} />;
}
