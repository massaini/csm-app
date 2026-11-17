import { redirect } from 'next/navigation';

/** A tela foi dividida em Bancadas e Regiões (RF25); o endereço antigo leva para Bancadas. */
export default function PaginaBancadasRegioes() {
  redirect('/admin/bancadas');
}
