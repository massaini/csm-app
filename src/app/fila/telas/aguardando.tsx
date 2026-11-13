'use client';

import { useState } from 'react';
import { AlertBanner, Card, Chip, InfoRow } from '@/components/ui/basicos';
import { Button } from '@/components/ui/button';
import { Confirmacao } from '@/components/ui/confirmacao';
import { Logo } from '@/components/ui/logo';
import { acaoCancelar } from '../actions';
import type { EstadoDa, Fila } from '../tela-fila';

/** Tela `13:2` — Aguardando, com o overlay `144:447` de cancelamento. RF11 e RF12. */
export function TelaAguardando({ estado, fila }: { estado: EstadoDa<'AGUARDANDO'>; fila: Fila }) {
  const [confirmando, setConfirmando] = useState(false);
  const { senha } = estado;
  const notificacoesNegadas =
    typeof Notification !== 'undefined' && Notification.permission === 'denied';

  return (
    <main className="flex flex-1 flex-col gap-base px-xl pb-xl pt-xl">
      <Logo largura={80} />

      <Card className="flex flex-col items-center text-center">
        <Chip tom="warning">Aguardando na fila</Chip>
        <p className="t-overline mt-md text-text-muted">Sua senha</p>
        <p className="t-display-l text-primary">{senha.codigo}</p>
        <p className="t-body-m mt-xs text-text-secondary">{estado.textoProximidade}</p>
        <p className="t-body-m-strong mt-xs">Rota {senha.rota}</p>
        <hr className="my-base w-full border-border-strong/60" />
        <div className="grid w-full grid-cols-2 text-left">
          <div>
            <p className="t-overline text-text-muted">Posição na fila</p>
            <p className="t-title-m mt-xs">{estado.posicao}º</p>
          </div>
          <div>
            <p className="t-overline text-text-muted">Tempo estimado</p>
            <p
              className={`mt-xs text-primary ${estado.textoTempo.startsWith('~') ? 't-title-m' : 't-title-s'}`}
            >
              {estado.textoTempo}
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <p className="t-overline mb-sm text-text-muted">Dados do carregamento</p>
        <dl>
          <InfoRow rotulo="Motorista" valor={senha.motoristaNome} />
          <InfoRow rotulo="Placa" valor={senha.placa} />
          <InfoRow rotulo="Galpão" valor={senha.galpaoNome} />
          <InfoRow rotulo="Endereço" valor={senha.galpaoEndereco} />
        </dl>
      </Card>

      {notificacoesNegadas ? (
        <AlertBanner icone="!">
          Notificações desativadas — mantenha o app aberto para ver a chamada.
        </AlertBanner>
      ) : (
        <AlertBanner icone="!">Você receberá uma notificação assim que for chamado.</AlertBanner>
      )}

      <Button kind="danger" onClick={() => setConfirmando(true)}>
        Cancelar senha
      </Button>

      <Confirmacao
        aberta={confirmando}
        titulo="Cancelar senha?"
        texto={`Você perderá sua posição atual (${estado.posicao}º) e precisará gerar uma nova senha.`}
        confirmar="Sim, cancelar senha"
        perigo
        pendente={fila.enviando}
        aoFechar={() => setConfirmando(false)}
        aoConfirmar={async () => {
          await fila.executar(() => acaoCancelar(senha.id));
          setConfirmando(false);
        }}
      />
    </main>
  );
}
