'use client';

import { useState, type FormEvent } from 'react';
import { CabecalhoDaTela, Tabela } from '@/components/admin/comum';
import { Chip } from '@/components/ui/basicos';
import { Button } from '@/components/ui/button';
import { Confirmacao } from '@/components/ui/confirmacao';
import { Dialogo, SenhaTemporaria } from '@/components/ui/dialogo';
import { Field } from '@/components/ui/field';
import { formatarCpf } from '@/domain/documentos';
import type { listarAdmins } from '@/server/cadastros';
import { alterarAtivoAdmin, novoAdmin, redefinirSenhaAdmin } from '../cadastros-actions';

type Admin = Awaited<ReturnType<typeof listarAdmins>>[number];
const BOTAO =
  't-button-m h-[32px] rounded-md border border-border-strong px-md text-primary disabled:opacity-40';

export function Administradores({ admins, meuId }: { admins: Admin[]; meuId: number }) {
  const [criando, setCriando] = useState(false);
  const [senha, setSenha] = useState<{ para: string; senha: string } | null>(null);
  const [pendente, setPendente] = useState<{ tipo: 'desativar' | 'redefinir'; a: Admin } | null>(
    null,
  );
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    if (!pendente) return;
    setErro(null);
    if (pendente.tipo === 'desativar') {
      const r = await alterarAtivoAdmin(pendente.a.id, false);
      if (!r.ok) setErro(Object.values(r.erros)[0]);
    } else {
      const r = await redefinirSenhaAdmin(pendente.a.id);
      setSenha({ para: pendente.a.nome, senha: r.senhaTemporaria });
    }
    setPendente(null);
  }

  return (
    <main>
      <CabecalhoDaTela
        titulo="Administradores"
        subtitulo="Só o super-administrador vê esta tela. O super-administrador não pode ser desativado."
        acao={
          <Button bloco={false} className="w-[228px]" onClick={() => setCriando(true)}>
            + Novo administrador
          </Button>
        }
      />
      {erro ? (
        <p role="alert" className="t-body-s mt-base text-danger">
          {erro}
        </p>
      ) : null}
      <Tabela
        carregando={false}
        vazia="Nenhum administrador"
        colunas={[
          { titulo: 'Nome' },
          { titulo: 'CPF' },
          { titulo: 'Papel' },
          { titulo: 'Situação' },
          { titulo: 'Ações' },
        ]}
      >
        {admins.map((a) => (
          <tr key={a.id} className="t-body-m">
            <td className="t-body-m-strong px-base py-md">
              {a.nome}
              {a.id === meuId ? (
                <span className="t-caption ml-sm text-text-muted">(você)</span>
              ) : null}
            </td>
            <td className="t-body-s whitespace-nowrap px-base py-md tabular-nums text-text-secondary">
              {formatarCpf(a.cpf)}
            </td>
            <td className="px-base py-md">
              {a.papel === 'SUPER_ADMIN' ? (
                <Chip tom="primary">Super-admin</Chip>
              ) : (
                <Chip tom="neutral">Admin</Chip>
              )}
            </td>
            <td className="px-base py-md">
              <div className="flex gap-xs">
                {a.ativo ? <Chip tom="success">Ativo</Chip> : <Chip tom="neutral">Inativo</Chip>}
                {a.ativo && a.deveTrocarSenha ? <Chip tom="warning">Troca pendente</Chip> : null}
              </div>
            </td>
            <td className="px-base py-sm">
              {a.papel === 'SUPER_ADMIN' ? (
                <span className="t-body-s text-text-muted">—</span>
              ) : (
                <div className="flex gap-xs">
                  {a.ativo ? (
                    <>
                      <button
                        className={BOTAO}
                        onClick={() => setPendente({ tipo: 'redefinir', a })}
                      >
                        Redefinir senha
                      </button>
                      <button
                        className={`${BOTAO} text-danger`}
                        onClick={() => setPendente({ tipo: 'desativar', a })}
                      >
                        Desativar
                      </button>
                    </>
                  ) : (
                    <button className={BOTAO} onClick={() => void alterarAtivoAdmin(a.id, true)}>
                      Reativar
                    </button>
                  )}
                </div>
              )}
            </td>
          </tr>
        ))}
      </Tabela>

      <Dialogo aberto={criando} titulo="Novo administrador" aoFechar={() => setCriando(false)}>
        <FormAdmin
          aoCriar={(nome, s) => {
            setCriando(false);
            setSenha({ para: nome, senha: s });
          }}
          aoCancelar={() => setCriando(false)}
        />
      </Dialogo>

      <Dialogo aberto={senha !== null} titulo="Senha temporária" aoFechar={() => setSenha(null)}>
        {senha ? (
          <>
            <SenhaTemporaria senha={senha.senha} para={senha.para} />
            <Button className="mt-xl" onClick={() => setSenha(null)}>
              Anotei a senha
            </Button>
          </>
        ) : null}
      </Dialogo>

      <Confirmacao
        aberta={pendente !== null}
        titulo={pendente?.tipo === 'desativar' ? 'Desativar administrador?' : 'Redefinir senha?'}
        texto={
          pendente?.tipo === 'desativar'
            ? `${pendente.a.nome} perde o acesso ao painel agora.`
            : `${pendente?.a.nome ?? ''} sai do painel e recebe uma senha temporária nova.`
        }
        confirmar={pendente?.tipo === 'desativar' ? 'Desativar' : 'Confirmar'}
        voltar="Cancelar"
        perigo={pendente?.tipo === 'desativar'}
        aoFechar={() => setPendente(null)}
        aoConfirmar={() => void confirmar()}
      />
    </main>
  );
}

function FormAdmin({
  aoCriar,
  aoCancelar,
}: {
  aoCriar: (nome: string, senha: string) => void;
  aoCancelar: () => void;
}) {
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const r = await novoAdmin(nome, cpf);
    setSalvando(false);
    if (!r.ok) return setErros(r.erros);
    aoCriar(nome, r.senhaTemporaria);
  }
  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-md">
      <Field
        label="Nome completo"
        name="nome"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        erro={erros.nome}
      />
      <Field
        label="CPF"
        name="cpf"
        inputMode="numeric"
        value={cpf}
        onChange={(e) => setCpf(formatarCpf(e.target.value))}
        erro={erros.cpf}
      />
      <Button type="submit" disabled={salvando}>
        {salvando ? 'Criando…' : 'Criar administrador'}
      </Button>
      <Button type="button" kind="secondary" onClick={aoCancelar}>
        Cancelar
      </Button>
    </form>
  );
}
