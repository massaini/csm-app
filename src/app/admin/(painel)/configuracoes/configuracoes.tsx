'use client';

import { useState, type FormEvent } from 'react';
import { CabecalhoDaTela } from '@/components/admin/comum';
import { Card } from '@/components/ui/basicos';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import type { lerConfiguracoes } from '@/server/cadastros';
import { salvarConfiguracoes } from '../cadastros-actions';

type Cfg = Awaited<ReturnType<typeof lerConfiguracoes>>;

const CAMPOS = [
  {
    chave: 'toleranciaMin',
    rotulo: 'Tolerância após a chamada',
    unidade: 'min',
    min: 1,
    max: 30,
    ajuda: 'Tempo para o motorista tocar "Estou a caminho". Vale para as próximas chamadas.',
  },
  {
    chave: 'carenciaSeg',
    rotulo: 'Carência de sinal',
    unidade: 's',
    min: 0,
    max: 120,
    ajuda: 'Folga depois da tolerância para confirmações que chegam atrasadas.',
  },
  {
    chave: 'tempoPadraoMin',
    rotulo: 'Tempo padrão de atendimento',
    unidade: 'min',
    min: 1,
    max: 120,
    ajuda: 'Usado no tempo estimado enquanto não há atendimentos concluídos no dia.',
  },
  {
    chave: 'ocupacaoMaxMin',
    rotulo: 'Duração máxima considerada',
    unidade: 'min',
    min: 30,
    max: 480,
    ajuda: 'Atendimentos mais longos ficam fora da média do dia.',
  },
] as const;

/** RF26 — configurações operacionais, com limites e auditoria. */
export function Configuracoes({ inicial }: { inicial: Cfg }) {
  const [valores, setValores] = useState({
    toleranciaMin: String(inicial.toleranciaMin),
    carenciaSeg: String(inicial.carenciaSeg),
    tempoPadraoMin: String(inicial.tempoPadraoMin),
    ocupacaoMaxMin: String(inicial.ocupacaoMaxMin),
  });
  const [raios, setRaios] = useState(
    Object.fromEntries(inicial.locais.map((l) => [String(l.id), String(l.raioMetros)])),
  );
  const [erros, setErros] = useState<Record<string, string>>({});
  const [estado, setEstado] = useState<'ocioso' | 'salvando' | 'salvo'>('ocioso');

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEstado('salvando');
    const r = await salvarConfiguracoes({ ...valores, raios });
    if (!r.ok) {
      setErros(r.erros);
      setEstado('ocioso');
      return;
    }
    setErros({});
    setEstado('salvo');
  }

  return (
    <main>
      <CabecalhoDaTela
        titulo="Configurações"
        subtitulo="Regras operacionais da fila. Toda alteração fica registrada na auditoria."
      />
      <form onSubmit={enviar} noValidate className="mt-xl flex max-w-[860px] flex-col gap-xl">
        <Card>
          <p className="t-overline text-text-muted">Fila e chamada</p>
          <div className="mt-base grid grid-cols-2 gap-base">
            {CAMPOS.map((c) => (
              <div key={c.chave}>
                <Field
                  label={`${c.rotulo} (${c.unidade})`}
                  name={c.chave}
                  type="number"
                  min={c.min}
                  max={c.max}
                  value={valores[c.chave]}
                  onChange={(e) => {
                    setEstado('ocioso');
                    setValores((v) => ({ ...v, [c.chave]: e.target.value }));
                  }}
                  erro={erros[c.chave] ? `Entre ${c.min} e ${c.max} ${c.unidade}` : undefined}
                />
                <p className="t-caption mt-xs text-text-muted">{c.ajuda}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <p className="t-overline text-text-muted">Raio do pátio (geofence)</p>
          <p className="t-body-s mt-xs text-text-secondary">
            Galpões no mesmo endereço compartilham o raio. Entre 50 e 2000 metros.
          </p>
          <div className="mt-base grid grid-cols-3 gap-base">
            {inicial.locais.map((l) => (
              <div key={l.id}>
                <Field
                  label={`${l.nome} (m)`}
                  name={`raio-${l.id}`}
                  type="number"
                  min={50}
                  max={2000}
                  value={raios[String(l.id)]}
                  onChange={(e) => {
                    setEstado('ocioso');
                    setRaios((r) => ({ ...r, [String(l.id)]: e.target.value }));
                  }}
                  erro={erros[`raio-${l.id}`] ? 'Entre 50 e 2000 m' : undefined}
                />
                <p className="t-caption mt-xs text-text-muted">{l.galpoes.join(' · ')}</p>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex items-center gap-base">
          <Button
            type="submit"
            bloco={false}
            className="w-[228px]"
            disabled={estado === 'salvando'}
          >
            {estado === 'salvando' ? 'Salvando…' : 'Salvar configurações'}
          </Button>
          {estado === 'salvo' ? (
            <p role="status" className="t-body-s text-success">
              Configurações salvas.
            </p>
          ) : null}
        </div>
      </form>
    </main>
  );
}
