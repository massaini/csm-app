// web-push 4.x é ESM sem export default
import { WebPushError, sendNotification, setVapidDetails } from 'web-push';
import type { PrismaClient } from '@/generated/prisma/client';
import type { Clock } from '@/domain/clock';

export interface InscricaoPush {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface OpcoesEnvio {
  TTL: number;
  urgency: 'high';
  topic: string;
}

/** Função que fala com o serviço de push (injetável para testes). Devolve o status HTTP. */
export type EnviarPush = (
  inscricao: InscricaoPush,
  carga: string,
  opcoes: OpcoesEnvio,
) => Promise<number>;

let vapidConfigurado = false;

/** Envio real via `web-push` com as chaves VAPID do ambiente. */
export const enviarViaWebPush: EnviarPush = async (inscricao, carga, opcoes) => {
  if (!vapidConfigurado) {
    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
      throw new Error('Chaves VAPID não configuradas');
    }
    setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    vapidConfigurado = true;
  }
  try {
    const r = await sendNotification(inscricao, carga, opcoes);
    return r.statusCode;
  } catch (e) {
    if (e instanceof WebPushError) return e.statusCode;
    throw e;
  }
};

/** RF18-CA4: o cabeçalho `Topic` aceita no máximo 32 caracteres base64url. */
export function topicoDaSenha(senhaId: number): string {
  return `senha${senhaId}`.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
}

/**
 * RF05-CA2 — upsert pela `endpoint` (chave única). Num celular compartilhado, a inscrição
 * passa para o motorista logado.
 */
export async function inscrever(
  deps: { db: PrismaClient; clock: Clock },
  motoristaId: number,
  i: InscricaoPush,
) {
  const dados = {
    p256dh: i.keys.p256dh,
    auth: i.keys.auth,
    motoristaId,
    atualizadaEm: deps.clock.agora(),
  };
  await deps.db.pushSubscription.upsert({
    where: { endpoint: i.endpoint },
    update: dados,
    create: { endpoint: i.endpoint, ...dados },
  });
}

export interface ResumoDoEnvio {
  enviados: number;
  removidos: number;
}

/**
 * RF18-CA4/CA5 — avisa o motorista chamado em todas as inscrições dele. Cada envio vira um
 * `EnvioPush` com o status HTTP; 404/410 apagam a inscrição. Falhas nunca desfazem a chamada.
 */
export async function enviarChamada(
  deps: { db: PrismaClient; clock: Clock; enviar?: EnviarPush },
  senhaId: number,
): Promise<ResumoDoEnvio> {
  const { db } = deps;
  const enviar = deps.enviar ?? enviarViaWebPush;
  const senha = await db.senha.findUnique({ where: { id: senhaId } });
  if (!senha || senha.status !== 'CHAMADA') return { enviados: 0, removidos: 0 };
  const inscricoes = await db.pushSubscription.findMany({
    where: { motoristaId: senha.motoristaId },
  });
  const tolerancia = senha.toleranciaMinNaChamada ?? 5;
  const carga = JSON.stringify({
    titulo: 'Você foi chamado',
    corpo: `Dirija-se à bancada ${senha.bancadaIdentificacao} · Senha ${senha.codigo}`,
    url: '/fila',
    tag: topicoDaSenha(senha.id),
  });
  const opcoes: OpcoesEnvio = {
    TTL: tolerancia * 60,
    urgency: 'high',
    topic: topicoDaSenha(senha.id),
  };

  let enviados = 0;
  let removidos = 0;
  for (const s of inscricoes) {
    let status: number | null = null;
    try {
      status = await enviar(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        carga,
        opcoes,
      );
    } catch (e) {
      console.error(
        JSON.stringify({ nivel: 'erro', evento: 'push.envio', senhaId, erro: String(e) }),
      );
    }
    await db.envioPush.create({
      data: { senhaId, subscriptionId: s.id, statusHttp: status, enviadoEm: deps.clock.agora() },
    });
    if (status !== null && status >= 200 && status < 300) enviados++;
    if (status === 404 || status === 410) {
      await db.pushSubscription.deleteMany({ where: { id: s.id } });
      removidos++;
    }
  }
  return { enviados, removidos };
}
