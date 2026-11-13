'use client';

import { useState, type FormEvent } from 'react';
import { CabecalhoDaTela } from '@/components/admin/comum';
import { Card, Chip } from '@/components/ui/basicos';
import type { dadosBancadasRegioes, Resultado } from '@/server/cadastros';
import {
  alterarAtivaBancada,
  alterarAtivaRegiao,
  mapear,
  novaBancada,
  novaRegiao,
  renomearBancada,
  renomearRegiao,
} from '../cadastros-actions';

type Dados = Awaited<ReturnType<typeof dadosBancadasRegioes>>;

const CAMPO =
  't-body-s h-[40px] rounded-md border border-border bg-bg px-md placeholder:text-text-muted focus:border-primary focus:outline-none';
const BOTAO =
  't-button-m h-[32px] rounded-md border border-border-strong px-md text-primary disabled:opacity-40';

/** RF25 — uma tela, três blocos: bancadas por galpão, regiões e o mapeamento. */
export function BancadasRegioes({ dados }: { dados: Dados }) {
  const [erro, setErro] = useState<string | null>(null);

  async function rodar(acao: () => Promise<Resultado>) {
    setErro(null);
    const r = await acao();
    if (!r.ok) setErro(Object.values(r.erros)[0] ?? 'Não foi possível salvar.');
    return r.ok;
  }

  const regioesAtivas = dados.regioes.filter((r) => r.ativa);

  return (
    <main>
      <CabecalhoDaTela
        titulo="Bancadas e Regiões"
        subtitulo="Cada região atende numa bancada fixa de cada galpão. Uma bancada atende um motorista por vez."
      />
      {erro ? (
        <p role="alert" className="t-body-s mt-base text-danger">
          {erro}
        </p>
      ) : null}

      <h2 className="t-title-s mt-2xl">Bancadas por galpão</h2>
      <div className="mt-base grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-base">
        {dados.galpoes.map((g) => (
          <Card key={g.id} className="!p-base">
            <p className="t-body-m-strong">{g.nome}</p>
            <ul className="mt-sm flex flex-col gap-xs">
              {g.bancadas.length === 0 ? (
                <li className="t-body-s text-text-muted">Nenhuma bancada</li>
              ) : null}
              {g.bancadas.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-sm">
                  <EdicaoInline
                    valor={b.identificacao}
                    prefixo="Bancada "
                    aoSalvar={(v) => rodar(() => renomearBancada(b.id, v))}
                  />
                  <span className="flex items-center gap-xs">
                    {b.ativa ? null : <Chip tom="neutral">Inativa</Chip>}
                    <button
                      className={BOTAO}
                      onClick={() => void rodar(() => alterarAtivaBancada(b.id, !b.ativa))}
                    >
                      {b.ativa ? 'Desativar' : 'Reativar'}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <FormUmCampo
              placeholder="Nova bancada (ex.: 09)"
              aoEnviar={(v) => rodar(() => novaBancada(g.id, v))}
            />
          </Card>
        ))}
      </div>

      <h2 className="t-title-s mt-2xl">Regiões</h2>
      <Card className="mt-base !p-base">
        <ul className="flex flex-col divide-y divide-border">
          {dados.regioes.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-base py-sm">
              <span className="flex items-center gap-sm">
                <span className="t-body-m-strong w-[48px] text-primary">{r.codigo}</span>
                <EdicaoInline
                  valor={r.nome}
                  aoSalvar={(v) => rodar(() => renomearRegiao(r.id, v))}
                />
              </span>
              <span className="flex items-center gap-xs">
                {r.ativa ? null : <Chip tom="neutral">Inativa</Chip>}
                <button
                  className={BOTAO}
                  onClick={() => void rodar(() => alterarAtivaRegiao(r.id, !r.ativa))}
                >
                  {r.ativa ? 'Desativar' : 'Reativar'}
                </button>
              </span>
            </li>
          ))}
        </ul>
        <NovaRegiao aoEnviar={(codigo, nome) => rodar(() => novaRegiao(codigo, nome))} />
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
    </main>
  );
}

function EdicaoInline({
  valor,
  prefixo = '',
  aoSalvar,
}: {
  valor: string;
  prefixo?: string;
  aoSalvar: (v: string) => Promise<boolean>;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(valor);
  if (!editando) {
    return (
      <button
        className="t-body-m text-left hover:underline"
        title="Clique para renomear"
        onClick={() => {
          setTexto(valor);
          setEditando(true);
        }}
      >
        {prefixo}
        {valor}
      </button>
    );
  }
  return (
    <form
      className="flex gap-xs"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await aoSalvar(texto)) setEditando(false);
      }}
    >
      <input
        autoFocus
        className={`${CAMPO} w-[160px]`}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <button className={BOTAO} type="submit">
        Salvar
      </button>
      <button className={BOTAO} type="button" onClick={() => setEditando(false)}>
        ×
      </button>
    </form>
  );
}

function FormUmCampo({
  placeholder,
  aoEnviar,
}: {
  placeholder: string;
  aoEnviar: (v: string) => Promise<boolean>;
}) {
  const [v, setV] = useState('');
  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (await aoEnviar(v)) setV('');
  }
  return (
    <form onSubmit={enviar} className="mt-md flex gap-xs">
      <input
        className={`${CAMPO} min-w-0 flex-1`}
        placeholder={placeholder}
        value={v}
        onChange={(e) => setV(e.target.value)}
      />
      <button className={BOTAO} type="submit" disabled={!v.trim()}>
        Adicionar
      </button>
    </form>
  );
}

function NovaRegiao({
  aoEnviar,
}: {
  aoEnviar: (codigo: string, nome: string) => Promise<boolean>;
}) {
  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  return (
    <form
      className="mt-md flex gap-xs"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await aoEnviar(codigo, nome)) {
          setCodigo('');
          setNome('');
        }
      }}
    >
      <input
        className={`${CAMPO} w-[120px]`}
        placeholder="Código (500)"
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
      />
      <input
        className={`${CAMPO} min-w-0 flex-1`}
        placeholder="Nome (Centro de Santo André)"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />
      <button className={BOTAO} type="submit" disabled={!codigo.trim() || !nome.trim()}>
        Adicionar região
      </button>
    </form>
  );
}
