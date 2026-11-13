import { redirect } from 'next/navigation';
import { Logo } from '@/components/ui/logo';
import { entrarAdmin } from '@/app/acesso-actions';
import { FormularioLogin } from '@/app/acesso/formulario-login';
import { usuarioAtual } from '@/server/http-sessao';

export const metadata = { title: 'Painel · CSM Fila Digital' };

/** RF03 — login do admin (tela nova no DS). */
export default async function PaginaLoginAdmin() {
  if (await usuarioAtual('ADMIN')) redirect('/admin');
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col px-xl pb-xl pt-3xl">
      <header className="flex flex-col items-center text-center">
        <Logo />
        <p className="t-overline mt-xl text-primary">Painel administrativo</p>
        <h1 className="t-title-l mt-md">Acesse o painel</h1>
        <p className="t-body-m mt-md text-text-secondary">Informe seu CPF e sua senha.</p>
      </header>
      <FormularioLogin acao={entrarAdmin} />
    </main>
  );
}
