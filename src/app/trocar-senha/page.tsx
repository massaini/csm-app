import { Logo } from '@/components/ui/logo';
import { trocarSenhaMotorista } from '@/app/acesso-actions';
import { FormularioTrocaDeSenha } from '@/app/acesso/formulario-troca-de-senha';
import { exigirMotorista } from '@/server/http-sessao';

export const metadata = { title: 'Trocar senha · CSM Fila Digital' };

/** RF02 — troca obrigatória de senha no primeiro acesso (tela nova, montada com o DS). */
export default async function PaginaTrocarSenha() {
  await exigirMotorista({ permitirTrocaPendente: true });
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-xl pb-xl pt-3xl">
      <header className="flex flex-col items-center text-center">
        <Logo />
        <h1 className="t-title-l mt-xl">Crie sua nova senha</h1>
        <p className="t-body-m mt-md text-text-secondary">
          Por segurança, troque a senha temporária por uma só sua (mínimo de 8 caracteres).
        </p>
      </header>
      <FormularioTrocaDeSenha acao={trocarSenhaMotorista} />
    </main>
  );
}
