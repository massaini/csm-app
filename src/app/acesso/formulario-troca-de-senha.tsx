'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import type { EstadoDoFormulario } from '@/app/acesso-actions';

type Acao = (estado: EstadoDoFormulario, dados: FormData) => Promise<EstadoDoFormulario>;

export function FormularioTrocaDeSenha({ acao }: { acao: Acao }) {
  const [estado, enviar, pendente] = useActionState(acao, {});
  return (
    <form action={enviar} className="flex flex-1 flex-col" noValidate>
      <div className="flex flex-1 flex-col justify-center gap-md py-2xl">
        <Field
          label="Senha atual"
          name="atual"
          type="password"
          autoComplete="current-password"
          erro={estado.erros?.atual}
        />
        <Field
          label="Nova senha"
          name="nova"
          type="password"
          autoComplete="new-password"
          erro={estado.erros?.nova}
        />
        <Field
          label="Confirme a nova senha"
          name="confirma"
          type="password"
          autoComplete="new-password"
          erro={estado.erros?.confirma}
        />
        {estado.erro ? (
          <p role="alert" className="t-body-s text-danger">
            {estado.erro}
          </p>
        ) : null}
      </div>
      <Button type="submit" disabled={pendente}>
        {pendente ? 'Salvando…' : 'Salvar nova senha'}
      </Button>
    </form>
  );
}
