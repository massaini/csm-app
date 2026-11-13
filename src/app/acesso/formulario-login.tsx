'use client';

import { useActionState, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { cpfValido, formatarCpf } from '@/domain/documentos';
import type { EstadoDoFormulario } from '@/app/acesso-actions';

type Acao = (estado: EstadoDoFormulario, dados: FormData) => Promise<EstadoDoFormulario>;

/** Campos CPF + senha da tela `10:2` (Identificação) e do login do admin. */
export function FormularioLogin({ acao }: { acao: Acao }) {
  const [estado, enviar, pendente] = useActionState(acao, {});
  const [cpf, setCpf] = useState('');
  const [erroLocal, setErroLocal] = useState<string | undefined>();

  // RF01-CA5: CPF inválido mostra o erro no campo sem chamar o servidor
  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    if (!cpfValido(cpf)) {
      e.preventDefault();
      setErroLocal('CPF inválido');
    }
  }

  return (
    <form action={enviar} onSubmit={aoEnviar} className="flex flex-1 flex-col" noValidate>
      <div className="flex flex-1 flex-col justify-center gap-md py-2xl">
        <Field
          label="CPF"
          name="cpf"
          inputMode="numeric"
          autoComplete="username"
          placeholder="000.000.000-00"
          value={cpf}
          onChange={(e) => {
            setCpf(formatarCpf(e.target.value));
            setErroLocal(undefined);
          }}
          erro={erroLocal ?? estado.erros?.cpf}
        />
        <Field
          label="Senha"
          name="senha"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          erro={estado.erros?.senha}
        />
        {estado.erro ? (
          <p role="alert" className="t-body-s text-danger">
            {estado.erro}
          </p>
        ) : null}
      </div>
      <Button type="submit" disabled={pendente}>
        {pendente ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  );
}
