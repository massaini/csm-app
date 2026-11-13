import { Sidebar } from '@/components/admin/sidebar';
import { sairAdmin } from '@/app/acesso-actions';
import { exigirAdmin } from '@/server/http-sessao';

/** Layout das telas do painel (`04 · Administrador`): Sidebar 260 px + conteúdo. */
export default async function LayoutPainel({ children }: LayoutProps<'/admin'>) {
  const admin = await exigirAdmin();
  return (
    <div className="flex min-h-dvh">
      <Sidebar nome={admin.nome} papel={admin.papel ?? 'ADMIN'} sair={sairAdmin} />
      <div className="min-w-0 flex-1 px-3xl py-2xl">{children}</div>
    </div>
  );
}
