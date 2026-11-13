import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Páginas dependem da sessão do usuário e de dados em tempo real: sem Cache Components.
  agentRules: false,
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
