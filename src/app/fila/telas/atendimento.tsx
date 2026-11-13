'use client';

import { useState } from 'react';
import { Card, Chip, InfoRow } from '@/components/ui/basicos';
import { Button } from '@/components/ui/button';
import { Confirmacao } from '@/components/ui/confirmacao';
import { Logo } from '@/components/ui/logo';
import { acaoConcluir } from '../actions';
import type { EstadoDa, Fila } from '../tela-fila';
import { useTique } from '../use-estado-fila';

const horaMinuto = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });

function hhmmss(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

/** Tela `19:2` — Em atendimento, com o botão novo "Concluir atendimento" (RF14). */
export function TelaAtendimento({
  estado,
  fila,
}: {
  estado: EstadoDa<'EM_ATENDIMENTO'>;
  fila: Fila;
}) {
  useTique(1_000);
  const [confirmando, setConfirmando] = useState(false);
  const { senha } = estado;
  const decorrido = fila.agoraServidor() - Date.parse(estado.chamadaEm);

  return (
    <main className="flex flex-1 flex-col gap-base px-xl pb-xl pt-xl">
      {/* RF14-CA6: sem a seta "←" — a tela não tem para onde voltar */}
      <header className="flex items-center justify-between">
        <Logo largura={80} />
        <Chip tom="success">Em atendimento</Chip>
      </header>

      <Card className="flex flex-col items-center text-center">
        <p className="t-overline text-text-muted">Vá para a bancada</p>
        <p className="mt-xs text-[88px] font-bold leading-none tracking-[-2px] text-primary">
          {senha.bancada}
        </p>
        <p className="t-body-m mt-md text-text-secondary">
          Apresente a senha {senha.codigo} ao conferente
        </p>
      </Card>

      {/* RF14-CA5: só o cronômetro, sem a barra de etapas do Figma */}
      <Card className="flex items-center justify-between">
        <p className="t-overline text-text-muted">Carregamento</p>
        <p className="t-title-m tabular-nums">{hhmmss(decorrido)}</p>
      </Card>

      <Card>
        <dl>
          <InfoRow rotulo="Senha" valor={senha.codigo} />
          <InfoRow rotulo="Início" valor={horaMinuto(estado.chamadaEm)} />
          <InfoRow rotulo="Placa" valor={senha.placa} />
          <InfoRow rotulo="Galpão" valor={senha.galpaoNome} />
          <InfoRow rotulo="Endereço" valor={senha.galpaoEndereco} />
          <InfoRow rotulo="Rota" valor={senha.rota} />
          <InfoRow rotulo="Conferente" valor={estado.conferente ?? '—'} />
        </dl>
      </Card>

      <Button className="mt-auto" onClick={() => setConfirmando(true)}>
        Concluir atendimento
      </Button>

      <Confirmacao
        aberta={confirmando}
        titulo="Concluir atendimento?"
        texto="Confirme só depois de terminar o carregamento."
        confirmar="Concluir"
        pendente={fila.enviando}
        aoFechar={() => setConfirmando(false)}
        aoConfirmar={async () => {
          await fila.executar(() => acaoConcluir(senha.id));
          setConfirmando(false);
        }}
      />
    </main>
  );
}
