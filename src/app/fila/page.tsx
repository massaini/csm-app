import { Button } from '@/components/ui/button';
import { sairMotorista } from '@/app/acesso-actions';
import { exigirMotorista } from '@/server/http-sessao';

export const metadata = { title: 'Fila · CSM Fila Digital' };

/** Marcador de posição: o fluxo da fila (RF07) entra na próxima fatia. */
export default async function PaginaFila() {
  const motorista = await exigirMotorista();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col gap-base px-xl py-3xl">
      <p className="t-body-s text-text-secondary">Olá, motorista</p>
      <h1 className="t-title-m">{motorista.nome}</h1>
      <form action={sairMotorista} className="mt-auto">
        <Button type="submit" kind="secondary">
          Sair
        </Button>
      </form>
    </main>
  );
}
