import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CSM Fila Digital',
  description: 'Fila digital de carregamento da CSM',
  applicationName: 'CSM Fila Digital',
  icons: {
    icon: [{ url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  // iPhone: abre em tela cheia quando adicionado à Tela de Início (necessário para o push)
  appleWebApp: { capable: true, title: 'CSM Fila', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: '#050b1f',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
