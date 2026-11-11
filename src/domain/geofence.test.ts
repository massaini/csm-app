import { describe, expect, it } from 'vitest';
import { avaliarGeofence, distanciaMetros, type Coordenada } from './geofence';

const RAMALHO_89: Coordenada = { lat: -23.650304755462123, lng: -46.51091622883612 };
const RAMALHO_95: Coordenada = { lat: -23.6501175, lng: -46.5108664 };
const ESTADOS_6761: Coordenada = { lat: -23.6516062, lng: -46.51458 };

describe('distância (haversine)', () => {
  it('é zero para o mesmo ponto', () => {
    expect(distanciaMetros(RAMALHO_89, RAMALHO_89)).toBeCloseTo(0, 5);
  });

  it('confere as distâncias reais entre os três locais do seed', () => {
    expect(distanciaMetros(RAMALHO_89, RAMALHO_95)).toBeGreaterThan(15);
    expect(distanciaMetros(RAMALHO_89, RAMALHO_95)).toBeLessThan(30);
    expect(distanciaMetros(RAMALHO_89, ESTADOS_6761)).toBeGreaterThan(350);
    expect(distanciaMetros(RAMALHO_89, ESTADOS_6761)).toBeLessThan(450);
  });
});

const base = { local: RAMALHO_89, raioM: 150, liberadoPeloAdmin: false };

describe('geofence', () => {
  it('RF09-CA1: dentro do raio e com precisão boa habilita a geração', () => {
    const r = avaliarGeofence({ ...base, leitura: { posicao: RAMALHO_95, precisaoM: 20 } });
    expect(r).toMatchObject({ estado: 'DENTRO', podeGerar: true });
  });

  it('RF09-CA2: fora do raio bloqueia a geração', () => {
    const r = avaliarGeofence({ ...base, leitura: { posicao: ESTADOS_6761, precisaoM: 10 } });
    expect(r).toMatchObject({ estado: 'FORA', podeGerar: false });
    expect(r.distanciaM).toBeGreaterThan(150);
  });

  it('RF09-CA3: precisão pior que o raio é "imprecisa", mesmo que a posição caia dentro', () => {
    const r = avaliarGeofence({ ...base, leitura: { posicao: RAMALHO_95, precisaoM: 300 } });
    expect(r).toMatchObject({ estado: 'IMPRECISA', podeGerar: false });
  });

  it('RF09-CA1: o limite do raio é inclusivo', () => {
    const justo = avaliarGeofence({
      ...base,
      raioM: distanciaMetros(RAMALHO_89, RAMALHO_95),
      leitura: { posicao: RAMALHO_95, precisaoM: 5 },
    });
    expect(justo.estado).toBe('DENTRO');
  });

  it('RF09-CA4: sem leitura (negada, timeout ou erro) fica indisponível', () => {
    const r = avaliarGeofence({ ...base, leitura: null });
    expect(r).toMatchObject({ estado: 'INDISPONIVEL', distanciaM: null, podeGerar: false });
  });

  it('RF09-CA5: liberação do admin habilita a geração com GPS fora, ruim ou ausente', () => {
    const liberado = { ...base, liberadoPeloAdmin: true };
    expect(avaliarGeofence({ ...liberado, leitura: null })).toMatchObject({
      estado: 'LIBERADO',
      podeGerar: true,
    });
    expect(
      avaliarGeofence({ ...liberado, leitura: { posicao: ESTADOS_6761, precisaoM: 500 } })
        .podeGerar,
    ).toBe(true);
  });

  it('RF09-CA6: trocar de galpão recalcula com a mesma leitura, sem novo GPS', () => {
    const leitura = { posicao: RAMALHO_95, precisaoM: 15 };
    expect(avaliarGeofence({ ...base, local: RAMALHO_89, leitura }).estado).toBe('DENTRO');
    expect(avaliarGeofence({ ...base, local: ESTADOS_6761, leitura }).estado).toBe('FORA');
  });
});
