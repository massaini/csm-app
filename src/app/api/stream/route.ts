import { ouvinte, type EventoFila } from '@/server/realtime';
import { usuarioAtual } from '@/server/http-sessao';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HEARTBEAT_MS = 20_000;

/**
 * SSE (PRD §9.2): os eventos só invalidam; o cliente refaz o fetch do estado leve.
 * `?perfil=admin` usa a sessão do painel; sem parâmetro, a do motorista.
 */
export async function GET(req: Request) {
  const admin = new URL(req.url).searchParams.get('perfil') === 'admin';
  const usuario = await usuarioAtual(admin ? 'ADMIN' : 'MOTORISTA');
  if (!usuario) return new Response('nao_autenticado', { status: 401 });

  ouvinte.iniciar();
  const enc = new TextEncoder();
  let encerrar = () => {};

  const corpo = new ReadableStream<Uint8Array>({
    start(controle) {
      const enviar = (texto: string) => {
        try {
          controle.enqueue(enc.encode(texto));
        } catch {
          encerrar();
        }
      };
      const aoEvento = (e: EventoFila) => enviar(`data: ${JSON.stringify(e)}\n\n`);
      const batida = setInterval(() => enviar(': ping\n\n'), HEARTBEAT_MS);
      ouvinte.on('evento', aoEvento);
      encerrar = () => {
        clearInterval(batida);
        ouvinte.off('evento', aoEvento);
        try {
          controle.close();
        } catch {
          /* já fechado */
        }
      };
      req.signal.addEventListener('abort', () => encerrar());
      enviar('retry: 3000\n: conectado\n\n');
    },
    cancel() {
      encerrar();
    },
  });

  return new Response(corpo, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    },
  });
}
