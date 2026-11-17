'use client';

import { useState } from 'react';
import { CabecalhoDaTela, FALHA_AO_ENVIAR, tentar } from '@/components/admin/comum';
import { AcoesDoCadastro, BOTAO_FORM, CAMPO, EdicaoInline } from '@/components/admin/edicao';
import { Card, Chip, MensagemDeErro } from '@/components/ui/basicos';
import { Confirmacao } from '@/components/ui/confirmacao';
import type { dadosBancadasRegioes, Resultado } from '@/server/cadastros';
import {
  alterarAtivaRegiao,
  excluirRegiao,
  mapear,
  novaRegiao,
  removerBairro,
  renomearBairro,
} from '../cadastros-actions';

type Dados = Awaited<ReturnType<typeof dadosBancadasRegioes>>;
type RegiaoDados = Dados['regioes'][number];

/** RF25 — regiões (código + bairros) e o mapeamento região → bancada de cada galpão. */
export function Regioes({ dados }: { dados: Dados }) {
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<RegiaoDados | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function rodar(acao: () => Promise<Resultado>) {
    setErro(null);
    setAviso(null);
    const r = await tentar(acao);
    if (!r) {
      setErro(FALHA_AO_ENVIAR);
      return false;
    }
    if (!r.ok) setErro(Object.values(r.erros)[0] ?? 'Não foi possível salvar.');
    return r.ok;
  }

  async function adicionar(codigo: string, bairro: string) {
    setErro(null);
    setAviso(null);
    const r = await tentar(() => novaRegiao(codigo, bairro));
    if (!r) {
      setErro(FALHA_AO_ENVIAR);
      return false;
    }
    if (!r.ok) {
      setErro(Object.values(r.erros)[0] ?? 'Não foi possível salvar.');
      return false;
    }
    setAviso(
      r.bairroAdicionado
        ? `Bairro ${bairro.trim()} adicionado à região ${codigo.trim()}.`
        : `Região ${codigo.trim()} criada.`,
    );
    return true;
  }

  async function confirmarExclusao() {
    if (!excluindo) return;
    setEnviando(true);
    await rodar(() => excluirRegiao(excluindo.id));
    setEnviando(false);
    setExcluindo(null);
  }

  const regioesAtivas = dados.regioes.filter((r) => r.ativa);

  return (
    <main>
      <CabecalhoDaTela
        titulo="Regiões"
        subtitulo="Cada código de região atende um ou mais bairros e uma bancada fixa de cada galpão."
      />
      {erro ? <MensagemDeErro className="mt-base">{erro}</MensagemDeErro> : null}
      {aviso ? (
        <p role="status" className="t-body-s mt-base text-success">
          {aviso}
        </p>
      ) : null}

      <Card className="mt-xl !p-0">
        <ul className="flex flex-col divide-y divide-border border-b border-border">
          {dados.regioes.length === 0 ? (
            <li className="t-body-s px-base py-md text-text-muted">Nenhuma região</li>
          ) : null}
          {dados.regioes.map((r) => (
            <li
              key={r.id}
              className="grid min-h-[52px] grid-cols-[72px_1fr_auto] items-center gap-base px-base py-sm"
            >
              <span className="t-body-m-strong text-primary">{r.codigo}</span>
              <span className="flex flex-wrap items-center gap-sm">
                {r.bairros.map((b) => (
                  <span
                    key={b}
                    className="inline-flex items-center gap-xs rounded-md border border-border px-sm py-xs"
                  >
                    <EdicaoInline
                      valor={b}
                      rotulo={`bairro ${b} da região ${r.codigo}`}
                      aoSalvar={(v) => rodar(() => renomearBairro(r.id, b, v))}
                    />
                    {r.bairros.length > 1 ? (
                      <button
                        type="button"
                        aria-label={`Remover o bairro ${b} da região ${r.codigo}`}
                        title="Remover bairro"
                        className="t-body-m px-xs text-text-muted hover:text-danger"
                        onClick={() => void rodar(() => removerBairro(r.id, b))}
                      >
                        ×
                      </button>
                    ) : null}
                  </span>
                ))}
                {r.ativa ? null : <Chip tom="neutral">Inativa</Chip>}
              </span>
              <AcoesDoCadastro
                ativa={r.ativa}
                nome={`região ${r.codigo}`}
                aoAlternar={() => void rodar(() => alterarAtivaRegiao(r.id, !r.ativa))}
                aoExcluir={() => setExcluindo(r)}
              />
            </li>
          ))}
        </ul>
        <div className="p-base">
          <NovaRegiao aoEnviar={adicionar} />
        </div>
      </Card>

      <h2 className="t-title-s mt-2xl">Mapeamento região → bancada</h2>
      <p className="t-body-s mt-xs text-text-secondary">
        Mudar o mapeamento vale para as próximas senhas; as já geradas continuam na bancada
        original.
      </p>
      <div className="mt-base overflow-x-auto rounded-lg border border-border-strong/60">
        <table className="w-full text-left">
          <thead className="bg-elevated">
            <tr>
              <th className="t-overline px-base py-md text-text-secondary">Região</th>
              {dados.galpoes.map((g) => (
                <th key={g.id} className="t-overline px-base py-md text-text-secondary">
                  {g.nome}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&>tr:nth-child(even)]:bg-surface">
            {regioesAtivas.length === 0 ? (
              <tr>
                <td
                  colSpan={dados.galpoes.length + 1}
                  className="t-body-m px-base py-xl text-center text-text-secondary"
                >
                  Cadastre uma região para mapear.
                </td>
              </tr>
            ) : null}
            {regioesAtivas.map((r) => (
              <tr key={r.id}>
                <td className="t-body-m-strong px-base py-sm">
                  {r.codigo} · {r.nome}
                </td>
                {dados.galpoes.map((g) => (
                  <td key={g.id} className="px-base py-sm">
                    <select
                      aria-label={`Bancada da região ${r.codigo} no galpão ${g.nome}`}
                      className={CAMPO}
                      value={dados.mapa[`${g.id}:${r.id}`] ?? ''}
                      onChange={(e) =>
                        void rodar(() =>
                          mapear(g.id, r.id, e.target.value ? Number(e.target.value) : null),
                        )
                      }
                    >
                      <option value="">—</option>
                      {g.bancadas
                        .filter((b) => b.ativa)
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            Bancada {b.identificacao}
                          </option>
                        ))}
                    </select>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Confirmacao
        aberta={excluindo !== null}
        titulo="Excluir região?"
        texto={`A região ${excluindo?.codigo ?? ''} (${
          excluindo?.nome ?? ''
        }) e o mapeamento dela saem do cadastro. Não dá para desfazer. As senhas já geradas continuam no histórico.`}
        confirmar="Excluir"
        voltar="Cancelar"
        perigo
        pendente={enviando}
        aoFechar={() => setExcluindo(null)}
        aoConfirmar={() => void confirmarExclusao()}
      />
    </main>
  );
}

function NovaRegiao({
  aoEnviar,
}: {
  aoEnviar: (codigo: string, bairro: string) => Promise<boolean>;
}) {
  const [codigo, setCodigo] = useState('');
  const [bairro, setBairro] = useState('');
  const [enviando, setEnviando] = useState(false);
  return (
    <form
      className="flex flex-col gap-xs"
      onSubmit={async (e) => {
        e.preventDefault();
        setEnviando(true);
        const ok = await aoEnviar(codigo, bairro);
        setEnviando(false);
        if (ok) {
          setCodigo('');
          setBairro('');
        }
      }}
    >
      <div className="flex flex-wrap items-end gap-sm">
        <label className="flex w-[140px] flex-col gap-xs">
          <span className="t-overline text-text-muted">Código</span>
          <input
            className={CAMPO}
            aria-label="Código da região"
            placeholder="Ex.: 545"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
          />
        </label>
        <label className="flex min-w-[240px] flex-1 flex-col gap-xs">
          <span className="t-overline text-text-muted">Bairro</span>
          <input
            className={CAMPO}
            aria-label="Bairro da região"
            placeholder="Ex.: Paranapiacaba"
            value={bairro}
            onChange={(e) => setBairro(e.target.value)}
          />
        </label>
        <button
          className={BOTAO_FORM}
          type="submit"
          disabled={!codigo.trim() || !bairro.trim() || enviando}
        >
          {enviando ? 'Adicionando…' : 'Adicionar'}
        </button>
      </div>
      <p className="t-caption text-text-muted">
        Se o código já existir, o bairro é adicionado a ele.
      </p>
    </form>
  );
}
