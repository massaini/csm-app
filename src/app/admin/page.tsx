import { Button } from '@/components/ui/button';
import { sairAdmin } from '@/app/acesso-actions';
import { exigirAdmin } from '@/server/http-sessao';

export const metadata = { title: 'Fila ao Vivo · Painel CSM' };

/** Marcador de posição: a Fila ao Vivo (RF17) entra na fatia do painel admin. */
export default async function PaginaAdmin() {
  const admin = await exigirAdmin();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-base px-xl py-3xl">
      <p className="t-body-s text-text-secondary">
        {admin.papel === 'SUPER_ADMIN' ? 'Super-administrador' : 'Administrador'}
      </p>
      <h1 className="t-title-m">{admin.nome}</h1>
      <form action={sairAdmin} className="mt-auto max-w-xs">
        <Button type="submit" kind="secondary">
          Sair
        </Button>
      </form>
    </main>
  );
}
