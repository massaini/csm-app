import Link from 'next/link';

export const metadata = { title: 'Termos de uso · CSM Fila Digital' };

/** Texto jurídico fornecido pela CSM (dependência do go-live, PRD P14). */
export default function PaginaTermos() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col gap-base px-xl py-3xl">
      <h1 className="t-title-l">Termos de uso</h1>
      <p className="t-body-m text-text-secondary">
        O texto dos termos de uso da CSM será publicado aqui antes do lançamento.
      </p>
      <Link href="/login" className="t-body-m mt-auto text-primary underline">
        Voltar
      </Link>
    </main>
  );
}
