'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AlertBanner, Chip } from '@/components/ui/basicos';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { formatarPlaca, placaValida } from '@/domain/documentos';
import { avaliarGeofence, type EstadoGeofence } from '@/domain/geofence';
import { acaoGerarSenha } from '../actions';
import type { EstadoDa, Fila } from '../tela-fila';

type Leitura = { lat: number; lng: number; precisaoM: number } | null;

/** RF09: alta precisão, sem cache, 15 s. null quando negada, indisponível ou timeout. */
function lerLocalizacao(): Promise<Leitura> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({ lat: p.coords.latitude, lng: p.coords.longitude, precisaoM: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    );
  });
}

const CHIP: Record<EstadoGeofence, { tom: 'success' | 'danger'; texto: string }> = {
  DENTRO: { tom: 'success', texto: 'Dentro do pátio - gerar senha disponível' },
  FORA: { tom: 'danger', texto: 'Fora do pátio - gerar senha bloqueado' },
  IMPRECISA: { tom: 'danger', texto: 'Localização imprecisa' },
  INDISPONIVEL: { tom: 'danger', texto: 'Localização indisponível' },
  LIBERADO: { tom: 'success', texto: 'Liberado pelo administrador' },
};

/** Telas `233:440` (disponível) e `12:2` (bloqueado). RF08 e RF09. */
export function TelaGerar({ estado, fila }: { estado: EstadoDa<'GERAR'>; fila: Fila }) {
  const habilitados = estado.galpoes.filter((g) => g.habilitado);
  const inicial =
    habilitados.find((g) => g.id === estado.ultimoGalpaoId)?.id ?? habilitados[0]?.id ?? null;
  const [galpaoId, setGalpaoId] = useState<number | null>(inicial);
  const [placa, setPlaca] = useState(estado.ultimaPlaca ?? '');
  const [leitura, setLeitura] = useState<Leitura | 'lendo'>('lendo');
  const [erro, setErro] = useState<string | null>(null);

  const ler = useCallback(async () => {
    setLeitura('lendo');
    const l = await lerLocalizacao();
    setLeitura(l);
    return l;
  }, []);

  useEffect(() => {
    let ativo = true;
    void lerLocalizacao().then((l) => {
      if (ativo) setLeitura(l);
    });
    return () => {
      ativo = false;
    };
  }, []);

  const galpao = estado.galpoes.find((g) => g.id === galpaoId) ?? null;
  // RF09-CA6: trocar de galpão recalcula com a última leitura, sem novo GPS
  const geo =
    galpao && leitura !== 'lendo'
      ? avaliarGeofence({
          leitura: leitura
            ? { posicao: { lat: leitura.lat, lng: leitura.lng }, precisaoM: leitura.precisaoM }
            : null,
          local: { lat: galpao.local.lat, lng: galpao.local.lng },
          raioM: galpao.local.raioM,
          liberadoPeloAdmin: estado.liberado,
        })
      : null;
  const semRegiao = habilitados.length === 0; // RF08-CA4
  const podeGerar = !!galpao?.habilitado && !!geo?.podeGerar && !fila.enviando;

  async function gerar() {
    setErro(null);
    if (!placaValida(placa)) {
      setErro('Placa inválida. Use o formato ABC-1234 ou ABC-1D23.');
      return;
    }
    if (!galpao) return;
    const novaLeitura = await ler(); // nova leitura no toque (RF09)
    const r = await fila.executar(() =>
      acaoGerarSenha({ galpaoId: galpao.id, placa, leitura: novaLeitura }),
    );
    if (r?.mensagem && r.codigo !== 'OK' && r.codigo !== 'CONFLITO') setErro(r.mensagem);
  }

  const chip = semRegiao
    ? null
    : leitura === 'lendo'
      ? { tom: 'neutral' as const, texto: 'Verificando localização…' }
      : geo
        ? CHIP[geo.estado]
        : null;

  return (
    <main className="flex flex-1 flex-col gap-md px-xl pb-xl pt-xl">
      <header className="flex items-start justify-between">
        <div>
          <p className="t-body-s text-text-secondary">Olá, motorista</p>
          <p className="t-title-s mt-xs">{estado.nome}</p>
        </div>
        <Link
          href="/historico"
          className="t-button-m rounded-full border border-primary/70 px-base py-sm text-primary"
        >
          Histórico
        </Link>
      </header>

      {chip ? (
        <div>
          <Chip tom={chip.tom}>{chip.texto}</Chip>
        </div>
      ) : null}
      {geo?.estado === 'INDISPONIVEL' ? (
        <p className="t-body-s text-text-secondary">
          Ative a localização ou peça liberação ao administrador.
        </p>
      ) : null}
      {geo?.estado === 'IMPRECISA' ? (
        <button className="t-body-s self-start text-primary underline" onClick={() => void ler()}>
          Tentar novamente
        </button>
      ) : null}

      <h1 className="t-title-l">Gere sua senha para o carregamento</h1>

      <Field
        label="Placa do veículo"
        name="placa"
        autoCapitalize="characters"
        autoComplete="off"
        maxLength={8}
        value={placa}
        onChange={(e) => setPlaca(formatarPlaca(e.target.value))}
        placeholder="ABC-1D23"
      />

      <fieldset className="flex flex-col gap-sm">
        <legend className="t-caption mb-xs uppercase text-text-muted">
          Galpão de carregamento
        </legend>
        {semRegiao ? (
          <p role="alert" className="t-body-m text-danger">
            Sua região não está configurada — fale com o administrador.
          </p>
        ) : null}
        {estado.galpoes.map((g) => {
          const selecionado = g.id === galpaoId;
          return (
            <label
              key={g.id}
              className={`flex min-h-[52px] items-center gap-md rounded-md border px-base py-xs ${
                selecionado ? 'border-2 border-primary bg-elevated' : 'border-border bg-surface'
              } ${g.habilitado ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
            >
              <input
                type="radio"
                name="galpao"
                value={g.id}
                checked={selecionado}
                disabled={!g.habilitado}
                onChange={() => setGalpaoId(g.id)}
                className="h-[20px] w-[20px] accent-[var(--color-primary)]"
              />
              <span>
                <span className="t-body-m-strong block">{g.nome}</span>
                <span className="t-body-s block text-text-muted">
                  {g.habilitado ? g.endereco : 'Sua região não é atendida aqui'}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {galpao?.textoFila ? (
        <AlertBanner titulo="Fila estimada agora">{galpao.textoFila}</AlertBanner>
      ) : null}

      {erro ? (
        <p role="alert" className="t-body-s text-danger">
          {erro}
        </p>
      ) : null}

      <Button className="mt-sm" disabled={!podeGerar} onClick={() => void gerar()}>
        {fila.enviando ? 'Enviando…' : 'Gerar senha'}
      </Button>
    </main>
  );
}
