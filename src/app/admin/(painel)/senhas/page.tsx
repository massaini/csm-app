import { redirect } from 'next/navigation';

/** Os dois históricos viraram um só (RF20, P28); o endereço antigo continua funcionando. */
export default function Redirecionar() {
  redirect('/admin/historico');
}
