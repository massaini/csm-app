import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Páginas dependem da sessão do usuário e de dados em tempo real: sem Cache Components.
  agentRules: false,
  // nos testes ponta a ponta o indicador do modo dev cobre botões no canto da tela
  ...(process.env.E2E === '1' ? { devIndicators: false as const } : {}),
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
