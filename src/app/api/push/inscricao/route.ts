import { NextResponse } from 'next/server';
import { z } from 'zod';
import { relogioApp } from '@/server/relogio';
import { db } from '@/server/db';
import { usuarioAtual } from '@/server/http-sessao';
import { inscrever } from '@/server/push';

export const dynamic = 'force-dynamic';

const esquema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({ p256dh: z.string().min(1).max(256), auth: z.string().min(1).max(128) }),
});

/** RF05-CA1/CA2 — upsert da inscrição de push do aparelho para o motorista logado. */
export async function POST(req: Request) {
  const motorista = await usuarioAtual('MOTORISTA');
  if (!motorista) return NextResponse.json({ erro: 'nao_autenticado' }, { status: 401 });
  const corpo = esquema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: 'inscricao_invalida' }, { status: 400 });
  await inscrever({ db, clock: relogioApp }, motorista.id, corpo.data);
  return NextResponse.json({ ok: true });
}
