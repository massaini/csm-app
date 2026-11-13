import { NextResponse } from 'next/server';
import { db } from '@/server/db';
import { adiantarRelogio, relogioApp, relogioControlavel, zerarRelogio } from '@/server/relogio';
import { varrer } from '@/server/senhas';

export const dynamic = 'force-dynamic';

/**
 * Controle dos testes ponta a ponta. Só existe com `E2E=1`; em qualquer outro ambiente
 * responde 404 como se a rota não existisse.
 */
export async function POST(req: Request) {
  if (!relogioControlavel()) return new NextResponse(null, { status: 404 });
  const corpo = (await req.json().catch(() => ({}))) as {
    adiantarMs?: number;
    zerar?: boolean;
    varrer?: boolean;
  };
  if (corpo.zerar) zerarRelogio();
  if (typeof corpo.adiantarMs === 'number') adiantarRelogio(corpo.adiantarMs);
  const varredura = corpo.varrer ? await varrer({ db, clock: relogioApp }) : null;
  return NextResponse.json({ agora: relogioApp.agora().toISOString(), varredura });
}
