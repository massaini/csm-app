'use client';

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

const ITENS = '[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"]';

/**
 * Menu suspenso acessível (botão "⋮" das linhas, "Filtrar por"). Abre em posição fixa, para não
 * ser cortado pela rolagem da tabela; fecha com Esc, clique fora, rolagem ou ao escolher um item.
 * Setas, Home e End movem o foco entre os itens.
 */
export function Menu({
  rotulo,
  conteudoDoBotao,
  classeDoBotao,
  largura = 240,
  aoAbrir,
  children,
}: {
  /** nome acessível do botão (ex.: "Ações de João da Silva") */
  rotulo: string;
  conteudoDoBotao: ReactNode;
  classeDoBotao: string;
  largura?: number;
  aoAbrir?: () => void;
  children: (fechar: () => void) => ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const [posicao, setPosicao] = useState<{ top: number; left: number } | null>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const painel = useRef<HTMLDivElement>(null);
  const id = useId();

  // ao fechar por Esc ou escolhendo um item, o foco volta ao botão (no efeito, não no render)
  const [pedidosDeFoco, setPedidosDeFoco] = useState(0);
  const fechar = useCallback((devolver = true) => {
    setAberto(false);
    if (devolver) setPedidosDeFoco((n) => n + 1);
  }, []);
  useEffect(() => {
    if (pedidosDeFoco > 0) botao.current?.focus();
  }, [pedidosDeFoco]);

  // posiciona abaixo do botão, alinhado à direita; se faltar espaço embaixo, abre para cima
  useLayoutEffect(() => {
    if (!aberto || !botao.current) return;
    const r = botao.current.getBoundingClientRect();
    const altura = painel.current?.offsetHeight ?? 0;
    const abaixo = r.bottom + 4 + altura <= window.innerHeight;
    setPosicao({
      top: abaixo ? r.bottom + 4 : Math.max(8, r.top - 4 - altura),
      left: Math.max(8, Math.min(r.right - largura, window.innerWidth - largura - 8)),
    });
  }, [aberto, largura]);

  useEffect(() => {
    if (!aberto) return;
    painel.current?.querySelector<HTMLElement>(ITENS)?.focus();
    const foraDoMenu = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (!painel.current?.contains(alvo) && !botao.current?.contains(alvo)) fechar(false);
    };
    const aoRolar = (e: Event) => {
      if (!painel.current?.contains(e.target as Node)) fechar(false);
    };
    document.addEventListener('mousedown', foraDoMenu);
    window.addEventListener('scroll', aoRolar, true);
    window.addEventListener('resize', aoRolar);
    return () => {
      document.removeEventListener('mousedown', foraDoMenu);
      window.removeEventListener('scroll', aoRolar, true);
      window.removeEventListener('resize', aoRolar);
    };
  }, [aberto, fechar]);

  function teclado(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      fechar();
      return;
    }
    if (e.key === 'Tab') {
      fechar(false);
      return;
    }
    const itens = [...(painel.current?.querySelectorAll<HTMLElement>(ITENS) ?? [])].filter(
      (i) => !i.hasAttribute('disabled'),
    );
    if (!itens.length) return;
    const atual = itens.indexOf(document.activeElement as HTMLElement);
    const proximo =
      e.key === 'ArrowDown'
        ? (atual + 1) % itens.length
        : e.key === 'ArrowUp'
          ? (atual - 1 + itens.length) % itens.length
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? itens.length - 1
              : -1;
    if (proximo >= 0) {
      e.preventDefault();
      itens[proximo].focus();
    }
  }

  return (
    <>
      <button
        ref={botao}
        type="button"
        aria-label={rotulo}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? id : undefined}
        className={classeDoBotao}
        onClick={() => {
          if (!aberto) aoAbrir?.();
          setAberto(!aberto);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !aberto) {
            e.preventDefault();
            aoAbrir?.();
            setAberto(true);
          }
        }}
      >
        {conteudoDoBotao}
      </button>
      {aberto ? (
        <div
          ref={painel}
          id={id}
          role="menu"
          aria-label={rotulo}
          onKeyDown={teclado}
          style={{
            position: 'fixed',
            top: posicao?.top ?? -9999,
            left: posicao?.left ?? -9999,
            width: largura,
          }}
          className="z-50 flex flex-col rounded-md border border-border-strong bg-surface p-xs shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
        >
          {children(fechar)}
        </div>
      ) : null}
    </>
  );
}

const ITEM =
  't-body-m flex w-full items-center gap-sm rounded-sm px-md py-sm text-left outline-none hover:bg-elevated focus-visible:bg-elevated disabled:cursor-not-allowed disabled:opacity-40';

export function ItemDoMenu({
  aoEscolher,
  perigo = false,
  desabilitado = false,
  children,
}: {
  aoEscolher: () => void;
  perigo?: boolean;
  desabilitado?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      disabled={desabilitado}
      onClick={aoEscolher}
      className={`${ITEM} ${perigo ? 'text-danger' : 'text-text-primary'}`}
    >
      {children}
    </button>
  );
}

/** Opção que liga/desliga (subfiltro de opções fechadas). */
export function ItemMarcavel({
  marcado,
  aoAlternar,
  children,
}: {
  marcado: boolean;
  aoAlternar: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={marcado}
      tabIndex={-1}
      onClick={aoAlternar}
      className={`${ITEM} text-text-primary`}
    >
      <span
        aria-hidden
        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-sm border ${
          marcado ? 'border-primary bg-primary text-on-primary' : 'border-border-strong'
        }`}
      >
        {marcado ? '✓' : null}
      </span>
      {children}
    </button>
  );
}

export function SeparadorDoMenu() {
  return <hr role="separator" className="my-xs border-border-strong" />;
}
