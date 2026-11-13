'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
  FLAG_AGORA_NAO,
  iphoneSemInstalar,
  registrarServiceWorker,
  sincronizarInscricao,
  suportaPush,
} from '@/components/push-cliente';
import type { EstadoMotorista } from '@/server/fila-motorista';
import { TabBar } from '@/components/ui/tab-bar';
import { useEstadoFila } from './use-estado-fila';
import { TelaGerar } from './telas/gerar';
import { TelaAguardando } from './telas/aguardando';
import { TelaChamado } from './telas/chamado';
import { TelaAtendimento } from './telas/atendimento';
import { TelaResultado } from './telas/resultado';

/** Roteamento de /fila pelo estado (RF07) + Tab Bar onde o Figma a mostra (RF16). */
export function TelaFila({
  inicial,
  chavePublica,
  acabouDeEntrar,
}: {
  inicial: EstadoMotorista;
  chavePublica: string;
  acabouDeEntrar: boolean;
}) {
  const fila = useEstadoFila(inicial);
  const { estado } = fila;
  const router = useRouter();

  // RF05-CA1: com permissão concedida, renova a inscrição a cada abertura; logo após o login,
  // sem senha ativa e sem "Agora não", leva à tela de notificações quando ainda não foi decidido
  useEffect(() => {
    void registrarServiceWorker().then(() => sincronizarInscricao(chavePublica));
    if (!acabouDeEntrar) return;
    let agoraNao = false;
    try {
      agoraNao = localStorage.getItem(FLAG_AGORA_NAO) === '1';
    } catch {
      /* sem armazenamento: trata como não respondido */
    }
    const semSenhaAtiva = inicial.tela === 'GERAR' || inicial.tela === 'RESULTADO';
    const indecisa =
      iphoneSemInstalar() || (suportaPush() && Notification.permission === 'default');
    router.replace(semSenhaAtiva && indecisa && !agoraNao ? '/notificacoes' : '/fila');
  }, [acabouDeEntrar, chavePublica, inicial.tela, router]);

  // RF16: sem Tab Bar em Chamado, Em atendimento e Concluído
  const comTabBar =
    estado.tela === 'GERAR' ||
    estado.tela === 'AGUARDANDO' ||
    (estado.tela === 'RESULTADO' && estado.resultado !== 'CONCLUIDA');

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col">
      {fila.semConexao ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-md bg-danger px-base py-sm"
        >
          <span className="t-body-s">Sem conexão. Verifique sua internet e tente novamente.</span>
          <button
            className="t-button-m inline-flex min-h-[44px] items-center underline"
            onClick={() => void fila.recarregar()}
          >
            Tentar novamente
          </button>
        </div>
      ) : null}
      {estado.tela === 'GERAR' ? <TelaGerar estado={estado} fila={fila} /> : null}
      {estado.tela === 'AGUARDANDO' ? <TelaAguardando estado={estado} fila={fila} /> : null}
      {estado.tela === 'CHAMADA' ? <TelaChamado estado={estado} fila={fila} /> : null}
      {estado.tela === 'EM_ATENDIMENTO' ? <TelaAtendimento estado={estado} fila={fila} /> : null}
      {estado.tela === 'RESULTADO' ? <TelaResultado estado={estado} fila={fila} /> : null}
      {comTabBar ? <TabBar ativa="fila" /> : null}
    </div>
  );
}

export type Fila = ReturnType<typeof useEstadoFila>;
export type EstadoDa<T extends EstadoMotorista['tela']> = Extract<EstadoMotorista, { tela: T }>;
