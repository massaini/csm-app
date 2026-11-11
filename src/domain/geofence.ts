const RAIO_TERRA_M = 6_371_000;

export interface Coordenada {
  lat: number;
  lng: number;
}

const rad = (g: number) => (g * Math.PI) / 180;

export function distanciaMetros(a: Coordenada, b: Coordenada): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RAIO_TERRA_M * Math.asin(Math.sqrt(h));
}

export type EstadoGeofence = 'DENTRO' | 'FORA' | 'IMPRECISA' | 'INDISPONIVEL' | 'LIBERADO';

export interface EntradaGeofence {
  /** null quando a leitura de GPS falhou, foi negada ou deu timeout */
  leitura: { posicao: Coordenada; precisaoM: number } | null;
  local: Coordenada;
  raioM: number;
  liberadoPeloAdmin: boolean;
}

export interface ResultadoGeofence {
  estado: EstadoGeofence;
  distanciaM: number | null;
  /** botão "Gerar senha" habilitado */
  podeGerar: boolean;
}

export function avaliarGeofence(e: EntradaGeofence): ResultadoGeofence {
  const distanciaM = e.leitura ? distanciaMetros(e.leitura.posicao, e.local) : null;
  if (e.liberadoPeloAdmin) return { estado: 'LIBERADO', distanciaM, podeGerar: true };
  if (!e.leitura || distanciaM === null) {
    return { estado: 'INDISPONIVEL', distanciaM: null, podeGerar: false };
  }
  if (e.leitura.precisaoM > e.raioM) return { estado: 'IMPRECISA', distanciaM, podeGerar: false };
  if (distanciaM <= e.raioM) return { estado: 'DENTRO', distanciaM, podeGerar: true };
  return { estado: 'FORA', distanciaM, podeGerar: false };
}
