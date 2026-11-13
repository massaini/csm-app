'use client';

/** Flag local de "Agora não" (RF05-CA6); apagada no logout. */
export const FLAG_AGORA_NAO = 'csm:notificacoes-agora-nao';

export function suportaPush(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** iPhone fora do modo instalado: lá não existe push (RF05-CA4). */
export function iphoneSemInstalar(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const instalado =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !instalado;
}

export async function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  return navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

function chaveParaBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const bruto = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(new ArrayBuffer(bruto.length));
  for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i);
  return bytes;
}

async function enviarInscricao(s: PushSubscription) {
  await fetch('/api/push/inscricao', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(s.toJSON()),
  });
}

/**
 * Com a permissão concedida, garante a inscrição e faz o upsert no servidor. Chamado a cada
 * abertura do app: é o mecanismo principal de renovação (RF05-CA1).
 */
export async function sincronizarInscricao(chavePublica: string): Promise<PushSubscription | null> {
  if (!suportaPush() || Notification.permission !== 'granted' || !chavePublica) return null;
  const reg = (await registrarServiceWorker()) ?? (await navigator.serviceWorker.ready);
  const s =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: chaveParaBytes(chavePublica),
    }));
  await enviarInscricao(s);
  return s;
}

/** Pede a permissão (precisa de gesto do usuário) e inscreve o aparelho. */
export async function ativarNotificacoes(chavePublica: string): Promise<NotificationPermission> {
  if (!suportaPush()) return 'denied';
  const permissao = await Notification.requestPermission();
  if (permissao === 'granted') await sincronizarInscricao(chavePublica);
  return permissao;
}

/** Endpoint da inscrição deste aparelho, para o logout apagá-la (RF04-CA2). */
export async function endpointAtual(): Promise<string | null> {
  if (!suportaPush()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  const s = await reg?.pushManager.getSubscription();
  return s?.endpoint ?? null;
}
