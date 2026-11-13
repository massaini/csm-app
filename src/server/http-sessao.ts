import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { relogioApp } from '@/server/relogio';
import { db } from '@/server/db';
import { validarSessao, type TipoUsuario, type UsuarioAutenticado } from '@/server/auth';

const COOKIE: Record<TipoUsuario, string> = { MOTORISTA: 'csm_sessao', ADMIN: 'csm_admin' };
const QUATROCENTOS_DIAS_S = 400 * 24 * 60 * 60;

export const authDeps = () => ({ db, clock: relogioApp });

/**
 * IP do cliente para o limite de tentativas (RF01-CA4). Nunca o primeiro valor de
 * `X-Forwarded-For` (o cliente pode forjá-lo): prefere `X-Real-IP` do proxy e, na falta,
 * o último valor de `X-Forwarded-For` (o acrescentado pelo proxy mais próximo).
 * TODO(setup Railway): confirmar na documentação qual cabeçalho o proxy preenche.
 */
export async function ipDoCliente(): Promise<string> {
  const h = await headers();
  const real = h.get('x-real-ip');
  if (real) return real.trim();
  const xff = h.get('x-forwarded-for');
  if (xff) return xff.split(',').at(-1)!.trim();
  return 'desconhecido';
}

export async function definirCookieDeSessao(tipo: TipoUsuario, token: string, expiraEm: Date) {
  const jar = await cookies();
  jar.set(COOKIE[tipo], token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    // motorista: validade longa fixa, quem manda é o `expiraEm` do servidor; admin: 12 h
    ...(tipo === 'MOTORISTA' ? { maxAge: QUATROCENTOS_DIAS_S } : { expires: expiraEm }),
  });
}

export async function lerToken(tipo: TipoUsuario): Promise<string | undefined> {
  return (await cookies()).get(COOKIE[tipo])?.value;
}

export async function apagarCookieDeSessao(tipo: TipoUsuario) {
  (await cookies()).delete(COOKIE[tipo]);
}

export async function usuarioAtual(tipo: TipoUsuario): Promise<UsuarioAutenticado | null> {
  return validarSessao(authDeps(), await lerToken(tipo), tipo);
}

/**
 * Guarda de página do motorista. Sem sessão → /login. Com troca de senha pendente →
 * /trocar-senha (RF02-CA1), a menos que a própria página de troca esteja chamando.
 */
export async function exigirMotorista(opcoes: { permitirTrocaPendente?: boolean } = {}) {
  const u = await usuarioAtual('MOTORISTA');
  if (!u) redirect('/login');
  if (u.deveTrocarSenha && !opcoes.permitirTrocaPendente) redirect('/trocar-senha');
  return u;
}

export async function exigirAdmin(
  opcoes: { permitirTrocaPendente?: boolean; apenasSuper?: boolean } = {},
) {
  const u = await usuarioAtual('ADMIN');
  if (!u) redirect('/admin/login');
  if (u.deveTrocarSenha && !opcoes.permitirTrocaPendente) redirect('/admin/trocar-senha');
  if (opcoes.apenasSuper && u.papel !== 'SUPER_ADMIN') redirect('/admin');
  return u;
}
