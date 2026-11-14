'use client';

import { TelaDeErro } from '@/components/ui/estados';

export default function Erro({ retry }: { error: Error; retry: () => void }) {
  return <TelaDeErro aoTentarDeNovo={retry} />;
}
