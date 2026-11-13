import Link from 'next/link';

export const metadata = { title: 'Como instalar o app · CSM Fila Digital' };

/** RF23-CA2/CA3 — pública, com passo a passo para Android e iPhone. */
export default function PaginaInstalar() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col gap-xl px-xl py-3xl">
      <h1 className="t-title-l">Como instalar o app</h1>

      <section className="rounded-lg border border-border bg-surface p-base">
        <h2 className="t-title-s">Android (Chrome)</h2>
        <ol className="t-body-m mt-md list-decimal space-y-sm pl-xl text-text-secondary">
          <li>Abra este endereço no Chrome.</li>
          <li>Toque nos três pontos no canto superior direito.</li>
          <li>Toque em “Instalar app” ou “Adicionar à tela inicial”.</li>
          <li>Abra o app pelo ícone da CSM e faça login.</li>
        </ol>
      </section>

      <section className="rounded-lg border border-border bg-surface p-base">
        <h2 className="t-title-s">iPhone (Safari)</h2>
        <ol className="t-body-m mt-md list-decimal space-y-sm pl-xl text-text-secondary">
          <li>Abra este endereço no Safari (não use outro navegador).</li>
          <li>Toque no botão Compartilhar.</li>
          <li>Toque em “Adicionar à Tela de Início”.</li>
          <li>
            Abra o app pelo ícone da CSM e faça login. As notificações só funcionam com o app
            instalado.
          </li>
        </ol>
      </section>

      <Link
        href="/login"
        className="t-body-m mt-auto inline-flex min-h-[44px] items-center self-start text-primary underline"
      >
        Ir para o login
      </Link>
    </main>
  );
}
