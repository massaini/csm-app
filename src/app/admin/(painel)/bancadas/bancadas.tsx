'use client';

import { useState } from 'react';
import { CabecalhoDaTela, FALHA_AO_ENVIAR, tentar } from '@/components/admin/comum';
import { AcoesDoCadastro, EdicaoInline, FormUmCampo } from '@/components/admin/edicao';
import { Card, Chip, MensagemDeErro } from '@/components/ui/basicos';
import { Button } from '@/components/ui/button';
import { Confirmacao } from '@/components/ui/confirmacao';
import { Dialogo } from '@/components/ui/dialogo';
import type { dadosBancadasRegioes, Resultado } from '@/server/cadastros';
import { alterarAtivaBancada, excluirBancada, novaBancada, renomearBancada } from '../cadastros-actions';

type Dados = Awaited<ReturnType<typeof dadosBancadasRegioes>>;
type GalpaoDados = Dados['galpoes'][number];
type BancadaDados = GalpaoDados['bancadas'][number];

/** Quantas bancadas cada card mostra; o resto fica em "Ver mais" (modal). */
const BANCADAS_NO_CARD = 5;

/** RF25 — bancadas por galpão: adicionar, renomear, desativar/reativar e excluir. */
export function Bancadas({ dados }: { dados: Dados }) {
  const [erro, setErro] = useState<string | null>(null);
  const [verTodas, setVerTodas] = useState<number | null>(null);
  const [excluindo, setExcluindo] = useState<{ g: GalpaoDados; b: BancadaDados } | null>(null);
  const [enviando, setEnviando] = useState(false);

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

  // o modal lê o galpão dos dados atuais: desativar/renomear dentro dele atualiza a lista
  const galpaoAberto = dados.galpoes.find((g) => g.id === verTodas) ?? null;

  function linhaDaBancada(g: GalpaoDados, b: BancadaDados) {
    const nome = `bancada ${b.identificacao} do galpão ${g.nome}`;
    return (
      <li
        key={b.id}
        className="flex min-h-[52px] items-center justify-between gap-sm px-base py-sm"
      >
        <span className="flex items-center gap-sm">
          <EdicaoInline
            valor={b.identificacao}
            prefixo="Bancada "
            rotulo={nome}
            aoSalvar={(v) => rodar(() => renomearBancada(b.id, v))}
          />
          {b.ativa ? null : <Chip tom="neutral">Inativa</Chip>}
        </span>
        <AcoesDoCadastro
          ativa={b.ativa}
          nome={nome}
          aoAlternar={() => void rodar(() => alterarAtivaBancada(b.id, !b.ativa))}
          aoExcluir={() => setExcluindo({ g, b })}
        />
      </li>
    );
  }

  async function confirmarExclusao() {
    if (!excluindo) return;
    setEnviando(true);
    await rodar(() => excluirBancada(excluindo.b.id));
    setEnviando(false);
    setExcluindo(null);
  }

  return (
    <main>
      <CabecalhoDaTela
        titulo="Bancadas"
        subtitulo="Cada galpão tem suas bancadas. Uma bancada atende um motorista por vez."
      />
      {erro && !galpaoAberto ? <MensagemDeErro className="mt-base">{erro}</MensagemDeErro> : null}

      <div className="mt-xl grid grid-cols-[repeat(auto-fill,minmax(400px,1fr))] gap-base">
        {dados.galpoes.map((g) => {
          const ativas = g.bancadas.filter((b) => b.ativa).length;
          return (
            <Card key={g.id} className="flex flex-col !p-0">
              <header className="flex items-baseline justify-between gap-sm px-base pb-sm pt-base">
                <h2 className="t-title-s">{g.nome}</h2>
                <span className="t-caption text-text-muted">
                  {ativas} {ativas === 1 ? 'bancada ativa' : 'bancadas ativas'}
                </span>
              </header>
              <ul className="flex flex-col divide-y divide-border border-y border-border">
                {g.bancadas.length === 0 ? (
                  <li className="t-body-s px-base py-md text-text-muted">Nenhuma bancada</li>
                ) : null}
                {g.bancadas.slice(0, BANCADAS_NO_CARD).map((b) => linhaDaBancada(g, b))}
                {g.bancadas.length > BANCADAS_NO_CARD ? (
                  <li className="px-base py-sm">
                    <button
                      type="button"
                      onClick={() => setVerTodas(g.id)}
                      aria-label={`Ver mais bancadas do galpão ${g.nome}`}
                      className="t-button-m flex h-[36px] w-full items-center justify-center rounded-md text-primary hover:bg-elevated"
                    >
                      Ver mais ({g.bancadas.length - BANCADAS_NO_CARD})
                    </button>
                  </li>
                ) : null}
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

      <Dialogo
        aberto={galpaoAberto !== null}
        titulo={galpaoAberto ? `Bancadas · ${galpaoAberto.nome}` : 'Bancadas'}
        aoFechar={() => setVerTodas(null)}
      >
        {galpaoAberto ? (
          <>
            {erro ? <MensagemDeErro>{erro}</MensagemDeErro> : null}
            <ul className="-mx-base flex max-h-[60dvh] flex-col divide-y divide-border overflow-y-auto border-y border-border">
              {galpaoAberto.bancadas.map((b) => linhaDaBancada(galpaoAberto, b))}
            </ul>
            <Button kind="secondary" className="mt-base" onClick={() => setVerTodas(null)}>
              Fechar
            </Button>
          </>
        ) : null}
      </Dialogo>

      <Confirmacao
        aberta={excluindo !== null}
        titulo="Excluir bancada?"
        texto={`A bancada ${excluindo?.b.identificacao ?? ''} do galpão ${
          excluindo?.g.nome ?? ''
        } sai do cadastro. Não dá para desfazer. Se ela já teve senhas, use Desativar.`}
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
