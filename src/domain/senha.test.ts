import { describe, expect, it } from 'vitest';
import {
  dentroDoLimiteDeChegada,
  estaAtiva,
  ocupaBancada,
  podeTransitar,
  statusEfetivo,
} from './senha';

const T0 = new Date('2026-11-11T12:00:00Z');
const prazo = new Date(T0.getTime() + 5 * 60_000);
const CARENCIA = 30;

describe('transições da senha', () => {
  it('permite o caminho feliz AGUARDANDO → CHAMADA → EM_ATENDIMENTO → CONCLUIDA', () => {
    expect(podeTransitar('AGUARDANDO', 'CHAMADA')).toBe(true);
    expect(podeTransitar('CHAMADA', 'EM_ATENDIMENTO')).toBe(true);
    expect(podeTransitar('EM_ATENDIMENTO', 'CONCLUIDA')).toBe(true);
  });

  it('rejeita saltos e voltas', () => {
    expect(podeTransitar('AGUARDANDO', 'EM_ATENDIMENTO')).toBe(false);
    expect(podeTransitar('AGUARDANDO', 'CONCLUIDA')).toBe(false);
    expect(podeTransitar('CHAMADA', 'AGUARDANDO')).toBe(false);
    expect(podeTransitar('EM_ATENDIMENTO', 'CHAMADA')).toBe(false);
  });

  it('estados finais não mudam', () => {
    for (const para of [
      'AGUARDANDO',
      'CHAMADA',
      'EM_ATENDIMENTO',
      'CONCLUIDA',
      'CANCELADA',
    ] as const) {
      expect(podeTransitar('CONCLUIDA', para, 'MOTORISTA')).toBe(false);
      expect(podeTransitar('CANCELADA', para, 'MOTORISTA')).toBe(false);
    }
  });

  it('RF12-CA3: o motorista só cancela a própria senha em AGUARDANDO', () => {
    expect(podeTransitar('AGUARDANDO', 'CANCELADA', 'MOTORISTA')).toBe(true);
    expect(podeTransitar('CHAMADA', 'CANCELADA', 'MOTORISTA')).toBe(false);
    expect(podeTransitar('EM_ATENDIMENTO', 'CANCELADA', 'MOTORISTA')).toBe(false);
  });

  it('cancelamento exige um motivo compatível com o status de origem', () => {
    expect(podeTransitar('AGUARDANDO', 'CANCELADA')).toBe(false);
    expect(podeTransitar('CHAMADA', 'CANCELADA', 'EXPIRADA')).toBe(true);
    expect(podeTransitar('AGUARDANDO', 'CANCELADA', 'EXPIRADA')).toBe(false);
    expect(podeTransitar('AGUARDANDO', 'CANCELADA', 'FIM_DO_DIA')).toBe(true);
    expect(podeTransitar('EM_ATENDIMENTO', 'CANCELADA', 'FIM_DO_DIA')).toBe(false);
  });

  it('RF06-CA3: desativar o motorista cancela a senha em qualquer status ativo', () => {
    for (const de of ['AGUARDANDO', 'CHAMADA', 'EM_ATENDIMENTO'] as const) {
      expect(podeTransitar(de, 'CANCELADA', 'MOTORISTA_DESATIVADO')).toBe(true);
    }
  });

  it('RF18-CA6: CHAMADA e EM_ATENDIMENTO ocupam a bancada; AGUARDANDO não', () => {
    expect(ocupaBancada('CHAMADA')).toBe(true);
    expect(ocupaBancada('EM_ATENDIMENTO')).toBe(true);
    expect(ocupaBancada('AGUARDANDO')).toBe(false);
    expect(ocupaBancada('CONCLUIDA')).toBe(false);
    expect(estaAtiva('AGUARDANDO')).toBe(true);
    expect(estaAtiva('CANCELADA')).toBe(false);
  });
});

describe('prazo, carência e status efetivo', () => {
  it('RF13-CA2: o limite de "Estou a caminho" é prazo + carência, inclusivo', () => {
    const limite = new Date(prazo.getTime() + CARENCIA * 1000);
    expect(dentroDoLimiteDeChegada(prazo, prazo, CARENCIA)).toBe(true);
    expect(dentroDoLimiteDeChegada(limite, prazo, CARENCIA)).toBe(true);
    expect(dentroDoLimiteDeChegada(new Date(limite.getTime() + 1), prazo, CARENCIA)).toBe(false);
  });

  it('RF13-CA4: depois do prazo mas dentro da carência ainda é CHAMADA', () => {
    const agora = new Date(prazo.getTime() + 10_000);
    expect(statusEfetivo({ status: 'CHAMADA', prazoEm: prazo }, agora, CARENCIA).status).toBe(
      'CHAMADA',
    );
  });

  it('RF13-CA5: passada a carência, a leitura trata a CHAMADA como CANCELADA (EXPIRADA)', () => {
    const agora = new Date(prazo.getTime() + 31_000);
    expect(statusEfetivo({ status: 'CHAMADA', prazoEm: prazo }, agora, CARENCIA)).toEqual({
      status: 'CANCELADA',
      motivo: 'EXPIRADA',
    });
  });

  it('RF13-CA6: o prazo gravado vale mesmo que a configuração mude depois', () => {
    // o prazo é um dado da senha; a função nunca consulta a tolerância atual
    const agora = new Date(prazo.getTime() - 1);
    expect(statusEfetivo({ status: 'CHAMADA', prazoEm: prazo }, agora, CARENCIA).status).toBe(
      'CHAMADA',
    );
  });

  it('os demais status não mudam por causa do relógio', () => {
    const muitoDepois = new Date(prazo.getTime() + 86_400_000);
    for (const status of ['AGUARDANDO', 'EM_ATENDIMENTO', 'CONCLUIDA'] as const) {
      expect(statusEfetivo({ status, prazoEm: prazo }, muitoDepois, CARENCIA).status).toBe(status);
    }
  });
});
