import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Páginas dependem da sessão do usuário e de dados em tempo real: sem Cache Components.
  agentRules: false,
  // nos testes ponta a ponta o indicador do modo dev cobre botões no canto da tela
  // pasta própria para o E2E rodar com o `next dev` do desenvolvedor aberto ao mesmo tempo
  ...(process.env.E2E === '1' ? { devIndicators: false as const, distDir: '.next-e2e' } : {}),
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
