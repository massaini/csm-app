'use client';

import { useState, type FormEvent } from 'react';
import {
  BotaoDaTabela,
  CabecalhoDaTela,
  FALHA_AO_ENVIAR,
  Tabela,
  tentar,
} from '@/components/admin/comum';
import { Chip, MensagemDeErro } from '@/components/ui/basicos';
import { Button } from '@/components/ui/button';
import { Confirmacao } from '@/components/ui/confirmacao';
import { Dialogo, SenhaTemporaria } from '@/components/ui/dialogo';
import { Field } from '@/components/ui/field';
import { formatarCpf } from '@/domain/documentos';
import type { listarAdmins } from '@/server/cadastros';
import {
  alterarAtivoAdmin,
  novoAdmin,
  redefinirSenhaAdmin,
  renomearAdminAction,
} from '../cadastros-actions';

type Admin = Awaited<ReturnType<typeof listarAdmins>>[number];
export function Administradores({ admins, meuId }: { admins: Admin[]; meuId: number }) {
  const [criando, setCriando] = useState(false);
  const [renomeando, setRenomeando] = useState<Admin | null>(null);
  const [senha, setSenha] = useState<{ para: string; senha: string } | null>(null);
  const [pendente, setPendente] = useState<{ tipo: 'desativar' | 'redefinir'; a: Admin } | null>(
    null,
  );
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    if (!pendente) return;
    const { tipo, a } = pendente;
    setErro(null);
    setEnviando(true);
    if (tipo === 'desativar') {
      const r = await tentar(() => alterarAtivoAdmin(a.id, false));
      if (!r) setErro(FALHA_AO_ENVIAR);
      else if (!r.ok) setErro(Object.values(r.erros)[0]);
    } else {
      const r = await tentar(() => redefinirSenhaAdmin(a.id));
      if (!r) setErro(FALHA_AO_ENVIAR);
      else setSenha({ para: a.nome, senha: r.senhaTemporaria });
    }
    setEnviando(false);
    setPendente(null);
  }

  async function reativar(a: Admin) {
    setErro(null);
    const r = await tentar(() => alterarAtivoAdmin(a.id, true));
    if (!r) setErro(FALHA_AO_ENVIAR);
    else if (!r.ok) setErro(Object.values(r.erros)[0]);
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
      {erro ? <MensagemDeErro className="mt-base">{erro}</MensagemDeErro> : null}
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
              <div className="flex gap-sm">
                <BotaoDaTabela onClick={() => setRenomeando(a)}>Editar nome</BotaoDaTabela>
                {a.papel === 'SUPER_ADMIN' ? null : a.ativo ? (
                  <>
                    <BotaoDaTabela onClick={() => setPendente({ tipo: 'redefinir', a })}>
                      Redefinir senha
                    </BotaoDaTabela>
                    <BotaoDaTabela perigo onClick={() => setPendente({ tipo: 'desativar', a })}>
                      Desativar
                    </BotaoDaTabela>
                  </>
                ) : (
                  <BotaoDaTabela onClick={() => void reativar(a)}>Reativar</BotaoDaTabela>
                )}
              </div>
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

      <Dialogo
        aberto={renomeando !== null}
        titulo="Editar nome"
        aoFechar={() => setRenomeando(null)}
      >
        {renomeando ? (
          <FormNome
            admin={renomeando}
            aoSalvar={() => setRenomeando(null)}
            aoCancelar={() => setRenomeando(null)}
          />
        ) : null}
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
        pendente={enviando}
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
    const r = await tentar(() => novoAdmin(nome, cpf));
    setSalvando(false);
    if (!r) return setErros({ geral: FALHA_AO_ENVIAR });
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
      {erros.geral ? <MensagemDeErro>{erros.geral}</MensagemDeErro> : null}
      <Button type="submit" disabled={salvando}>
        {salvando ? 'Criando…' : 'Criar administrador'}
      </Button>
      <Button type="button" kind="secondary" onClick={aoCancelar}>
        Cancelar
      </Button>
    </form>
  );
}

/** RF27-CA4 — o nome é o que aparece como Conferente para o motorista. */
function FormNome({
  admin,
  aoSalvar,
  aoCancelar,
}: {
  admin: Admin;
  aoSalvar: () => void;
  aoCancelar: () => void;
}) {
  const [nome, setNome] = useState(admin.nome);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const r = await tentar(() => renomearAdminAction(admin.id, nome));
    setSalvando(false);
    if (!r) return setErros({ geral: FALHA_AO_ENVIAR });
    if (!r.ok) return setErros(r.erros);
    aoSalvar();
  }
  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-md">
      <p className="t-body-s text-text-secondary">
        É o nome que o motorista vê como Conferente quando este administrador o chama.
      </p>
      <Field
        label="Nome completo"
        name="nome"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        erro={erros.nome}
      />
      {erros.geral ? <MensagemDeErro>{erros.geral}</MensagemDeErro> : null}
      <Button type="submit" disabled={salvando}>
        {salvando ? 'Salvando…' : 'Salvar'}
      </Button>
      <Button type="button" kind="secondary" onClick={aoCancelar}>
        Cancelar
      </Button>
    </form>
  );
}
