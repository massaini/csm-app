import { NextResponse } from 'next/server';
import { relogioSistema } from '@/domain/clock';
import { db } from '@/server/db';
import { esquemaConsulta } from '@/server/filtros-admin';
import { usuarioAtual } from '@/server/http-sessao';
import { filaAoVivo, historicoAtendimentos, historicoSenhas } from '@/server/painel';

export const dynamic = 'force-dynamic';

/** Dados das telas do painel. POST para que nome/CPF nunca vão na URL (RNF02-CA4). */
export async function POST(req: Request) {
  const admin = await usuarioAtual('ADMIN');
  if (!admin || admin.deveTrocarSenha) {
    return NextResponse.json({ erro: 'nao_autenticado' }, { status: 401 });
  }
  const consulta = esquemaConsulta.safeParse(await req.json().catch(() => null));
  if (!consulta.success) return NextResponse.json({ erro: 'filtros_invalidos' }, { status: 400 });

  const deps = { db, clock: relogioSistema };
  const { tela, filtros } = consulta.data;
  const dados =
    tela === 'fila-ao-vivo'
      ? await filaAoVivo(deps, filtros)
      : tela === 'atendimentos'
        ? await historicoAtendimentos(deps, filtros)
        : await historicoSenhas(deps, filtros);
  return NextResponse.json(dados, { headers: { 'Cache-Control': 'no-store' } });
}
