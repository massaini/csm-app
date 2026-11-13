import { exigirMotorista } from '@/server/http-sessao';
import { AtivarNotificacoes } from './ativar';

export const metadata = { title: 'Notificações · CSM Fila Digital' };

/** RF05 — tela nova: pede a permissão de notificação com um gesto do usuário. */
export default async function PaginaNotificacoes() {
  await exigirMotorista();
  return <AtivarNotificacoes chavePublica={process.env.VAPID_PUBLIC_KEY ?? ''} />;
}
