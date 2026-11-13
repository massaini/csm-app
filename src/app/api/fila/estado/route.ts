import { NextResponse } from 'next/server';
import { relogioSistema } from '@/domain/clock';
import { db } from '@/server/db';
import { estadoDoMotorista } from '@/server/fila-motorista';
import { usuarioAtual } from '@/server/http-sessao';

export const dynamic = 'force-dynamic';

/** Estado leve de /fila para o app refazer o fetch (polling e, depois, eventos SSE). */
export async function GET() {
  const motorista = await usuarioAtual('MOTORISTA');
  if (!motorista) return NextResponse.json({ erro: 'nao_autenticado' }, { status: 401 });
  const estado = await estadoDoMotorista({ db, clock: relogioSistema }, motorista.id);
  return NextResponse.json(estado, { headers: { 'Cache-Control': 'no-store' } });
}
