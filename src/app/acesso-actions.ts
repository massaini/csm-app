'use server';

import { redirect } from 'next/navigation';
import { cpfValido } from '@/domain/documentos';
import { login, logout, trocarSenha, LIMITES, type TipoUsuario } from '@/server/auth';
import {
  apagarCookieDeSessao,
  authDeps,
  definirCookieDeSessao,
  ipDoCliente,
  lerToken,
  usuarioAtual,
} from '@/server/http-sessao';

export interface EstadoDoFormulario {
  erro?: string;
  erros?: Partial<Record<'cpf' | 'senha' | 'atual' | 'nova' | 'confirma', string>>;
}

const ROTAS: Record<TipoUsuario, { inicio: string; troca: string; login: string }> = {
  MOTORISTA: { inicio: '/fila?entrou=1', troca: '/trocar-senha', login: '/login' },
  ADMIN: { inicio: '/admin', troca: '/admin/trocar-senha', login: '/admin/login' },
};

async function entrar(tipo: TipoUsuario, dados: FormData): Promise<EstadoDoFormulario> {
  const cpf = String(dados.get('cpf') ?? '');
  const senha = String(dados.get('senha') ?? '');
  // RF01-CA5: erro no próprio campo, sem consultar o banco
  if (!cpfValido(cpf)) return { erros: { cpf: 'CPF inválido' } };
  if (!senha) return { erros: { senha: 'Informe a senha' } };

  const r = await login(authDeps(), { tipo, cpf, senha, ip: await ipDoCliente() });
  if (!r.ok) return { erro: r.mensagem };
  await definirCookieDeSessao(tipo, r.token, r.expiraEm);
  // RF01-CA1: troca pendente vai antes de qualquer outra tela
  redirect(r.deveTrocarSenha ? ROTAS[tipo].troca : ROTAS[tipo].inicio);
}

export async function entrarMotorista(
  _: EstadoDoFormulario,
  dados: FormData,
): Promise<EstadoDoFormulario> {
  return entrar('MOTORISTA', dados);
}

export async function entrarAdmin(
  _: EstadoDoFormulario,
  dados: FormData,
): Promise<EstadoDoFormulario> {
  return entrar('ADMIN', dados);
}

async function trocar(tipo: TipoUsuario, dados: FormData): Promise<EstadoDoFormulario> {
  const usuario = await usuarioAtual(tipo);
  if (!usuario) redirect(ROTAS[tipo].login);

  const atual = String(dados.get('atual') ?? '');
  const nova = String(dados.get('nova') ?? '');
  const confirma = String(dados.get('confirma') ?? '');
  if (nova.length < LIMITES.senhaMinima) {
    return {
      erros: { nova: `A nova senha precisa ter pelo menos ${LIMITES.senhaMinima} caracteres` },
    };
  }
  if (nova !== confirma) return { erros: { confirma: 'A confirmação não é igual à nova senha' } };

  const r = await trocarSenha(authDeps(), {
    tipo,
    usuarioId: usuario.id,
    senhaAtual: atual,
    novaSenha: nova,
  });
  if (!r.ok) {
    if (r.codigo === 'SENHA_ATUAL_INVALIDA') return { erros: { atual: 'Senha atual incorreta' } };
    if (r.codigo === 'IGUAL_A_ATUAL')
      return { erros: { nova: 'A nova senha precisa ser diferente da atual' } };
    return {
      erros: { nova: `A nova senha precisa ter pelo menos ${LIMITES.senhaMinima} caracteres` },
    };
  }
  redirect(ROTAS[tipo].inicio);
}

export async function trocarSenhaMotorista(
  _: EstadoDoFormulario,
  dados: FormData,
): Promise<EstadoDoFormulario> {
  return trocar('MOTORISTA', dados);
}

export async function trocarSenhaAdmin(
  _: EstadoDoFormulario,
  dados: FormData,
): Promise<EstadoDoFormulario> {
  return trocar('ADMIN', dados);
}

async function sair(tipo: TipoUsuario, endpointPush?: string) {
  await logout(authDeps(), await lerToken(tipo), endpointPush);
  await apagarCookieDeSessao(tipo);
  redirect(ROTAS[tipo].login);
}

export async function sairMotorista(dados?: FormData) {
  const endpoint = dados?.get('endpointPush');
  return sair('MOTORISTA', typeof endpoint === 'string' && endpoint ? endpoint : undefined);
}

export async function sairAdmin() {
  return sair('ADMIN');
}
