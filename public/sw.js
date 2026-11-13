/* Service worker da CSM Fila Digital — SÓ push (PRD §9.2).
 * Não faz cache de /_next/ nem de HTML: cachear chunks com hash quebra o app instalado
 * depois de um deploy. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let dados = {};
  try {
    dados = event.data ? event.data.json() : {};
  } catch {
    dados = { corpo: event.data ? event.data.text() : '' };
  }
  const titulo = dados.titulo || 'CSM Fila Digital';
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: dados.corpo || '',
      tag: dados.tag || 'csm-fila',
      renotify: true,
      requireInteraction: true,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: dados.url || '/fila' },
    }),
  );
});

/** RF18-CA4: tocar na notificação abre (ou foca) o app em /fila. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/fila', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const j of janelas) {
        if (j.url.startsWith(self.location.origin) && 'focus' in j) {
          if ('navigate' in j) j.navigate(url);
          return j.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

/** RF05-CA5: inscrição renovada pelo navegador é reenviada ao servidor. */
self.addEventListener('pushsubscriptionchange', (event) => {
  const antiga = event.oldSubscription;
  const opcoes = antiga && antiga.options ? antiga.options : null;
  const renovar = event.newSubscription
    ? Promise.resolve(event.newSubscription)
    : opcoes
      ? self.registration.pushManager.subscribe(opcoes)
      : Promise.resolve(null);
  event.waitUntil(
    renovar.then((nova) =>
      nova
        ? fetch('/api/push/inscricao', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nova.toJSON ? nova.toJSON() : nova),
          })
        : undefined,
    ),
  );
});
