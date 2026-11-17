'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { BotaoDaTabela } from '@/components/admin/comum';

/** Campo compacto (40 px) das telas de Bancadas e Regiões. */
export const CAMPO =
  't-body-s h-[40px] rounded-md border border-border bg-bg px-md placeholder:text-text-muted focus:border-primary focus:outline-none';
/** botão dos formulários de inclusão: mesma altura do campo ao lado */
export const BOTAO_FORM =
  't-button-m h-[40px] shrink-0 whitespace-nowrap rounded-md bg-primary px-base text-on-primary disabled:bg-text-muted/60';

/** Texto clicável que vira campo + Salvar/× para renomear no lugar. */
export function EdicaoInline({
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

/** Formulário de inclusão com um campo e o botão "Adicionar". */
export function FormUmCampo({
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

/** Ações em linha de um cadastro: Desativar/Reativar e Excluir lado a lado. */
export function AcoesDoCadastro({
  ativa,
  nome,
  aoAlternar,
  aoExcluir,
  extra,
}: {
  ativa: boolean;
  /** "bancada 07 do galpão F SDR", "região 545": vai no nome acessível dos botões */
  nome: string;
  aoAlternar: () => void;
  aoExcluir: () => void;
  extra?: ReactNode;
}) {
  return (
    <span className="flex shrink-0 items-center gap-sm">
      {extra}
      <BotaoDaTabela
        perigo={ativa}
        aria-label={`${ativa ? 'Desativar' : 'Reativar'} ${nome}`}
        onClick={aoAlternar}
      >
        {ativa ? 'Desativar' : 'Reativar'}
      </BotaoDaTabela>
      <BotaoDaTabela perigo aria-label={`Excluir ${nome}`} onClick={aoExcluir}>
        Excluir
      </BotaoDaTabela>
    </span>
  );
}
