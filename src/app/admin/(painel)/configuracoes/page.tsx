import { redirect } from 'next/navigation';

/** As configurações ficam no fim da Fila ao Vivo (RF26-CA3); o endereço antigo leva para lá. */
export default function PaginaConfiguracoes() {
  redirect('/admin#configuracoes');
}
