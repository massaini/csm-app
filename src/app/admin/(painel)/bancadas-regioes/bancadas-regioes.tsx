'use client';

import { useState, type FormEvent } from 'react';
import { BotaoDaTabela, CabecalhoDaTela, FALHA_AO_ENVIAR, tentar } from '@/components/admin/comum';
import { Card, Chip, MensagemDeErro } from '@/components/ui/basicos';
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
/** botão dos formulários de inclusão: mesma altura do campo ao lado */
const BOTAO_FORM =
  't-button-m h-[40px] shrink-0 whitespace-nowrap rounded-md bg-primary px-base text-on-primary disabled:bg-text-muted/60';
/** RF25 — uma tela, três blocos: bancadas por galpão, regiões e o mapeamento. */
export function BancadasRegioes({ dados }: { dados: Dados }) {
  const [erro, setErro] = useState<string | null>(null);

  async function rodar(acao: () => Promise<Resultado>) {
    setErro(null);
    const r = await tentar(acao);
    if (!r) {
      setErro(FALHA_AO_ENVIAR);
      return false;
    }
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
      {erro ? <MensagemDeErro className="mt-base">{erro}</MensagemDeErro> : null}

      <h2 className="t-title-s mt-2xl">Bancadas por galpão</h2>
      <div className="mt-base grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-base">
        {dados.galpoes.map((g) => {
          const ativas = g.bancadas.filter((b) => b.ativa).length;
          return (
            <Card key={g.id} className="flex flex-col !p-0">
              <header className="flex items-baseline justify-between gap-sm px-base pb-sm pt-base">
                <h3 className="t-title-s">{g.nome}</h3>
                <span className="t-caption text-text-muted">
                  {ativas} {ativas === 1 ? 'bancada ativa' : 'bancadas ativas'}
                </span>
              </header>
              <ul className="flex flex-col divide-y divide-border border-y border-border">
                {g.bancadas.length === 0 ? (
                  <li className="t-body-s px-base py-md text-text-muted">Nenhuma bancada</li>
                ) : null}
                {g.bancadas.map((b) => (
                  <li
                    key={b.id}
                    className="flex min-h-[52px] items-center justify-between gap-sm px-base py-sm"
                  >
                    <span className="flex items-center gap-sm">
                      <EdicaoInline
                        valor={b.identificacao}
                        prefixo="Bancada "
                        rotulo={`bancada ${b.identificacao} do galpão ${g.nome}`}
                        aoSalvar={(v) => rodar(() => renomearBancada(b.id, v))}
                      />
                      {b.ativa ? null : <Chip tom="neutral">Inativa</Chip>}
                    </span>
                    <BotaoDaTabela
                      perigo={b.ativa}
                      onClick={() => void rodar(() => alterarAtivaBancada(b.id, !b.ativa))}
                    >
                      {b.ativa ? 'Desativar' : 'Reativar'}
                    </BotaoDaTabela>
                  </li>
                ))}
              </ul>
              <div className="mt-auto p-base">
                <FormUmCampo
                  titulo="Nova bancada"
                  placeholder="Ex.: 09"
                  rotulo={`Nova bancada no galpão ${g.nome}`}
                  aoEnviar={(v) => rodar(() => novaBancada(g.id, v))}
                />
              </div>
            </Card>
          );
        })}
      </div>

      <h2 className="t-title-s mt-2xl">Regiões</h2>
      <Card className="mt-base !p-0">
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
              <span className="flex items-center gap-sm">
                <EdicaoInline
                  valor={r.nome}
                  rotulo={`região ${r.codigo}`}
                  aoSalvar={(v) => rodar(() => renomearRegiao(r.id, v))}
                />
                {r.ativa ? null : <Chip tom="neutral">Inativa</Chip>}
              </span>
              <BotaoDaTabela
                perigo={r.ativa}
                onClick={() => void rodar(() => alterarAtivaRegiao(r.id, !r.ativa))}
              >
                {r.ativa ? 'Desativar' : 'Reativar'}
              </BotaoDaTabela>
            </li>
          ))}
        </ul>
        <div className="p-base">
          <NovaRegiao aoEnviar={(codigo, nome) => rodar(() => novaRegiao(codigo, nome))} />
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
    </main>
  );
}

function EdicaoInline({
  valor,
  prefixo = '',
  rotulo,
  aoSalvar,
}: {
  valor: string;
  prefixo?: string;
  /** o que está sendo renomeado, para o nome acessível ("bancada 07 do galpão F SDR") */
  rotulo: string;
  aoSalvar: (v: string) => Promise<boolean>;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(valor);
  const [enviando, setEnviando] = useState(false);
  if (!editando) {
    return (
      <button
        className="t-body-m text-left hover:underline"
        title="Clique para renomear"
        aria-label={`Renomear ${prefixo}${valor}`}
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
        setEnviando(true);
        const ok = await aoSalvar(texto);
        setEnviando(false);
        if (ok) setEditando(false);
      }}
    >
      <input
        autoFocus
        aria-label={`Novo nome da ${rotulo}`}
        className={`${CAMPO} w-[160px]`}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <BotaoDaTabela type="submit" disabled={enviando}>
        {enviando ? 'Salvando…' : 'Salvar'}
      </BotaoDaTabela>
      <BotaoDaTabela aria-label="Cancelar" onClick={() => setEditando(false)}>
        ×
      </BotaoDaTabela>
    </form>
  );
}

function FormUmCampo({
  titulo,
  placeholder,
  rotulo,
  aoEnviar,
}: {
  titulo: string;
  placeholder: string;
  rotulo: string;
  aoEnviar: (v: string) => Promise<boolean>;
}) {
  const [v, setV] = useState('');
  const [enviando, setEnviando] = useState(false);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    const ok = await aoEnviar(v);
    setEnviando(false);
    if (ok) setV('');
  }
  return (
    <form onSubmit={enviar} className="flex flex-col gap-xs">
      <span className="t-overline text-text-muted" aria-hidden>
        {titulo}
      </span>
      <div className="flex gap-sm">
        <input
          className={`${CAMPO} min-w-0 flex-1`}
          aria-label={rotulo}
          placeholder={placeholder}
          value={v}
          onChange={(e) => setV(e.target.value)}
        />
        <button className={BOTAO_FORM} type="submit" disabled={!v.trim() || enviando}>
          {enviando ? 'Adicionando…' : 'Adicionar'}
        </button>
      </div>
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
  const [enviando, setEnviando] = useState(false);
  return (
    <form
      className="flex flex-wrap items-end gap-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        setEnviando(true);
        const ok = await aoEnviar(codigo, nome);
        setEnviando(false);
        if (ok) {
          setCodigo('');
          setNome('');
        }
      }}
    >
      <label className="flex w-[140px] flex-col gap-xs">
        <span className="t-overline text-text-muted">Código</span>
        <input
          className={CAMPO}
          aria-label="Código da nova região"
          placeholder="Ex.: 500"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
        />
      </label>
      <label className="flex min-w-[240px] flex-1 flex-col gap-xs">
        <span className="t-overline text-text-muted">Nome</span>
        <input
          className={CAMPO}
          aria-label="Nome da nova região"
          placeholder="Ex.: Centro de Santo André"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
      </label>
      <button
        className={BOTAO_FORM}
        type="submit"
        disabled={!codigo.trim() || !nome.trim() || enviando}
      >
        {enviando ? 'Adicionando…' : 'Adicionar região'}
      </button>
    </form>
  );
}
