'use client';

import { useState } from 'react';
import { formatarDia } from '@/domain/formato';
import { ItemDoMenu, ItemMarcavel, Menu, SeparadorDoMenu } from '@/components/ui/menu';

export interface Opcao {
  valor: string;
  rotulo: string;
}

export type Campo =
  | { chave: string; rotulo: string; tipo: 'texto' }
  | { chave: string; rotulo: string; tipo: 'opcoes'; opcoes: Opcao[] }
  | { chave: string; rotulo: string; tipo: 'periodo'; atalhos: AtalhoDePeriodo[] };

export interface Periodo {
  diaInicio: string;
  diaFim: string;
}

export interface AtalhoDePeriodo extends Periodo {
  rotulo: string;
}

/** RF31: texto num campo (Nome por padrão) + opções escolhidas por campo + período. */
export interface EstadoBusca {
  texto: string;
  campoTexto: string;
  selecoes: Record<string, string[]>;
  periodo?: Periodo;
}

export function estadoInicial(parcial: Partial<EstadoBusca> = {}): EstadoBusca {
  return { texto: '', campoTexto: 'nome', selecoes: {}, ...parcial };
}

export const textoDoPeriodo = (p: Periodo) =>
  p.diaInicio === p.diaFim
    ? formatarDia(p.diaInicio)
    : `${formatarDia(p.diaInicio)} – ${formatarDia(p.diaFim)}`;

const CAMPO =
  't-body-s h-[44px] w-full rounded-md border border-border bg-surface pl-[36px] pr-md text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none';

/** Foca o primeiro item depois que o menu troca de nível (campos ⇄ opções). */
function focarPrimeiroItem() {
  requestAnimationFrame(() =>
    document
      .querySelector<HTMLElement>(
        '[role="menu"] [role="menuitem"], [role="menu"] [role="menuitemcheckbox"]',
      )
      ?.focus(),
  );
}

