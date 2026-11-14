'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  BotaoDaTabela,
  CabecalhoDaTela,
  CampoFiltro,
  FALHA_AO_ENVIAR,
  Tabela,
  tentar,
} from '@/components/admin/comum';
import { Chip, MensagemDeErro } from '@/components/ui/basicos';
import { Button } from '@/components/ui/button';
import { Confirmacao } from '@/components/ui/confirmacao';
import { Dialogo, SenhaTemporaria } from '@/components/ui/dialogo';
import { Field } from '@/components/ui/field';
import { formatarCpf, formatarTelefone } from '@/domain/documentos';
import type { MotoristaListado } from '@/server/cadastros';
import {
  alterarAtivoMotorista,
  buscarMotoristas,
  liberarGeracaoDeSenha,
  redefinirSenhaMotorista,
  salvarMotorista,
} from '../cadastros-actions';

type Regiao = { id: number; codigo: string; nome: string };

type Pendente = { tipo: 'desativar' | 'redefinir' | 'liberar'; m: MotoristaListado } | null;

/** RF24 — cadastro de motoristas (tela nova, montada com o DS). */
export function Motoristas({
  inicial,
  regioes,
}: {
  inicial: MotoristaListado[];
  regioes: Regiao[];
}) {
  const [lista, setLista] = useState(inicial);
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<MotoristaListado | 'novo' | null>(null);
  const [senha, setSenha] = useState<{ para: string; senha: string } | null>(null);
  const [pendente, setPendente] = useState<Pendente>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function recarregar(termo = busca) {
    const r = await tentar(() => buscarMotoristas(termo));
    if (r) setLista(r);
    setErro(r ? null : FALHA_AO_ENVIAR);
  }

  // busca com atraso curto; o termo vai por POST, nunca na URL (RF24-CA7)
  useEffect(() => {
    const id = setTimeout(async () => {
      const r = await tentar(() => buscarMotoristas(busca));
      if (r) setLista(r);
      setErro(r ? null : FALHA_AO_ENVIAR);
    }, 300);
    return () => clearTimeout(id);
  }, [busca]);

  async function confirmar() {
    if (!pendente) return;
    const { tipo, m } = pendente;
    setEnviando(true);
    setAviso(null);
    const ok = await tentar(async () => {
      if (tipo === 'desativar') await alterarAtivoMotorista(m.id, false);
      if (tipo === 'redefinir') {
        const r = await redefinirSenhaMotorista(m.id);
        setSenha({ para: m.nome, senha: r.senhaTemporaria });
      }
      if (tipo === 'liberar') {
        await liberarGeracaoDeSenha(m.id);
        setAviso(`${m.nome} pode gerar senha sem GPS até o fim do dia.`);
      }
      return true;
    });
    setEnviando(false);
    setPendente(null);
    if (!ok) return setErro(FALHA_AO_ENVIAR);
    await recarregar();
  }

  async function reativar(m: MotoristaListado) {
    const ok = await tentar(() => alterarAtivoMotorista(m.id, true));
    if (ok === null) return setErro(FALHA_AO_ENVIAR);
    await recarregar();
  }

  return (
    <main>
      <CabecalhoDaTela
        titulo="Motoristas"
        subtitulo={`${lista.length} ${lista.length === 1 ? 'motorista' : 'motoristas'}${busca ? ' encontrados' : ''}`}
        acao={
          <Button bloco={false} className="w-[228px]" onClick={() => setEditando('novo')}>
            + Novo motorista
          </Button>
        }
      />

      <div className="mt-xl max-w-[420px]">
        <CampoFiltro rotulo="Buscar">
          {(classe) => (
            <input
              className={classe}
              placeholder="Nome ou CPF"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          )}
        </CampoFiltro>
      </div>

      {aviso ? (
        <p role="status" className="t-body-s mt-base text-success">
          {aviso}
        </p>
      ) : null}
      {erro ? <MensagemDeErro className="mt-base">{erro}</MensagemDeErro> : null}

      <Tabela
        carregando={false}
        vazia="Nenhum motorista encontrado"
        colunas={[
          { titulo: 'Nome' },
          { titulo: 'CPF' },
          { titulo: 'Telefone' },
          { titulo: 'Região' },
          { titulo: 'Situação' },
          { titulo: 'Ações', classe: 'w-[420px]' },
        ]}
      >
        {lista.map((m) => (
          <tr key={m.id} className="t-body-m">
            <td className="t-body-m-strong px-base py-md">{m.nome}</td>
            <td className="t-body-s whitespace-nowrap px-base py-md tabular-nums text-text-secondary">
              {formatarCpf(m.cpf)}
            </td>
            <td className="t-body-s whitespace-nowrap px-base py-md tabular-nums text-text-secondary">
              {m.telefone ? formatarTelefone(m.telefone) : '—'}
            </td>
            <td className="t-body-s px-base py-md text-text-secondary">{m.regiao}</td>
            <td className="px-base py-md">
              <div className="flex flex-wrap gap-xs">
                {m.ativo ? <Chip tom="success">Ativo</Chip> : <Chip tom="neutral">Inativo</Chip>}
                {m.ativo && m.deveTrocarSenha ? <Chip tom="warning">Troca pendente</Chip> : null}
                {m.liberado ? <Chip tom="primary">Liberado</Chip> : null}
              </div>
            </td>
            <td className="px-base py-sm">
              <div className="flex flex-wrap gap-xs">
                <BotaoDaTabela onClick={() => setEditando(m)}>Editar</BotaoDaTabela>
                {m.ativo ? (
                  <>
                    <BotaoDaTabela
                      disabled={m.liberado}
                      onClick={() => setPendente({ tipo: 'liberar', m })}
                    >
                      Liberar geração de senha
                    </BotaoDaTabela>
                    <BotaoDaTabela onClick={() => setPendente({ tipo: 'redefinir', m })}>
                      Redefinir senha
                    </BotaoDaTabela>
                    <BotaoDaTabela
                      className="text-danger"
                      onClick={() => setPendente({ tipo: 'desativar', m })}
                    >
                      Desativar
                    </BotaoDaTabela>
                  </>
                ) : (
                  <BotaoDaTabela onClick={() => void reativar(m)}>Reativar</BotaoDaTabela>
                )}
              </div>
            </td>
          </tr>
        ))}
      </Tabela>

      <Dialogo
        aberto={editando !== null}
        titulo={editando === 'novo' ? 'Novo motorista' : 'Editar motorista'}
        aoFechar={() => setEditando(null)}
      >
        {editando !== null ? (
          <FormMotorista
            motorista={editando === 'novo' ? null : editando}
            regioes={regioes}
            aoSalvar={async (senhaTemporaria, nome) => {
              setEditando(null);
              if (senhaTemporaria) setSenha({ para: nome, senha: senhaTemporaria });
              await recarregar();
            }}
            aoCancelar={() => setEditando(null)}
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
        titulo={
          pendente?.tipo === 'desativar'
            ? 'Desativar motorista?'
            : pendente?.tipo === 'redefinir'
              ? 'Redefinir senha?'
              : 'Liberar geração de senha?'
        }
        texto={
          pendente?.tipo === 'desativar'
            ? `${pendente.m.nome} perde o acesso agora e a senha ativa dele, se houver, é cancelada.`
            : pendente?.tipo === 'redefinir'
              ? `${pendente?.m.nome} sai de todos os aparelhos e recebe uma senha temporária nova.`
              : `${pendente?.m.nome ?? ''} poderá gerar uma senha sem estar no raio do pátio, até o fim do dia ou até gerar a senha.`
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

function FormMotorista({
  motorista,
  regioes,
  aoSalvar,
  aoCancelar,
}: {
  motorista: MotoristaListado | null;
  regioes: Regiao[];
  aoSalvar: (senhaTemporaria: string | null, nome: string) => void;
  aoCancelar: () => void;
}) {
  const [nome, setNome] = useState(motorista?.nome ?? '');
  const [cpf, setCpf] = useState(motorista ? formatarCpf(motorista.cpf) : '');
  const [telefone, setTelefone] = useState(formatarTelefone(motorista?.telefone ?? ''));
  const [regiaoId, setRegiaoId] = useState(motorista?.regiaoId ?? regioes[0]?.id ?? 0);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    const r = await tentar(() =>
      salvarMotorista(motorista?.id ?? null, { nome, cpf, telefone, regiaoId }),
    );
    setSalvando(false);
    if (!r) return setErros({ geral: FALHA_AO_ENVIAR });
    if (!r.ok) return setErros(r.erros);
    aoSalvar('senhaTemporaria' in r ? (r.senhaTemporaria as string) : null, nome);
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-md" noValidate>
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
        disabled={motorista !== null}
        onChange={(e) => setCpf(formatarCpf(e.target.value))}
        erro={erros.cpf}
      />
      <Field
        label="Telefone"
        name="telefone"
        inputMode="tel"
        placeholder="(11) 98765-4321"
        value={telefone}
        onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
        erro={erros.telefone}
      />
      <label className="flex flex-col gap-xs">
        <span className="t-caption uppercase text-text-muted">Região</span>
        <select
          className="t-body-l h-[56px] rounded-md border border-border bg-surface px-base"
          value={regiaoId}
          onChange={(e) => setRegiaoId(Number(e.target.value))}
        >
          {regioes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.codigo} · {r.nome}
            </option>
          ))}
        </select>
        {erros.regiaoId ? <span className="t-body-s text-danger">{erros.regiaoId}</span> : null}
      </label>
      {erros.geral ? <MensagemDeErro>{erros.geral}</MensagemDeErro> : null}
      <div className="mt-sm flex flex-col gap-md">
        <Button type="submit" disabled={salvando}>
          {salvando ? 'Salvando…' : motorista ? 'Salvar' : 'Cadastrar'}
        </Button>
        <Button type="button" kind="secondary" onClick={aoCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
