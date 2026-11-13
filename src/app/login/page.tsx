import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/ui/logo';
import { entrarMotorista } from '@/app/acesso-actions';
import { FormularioLogin } from '@/app/acesso/formulario-login';
import { usuarioAtual } from '@/server/http-sessao';

export const metadata = { title: 'Entrar · CSM Fila Digital' };

/** Tela `10:2` — Identificação. */
export default async function PaginaLogin() {
  if (await usuarioAtual('MOTORISTA')) redirect('/fila');
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-xl pb-xl pt-3xl">
      <header className="flex flex-col items-center text-center">
        <Logo />
        <p className="t-overline mt-xl text-primary">Bem-vindo</p>
        <h1 className="t-title-l mt-md">
          Identifique-se
          <br />
          para continuar
        </h1>
        <p className="t-body-m mt-md text-text-secondary">
          Informe seu CPF e sua senha para acessar sua fila.
        </p>
      </header>
      <FormularioLogin acao={entrarMotorista} />
      <footer className="mt-base text-center">
        <p className="t-caption text-text-muted">
          Ao continuar você concorda com os{' '}
          <Link href="/termos" className="underline">
            termos de uso da CSM
          </Link>
        </p>
        <Link
          href="/instalar"
          className="t-caption mt-xs inline-flex min-h-[44px] items-center text-primary underline"
        >
          Como instalar o app
        </Link>
      </footer>
    </main>
  );
}
