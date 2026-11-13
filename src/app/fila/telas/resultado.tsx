'use client';

import { Card, InfoRow } from '@/components/ui/basicos';
import { Button } from '@/components/ui/button';
import { acaoVerResultado } from '../actions';
import type { EstadoDa, Fila } from '../tela-fila';

const TEXTOS = {
  EXPIRADA: {
    titulo: 'Você perdeu a vez',
    corpo: 'Você não confirmou a chamada a tempo. Gere uma nova senha para voltar à fila.',
    botao: 'Gerar nova senha',
  },
  FIM_DO_DIA: {
    titulo: 'Sua senha expirou',
    corpo: 'A fila foi encerrada na virada do dia. Gere uma nova senha.',
    botao: 'Gerar nova senha',
  },
  ENCERRADA_SISTEMA: {
    titulo: 'Atendimento encerrado',
    corpo: 'Seu atendimento foi encerrado automaticamente na virada do dia.',
    botao: 'Voltar ao início',
  },
} as const;

const min = (n: number) => `${n} min`;

/** `19:35` (Concluído) e as telas de resultado da PRD §10.5. RF07-CA2/CA4, RF14-CA4. */
export function TelaResultado({ estado, fila }: { estado: EstadoDa<'RESULTADO'>; fila: Fila }) {
  const voltar = () => void fila.executar(() => acaoVerResultado());

  if (estado.resultado === 'CONCLUIDA') {
    const { senha, tempos } = estado;
    return (
      <main className="flex flex-1 flex-col items-center px-xl pb-xl pt-3xl text-center">
        <div
          aria-hidden
          className="flex h-[120px] w-[120px] items-center justify-center rounded-full bg-success/15"
        >
          <div className="flex h-[80px] w-[80px] items-center justify-center rounded-full bg-success">
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#050b1f"
              strokeWidth="3"
            >
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </div>
        </div>
        <h1 className="t-title-l mt-xl">Carregamento concluído</h1>
        <p className="t-body-m mt-md text-text-secondary">
          Tudo certo. Boa viagem e dirija com segurança.
        </p>

        <Card className="mt-3xl w-full text-left">
          <p className="t-overline mb-sm text-text-muted">Resumo do atendimento</p>
          <dl>
            <InfoRow rotulo="Senha" valor={senha.codigo} />
            <InfoRow rotulo="Bancada" valor={senha.bancada} />
            <InfoRow rotulo="Rota" valor={senha.rota} />
            <InfoRow rotulo="Tempo de espera" valor={tempos ? min(tempos.esperaMin) : '—'} />
            <InfoRow
              rotulo="Tempo de carregamento"
              valor={tempos ? min(tempos.carregamentoMin) : '—'}
            />
            <InfoRow rotulo="Total" valor={tempos ? min(tempos.totalMin) : '—'} />
          </dl>
        </Card>

        <Button className="mt-auto" disabled={fila.enviando} onClick={voltar}>
          Voltar ao início
        </Button>
      </main>
    );
  }

  const t = TEXTOS[estado.resultado];
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-md px-xl pb-xl text-center">
      <h1 className="t-title-l">{t.titulo}</h1>
      <p className="t-body-m text-text-secondary">{t.corpo}</p>
      <p className="t-body-s text-text-muted">Senha {estado.senha.codigo}</p>
      <Button className="mt-xl" disabled={fila.enviando} onClick={voltar}>
        {t.botao}
      </Button>
    </main>
  );
}
