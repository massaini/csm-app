import type { MetadataRoute } from 'next';

/** RF23-CA1 — manifest do PWA (cores do DS, standalone, ícones gerados do logo). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CSM Fila Digital',
    short_name: 'CSM Fila',
    description: 'Fila digital de carregamento da CSM',
    lang: 'pt-BR',
    start_url: '/fila',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#050b1f',
    theme_color: '#050b1f',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
