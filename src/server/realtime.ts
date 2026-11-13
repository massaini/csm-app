import { EventEmitter } from 'node:events';
import { Client } from 'pg';
import type { Prisma, PrismaClient } from '@/generated/prisma/client';

export const CANAL = 'fila_eventos';

export interface EventoFila {
  /** "invalidar" = algo mudou; "tudo" = a conexão LISTEN caiu e voltou (pode ter perdido eventos) */
  tipo: 'invalidar' | 'tudo';
  galpaoId?: number;
  senhaId?: number;
}

/**
 * Publica um evento. Dentro de uma transação, o Postgres só entrega o NOTIFY no commit,
 * então ninguém recarrega um estado que ainda não existe.
 */
export async function notificar(
  db: PrismaClient | Prisma.TransactionClient,
  e: { galpaoId?: number; senhaId?: number },
) {
  const carga = JSON.stringify({ tipo: 'invalidar', ...e } satisfies EventoFila);
  await db.$executeRaw`SELECT pg_notify(${CANAL}, ${carga})`;
}

/**
 * Uma conexão `LISTEN` por processo, que repassa os eventos para quem estiver ouvindo (SSE).
 * Reconecta com backoff e emite "tudo" ao voltar, porque eventos podem ter se perdido.
 */
class Ouvinte extends EventEmitter {
  private cliente: Client | null = null;
  private tentativas = 0;
  private iniciado = false;

  iniciar(url = process.env.DATABASE_URL) {
    if (this.iniciado || !url) return;
    this.iniciado = true;
    this.setMaxListeners(0);
    void this.conectar(url);
  }

  private async conectar(url: string) {
    const c = new Client({ connectionString: url });
    c.on('notification', (n) => {
      if (n.channel !== CANAL || !n.payload) return;
      try {
        this.emit('evento', JSON.parse(n.payload) as EventoFila);
      } catch {
        /* carga inválida: ignora */
      }
    });
    c.on('error', () => this.reconectar(url, c));
    c.on('end', () => this.reconectar(url, c));
    try {
      await c.connect();
      await c.query(`LISTEN ${CANAL}`);
      this.cliente = c;
      if (this.tentativas > 0) this.emit('evento', { tipo: 'tudo' } satisfies EventoFila);
      this.tentativas = 0;
    } catch {
      this.reconectar(url, c);
    }
  }

  private reconectar(url: string, c: Client) {
    if (this.cliente && this.cliente !== c) return;
    this.cliente = null;
    c.removeAllListeners();
    c.end().catch(() => {});
    const espera = Math.min(30_000, 1_000 * 2 ** this.tentativas++);
    setTimeout(() => void this.conectar(url), espera).unref?.();
  }
}

const global_ = globalThis as unknown as { __csmOuvinte?: Ouvinte };
/** Singleton por processo (sobrevive ao HMR em desenvolvimento). */
export const ouvinte = (global_.__csmOuvinte ??= new Ouvinte());