export function BarraDeBusca({
  campos,
  estado,
  aoMudar,
  periodoPadrao,
  etiquetasExtras = [],
}: {
  campos: Campo[];
  estado: EstadoBusca;
  aoMudar: (e: EstadoBusca) => void;
  /** remover a etiqueta de período volta a este período */
  periodoPadrao?: Periodo;
  /** filtros que não vêm do "Filtrar por" (ex.: o motorista do "Ver histórico") */
  etiquetasExtras?: { texto: string; aoRemover: () => void }[];
}) {
  const [nivel, setNivel] = useState<string | null>(null);
  const [personalizado, setPersonalizado] = useState<Periodo | null>(null);
  const campoTexto =
    campos.find((c) => c.chave === estado.campoTexto && c.tipo === 'texto') ?? campos[0];
  const aberto = campos.find((c) => c.chave === nivel);

  function alternar(chave: string, valor: string) {
    const atuais = estado.selecoes[chave] ?? [];
    const novos = atuais.includes(valor) ? atuais.filter((v) => v !== valor) : [...atuais, valor];
    aoMudar({ ...estado, selecoes: { ...estado.selecoes, [chave]: novos } });
  }

  const etiquetas = campos.flatMap((c) =>
    c.tipo === 'opcoes'
      ? (estado.selecoes[c.chave] ?? []).map((v) => ({
          chave: c.chave,
          valor: v,
          texto: `${c.rotulo}: ${c.opcoes.find((o) => o.valor === v)?.rotulo ?? v}`,
        }))
      : [],
  );
  const campoPeriodo = campos.find((c) => c.tipo === 'periodo');
  const periodoMudou =
    estado.periodo &&
    periodoPadrao &&
    (estado.periodo.diaInicio !== periodoPadrao.diaInicio ||
      estado.periodo.diaFim !== periodoPadrao.diaFim);

  return (
    <div className="mt-xl flex flex-col gap-sm">
      <div className="flex gap-sm">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Buscar por {campoTexto.rotulo.toLowerCase()}</span>
          <svg
            aria-hidden
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            className="pointer-events-none absolute left-md top-1/2 -translate-y-1/2 text-text-muted"
          >
            <circle cx="7" cy="7" r="4.5" />
            <path d="m10.5 10.5 3 3" />
          </svg>
          <input
            type="search"
            className={CAMPO}
            placeholder={`Buscar por ${campoTexto.rotulo.toLowerCase()}`}
            value={estado.texto}
            onChange={(e) => aoMudar({ ...estado, texto: e.target.value })}
          />
        </label>
        <Menu
          rotulo="Filtrar por"
          largura={260}
          aoAbrir={() => setNivel(null)}
          classeDoBotao="t-button-m flex h-[44px] shrink-0 items-center gap-sm rounded-md border border-border-strong bg-surface px-base text-text-primary hover:bg-elevated aria-expanded:border-primary"
          conteudoDoBotao={
            <>
              <svg
                aria-hidden
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <path d="M2 3.5h12l-4.5 5.25V13l-3-1.5V8.75z" />
              </svg>
              Filtrar por
            </>
          }
        >
          {(fechar) =>
            !aberto ? (
              campos.map((c) => (
                <ItemDoMenu
                  key={c.chave}
                  aoEscolher={() => {
                    if (c.tipo === 'texto') {
                      aoMudar({ ...estado, campoTexto: c.chave });
                      fechar();
                    } else {
                      setNivel(c.chave);
                      focarPrimeiroItem();
                    }
                  }}
                >
                  <span className="flex-1">{c.rotulo}</span>
                  {c.tipo === 'texto' && c.chave === campoTexto.chave ? (
                    <span className="t-caption text-primary">na busca</span>
                  ) : c.tipo !== 'texto' ? (
                    <span aria-hidden className="text-text-muted">
                      ›
                    </span>
                  ) : null}
                </ItemDoMenu>
              ))
            ) : (
              <>
                <ItemDoMenu
                  aoEscolher={() => {
                    setNivel(null);
                    focarPrimeiroItem();
                  }}
                >
                  <span aria-hidden>‹</span> {aberto.rotulo}
                </ItemDoMenu>
                <SeparadorDoMenu />
                {aberto.tipo === 'opcoes' ? (
                  <div className="flex max-h-[320px] flex-col overflow-y-auto">
                    {aberto.opcoes.length === 0 ? (
                      <p className="t-body-s px-md py-sm text-text-muted">Nenhuma opção</p>
                    ) : null}
                    {aberto.opcoes.map((o) => (
                      <ItemMarcavel
                        key={o.valor}
                        marcado={(estado.selecoes[aberto.chave] ?? []).includes(o.valor)}
                        aoAlternar={() => alternar(aberto.chave, o.valor)}
                      >
                        {o.rotulo}
                      </ItemMarcavel>
                    ))}
                  </div>
                ) : null}
                {aberto.tipo === 'periodo' ? (
                  <>
                    {aberto.atalhos.map((a) => (
                      <ItemDoMenu
                        key={a.rotulo}
                        aoEscolher={() => {
                          aoMudar({
                            ...estado,
                            periodo: { diaInicio: a.diaInicio, diaFim: a.diaFim },
                          });
                          setPersonalizado(null);
                          fechar();
                        }}
                      >
                        {a.rotulo}
                      </ItemDoMenu>
                    ))}
                    <SeparadorDoMenu />
                    <form
                      className="flex flex-col gap-sm px-md py-sm"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const p = personalizado ?? estado.periodo;
                        if (!p || p.diaInicio > p.diaFim) return;
                        aoMudar({ ...estado, periodo: p });
                        fechar();
                      }}
                    >
                      <span className="t-overline text-text-muted">Personalizado</span>
                      <label className="t-body-s flex items-center justify-between gap-sm">
                        De
                        <input
                          type="date"
                          className="t-body-s h-[36px] rounded-md border border-border bg-bg px-sm"
                          value={(personalizado ?? estado.periodo)?.diaInicio ?? ''}
                          onChange={(e) =>
                            setPersonalizado({
                              diaInicio: e.target.value,
                              diaFim: (personalizado ?? estado.periodo)?.diaFim ?? e.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="t-body-s flex items-center justify-between gap-sm">
                        Até
                        <input
                          type="date"
                          className="t-body-s h-[36px] rounded-md border border-border bg-bg px-sm"
                          value={(personalizado ?? estado.periodo)?.diaFim ?? ''}
                          onChange={(e) =>
                            setPersonalizado({
                              diaInicio:
                                (personalizado ?? estado.periodo)?.diaInicio ?? e.target.value,
                              diaFim: e.target.value,
                            })
                          }
                        />
                      </label>
                      <button
                        type="submit"
                        className="t-button-m h-[36px] rounded-md bg-primary text-on-primary"
                      >
                        Aplicar período
                      </button>
                    </form>
                  </>
                ) : null}
              </>
            )
          }
        </Menu>
      </div>

      {etiquetas.length || campoPeriodo || etiquetasExtras.length ? (
        <ul aria-label="Filtros aplicados" className="flex flex-wrap items-center gap-sm">
          {campoPeriodo && estado.periodo ? (
            <li>
              <Etiqueta
                texto={`${campoPeriodo.rotulo}: ${textoDoPeriodo(estado.periodo)}`}
                aoRemover={
                  periodoMudou ? () => aoMudar({ ...estado, periodo: periodoPadrao }) : undefined
                }
              />
            </li>
          ) : null}
          {etiquetasExtras.map((e) => (
            <li key={e.texto}>
              <Etiqueta texto={e.texto} aoRemover={e.aoRemover} />
            </li>
          ))}
          {etiquetas.map((e) => (
            <li key={`${e.chave}:${e.valor}`}>
              <Etiqueta texto={e.texto} aoRemover={() => alternar(e.chave, e.valor)} />
            </li>
          ))}
          {etiquetas.length > 1 ? (
            <li>
              <button
                type="button"
                className="t-body-s text-text-secondary underline"
                onClick={() => aoMudar({ ...estado, selecoes: {} })}
              >
                Limpar filtros
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

function Etiqueta({ texto, aoRemover }: { texto: string; aoRemover?: () => void }) {
  return (
    <span className="t-body-s inline-flex h-[32px] items-center gap-xs rounded-full border border-primary/60 bg-primary/15 pl-md pr-xs text-primary">
      {texto}
      {aoRemover ? (
        <button
          type="button"
          aria-label={`Remover filtro ${texto}`}
          onClick={aoRemover}
          className="flex h-[24px] w-[24px] items-center justify-center rounded-full hover:bg-primary/20"
        >
          ×
        </button>
      ) : (
        <span className="w-xs" />
      )}
    </span>
  );
}

/* --------------------------------------------- filtro e ordenação locais (listas pequenas) */

export interface Ordem {
  coluna: string;
  direcao: 'asc' | 'desc';
}

/** Aplica a busca e as opções a uma lista que já está toda no cliente (Motoristas, Administradores). */
export function filtrarLocal<T>(
  lista: T[],
  estado: EstadoBusca,
  valores: Record<string, (item: T) => string | string[]>,
): T[] {
  const termo = estado.texto.trim().toLowerCase();
  const digitos = termo.replace(/\D/g, '');
  return lista.filter((item) => {
    if (termo) {
      const v = [valores[estado.campoTexto]?.(item) ?? ''].flat().join(' ').toLowerCase();
      const numerico = estado.campoTexto === 'cpf' || estado.campoTexto === 'telefone';
      if (numerico ? !digitos || !v.replace(/\D/g, '').includes(digitos) : !v.includes(termo))
        return false;
    }
    return Object.entries(estado.selecoes).every(([chave, escolhidos]) => {
      if (!escolhidos.length) return true;
      const v = [valores[chave]?.(item) ?? []].flat();
      return escolhidos.some((e) => v.includes(e));
    });
  });
}

export function ordenarLocal<T>(
  lista: T[],
  ordem: Ordem | null,
  valores: Record<string, (item: T) => string | number | null>,
): T[] {
  if (!ordem || !valores[ordem.coluna]) return lista;
  const f = valores[ordem.coluna];
  const sinal = ordem.direcao === 'asc' ? 1 : -1;
  return [...lista].sort((a, b) => {
    const va = f(a);
    const vb = f(b);
    if (va === vb) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return (
      sinal *
      (typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb), 'pt-BR', { numeric: true }))
    );
  });
}

/** Clique no cabeçalho: ordena pela coluna; o segundo clique inverte (RF31-CA3). */
export function proximaOrdem(atual: Ordem | null, coluna: string, inicial: 'asc' | 'desc' = 'asc') {
  if (atual?.coluna !== coluna) return { coluna, direcao: inicial };
  return { coluna, direcao: atual.direcao === 'asc' ? 'desc' : 'asc' } as Ordem;
}
