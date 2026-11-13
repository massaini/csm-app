import { NextResponse } from 'next/server';
import { relogioApp } from '@/server/relogio';
import { db } from '@/server/db';
import { esquemaConsulta } from '@/server/filtros-admin';
import { usuarioAtual } from '@/server/http-sessao';
import { exportarCsv } from '@/server/painel';

export const dynamic = 'force-dynamic';

/** RF22 — CSV das linhas do filtro atual. POST: os filtros vão no corpo (RF22-CA5). */
export async function POST(req: Request) {
  const admin = await usuarioAtual('ADMIN');
  if (!admin || admin.deveTrocarSenha) {
    return NextResponse.json({ erro: 'nao_autenticado' }, { status: 401 });
  }
  const consulta = esquemaConsulta.safeParse(await req.json().catch(() => null));
  if (!consulta.success) return NextResponse.json({ erro: 'filtros_invalidos' }, { status: 400 });

  const r = await exportarCsv({ db, clock: relogioApp }, consulta.data.tela, consulta.data.filtros);
  if (!r.ok) {
    return NextResponse.json(
      { erro: 'muitas_linhas', mensagem: 'Refine o período para exportar' },
      { status: 422 },
    );
  }
  await db.auditoria.create({
    data: {
      atorTipo: 'ADMIN',
      atorId: admin.id,
      acao: 'painel.exportar',
      alvoTipo: consulta.data.tela,
    },
  });
  return new NextResponse(r.csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${r.nomeArquivo}"`,
      'Cache-Control': 'no-store',
    },
  });
}
