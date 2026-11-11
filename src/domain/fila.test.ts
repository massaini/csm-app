import { describe, expect, it } from 'vitest';
import {
  mediaDoDiaMin,
  posicaoNaFila,
  temposDaSenha,
  tempoAteIniciarMin,
  tempoEstimadoMin,
  textoFilaEstimada,
  textoProximidade,
  textoTempoEstimado,
  type AtendimentoConcluido,
} from './fila';

const t = (hhmm: string) => new Date(`2026-11-11T${hhmm}:00Z`);
const atend = (
  chamada: string,
  conclusao: string,
  por: AtendimentoConcluido['concluidaPor'] = 'MOTORISTA',
): AtendimentoConcluido => ({
  chamadaEm: t(chamada),
  concluidaEm: t(conclusao),
  concluidaPor: por,
});

describe('média do dia', () => {
  it('Fórmula: 10 min e 20 min dão média de 15 min (exemplo do cliente)', () => {
    expect(mediaDoDiaMin([atend('08:00', '08:10'), atend('09:00', '09:20')], 15, 120)).toBe(15);
  });

  it('Fórmula: sem amostra usa o tempo padrão', () => {
    expect(mediaDoDiaMin([], 15, 120)).toBe(15);
  });

  it('Fórmula: ignora conclusões do SISTEMA e durações acima do máximo', () => {
    const lista = [
      atend('08:00', '08:10'),
      atend('09:00', '09:30', 'SISTEMA'),
      atend('10:00', '15:00', 'ADMIN'), // 300 min > 120
    ];
    expect(mediaDoDiaMin(lista, 15, 120)).toBe(10);
  });

  it('Fórmula: se tudo for excluído, volta ao tempo padrão', () => {
    expect(mediaDoDiaMin([atend('08:00', '15:00', 'ADMIN')], 15, 120)).toBe(15);
  });

  it('Fórmula: não arredonda a média antes de estimar', () => {
    expect(mediaDoDiaMin([atend('08:00', '08:10'), atend('09:00', '09:15')], 15, 120)).toBe(12.5);
  });
});

describe('posição e tempo estimado', () => {
  const fila = [
    { id: 'c', geradaEm: t('08:30') },
    { id: 'a', geradaEm: t('08:00') },
    { id: 'b', geradaEm: t('08:10') },
  ];

  it('Fórmula: a fila é FIFO por geradaEm, independente da ordem recebida', () => {
    expect(posicaoNaFila(fila, 'a')).toBe(1);
    expect(posicaoNaFila(fila, 'b')).toBe(2);
    expect(posicaoNaFila(fila, 'c')).toBe(3);
    expect(posicaoNaFila(fila, 'x')).toBeNull();
  });

  it('Fórmula: tempo estimado = (posição − 1) × média, arredondado para cima', () => {
    expect(tempoEstimadoMin(1, 15)).toBe(0);
    expect(tempoEstimadoMin(3, 15)).toBe(30);
    expect(tempoEstimadoMin(2, 12.5)).toBe(13);
  });

  it('Fórmula: o 1º da fila vê "Você é o próximo"', () => {
    expect(textoTempoEstimado(1, 15)).toBe('Você é o próximo');
    expect(textoTempoEstimado(3, 15)).toBe('~30 min');
  });

  it('RF11-CA1: "Sua vez está próxima" só até a 2ª posição', () => {
    expect(textoProximidade(1)).toBe('Sua vez está próxima');
    expect(textoProximidade(2)).toBe('Sua vez está próxima');
    expect(textoProximidade(3)).toBe('Acompanhe sua posição');
  });

  it('RF08-CA5: "Fila estimada agora" usa N × média e trata fila vazia e singular', () => {
    expect(textoFilaEstimada(4, 5)).toBe('4 motoristas · ~20 min de espera');
    expect(textoFilaEstimada(1, 15)).toBe('1 motorista · ~15 min de espera');
    expect(textoFilaEstimada(0, 15)).toBe('Sem fila · você será o próximo');
  });
});

describe('tempos do resumo', () => {
  const marcos = {
    geradaEm: new Date('2026-11-11T12:00:00Z'),
    chamadaEm: new Date('2026-11-11T12:18:40Z'),
    aCaminhoEm: new Date('2026-11-11T12:20:00Z'),
    concluidaEm: new Date('2026-11-11T12:40:50Z'),
    concluidaPor: 'MOTORISTA' as const,
  };

  it('RF14-CA4: espera, carregamento e total, em minutos inteiros (floor)', () => {
    expect(temposDaSenha(marcos)).toEqual({ esperaMin: 18, carregamentoMin: 22, totalMin: 40 });
  });

  it('RF14-CA4: o total sai dos valores brutos, não da soma dos arredondados', () => {
    // 18:50 + 18:50 = 37:40 → 37, enquanto 18 + 18 = 36
    const m = {
      ...marcos,
      chamadaEm: new Date('2026-11-11T12:18:50Z'),
      concluidaEm: new Date('2026-11-11T12:37:40Z'),
    };
    const r = temposDaSenha(m)!;
    expect(r.esperaMin).toBe(18);
    expect(r.carregamentoMin).toBe(18);
    expect(r.totalMin).toBe(37);
  });

  it('Fórmula: conclusão pelo SISTEMA não tem tempos ("—")', () => {
    expect(temposDaSenha({ ...marcos, concluidaPor: 'SISTEMA' })).toBeNull();
  });

  it('Fórmula: tempo até iniciar = aCaminhoEm − geradaEm', () => {
    expect(tempoAteIniciarMin(marcos.geradaEm, marcos.aCaminhoEm!)).toBe(20);
  });
});
