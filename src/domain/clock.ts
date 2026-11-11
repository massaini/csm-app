export interface Clock {
  agora(): Date;
}

export const relogioSistema: Clock = { agora: () => new Date() };

export function relogioFixo(instante: Date | string): Clock & { avancar(ms: number): void } {
  let atual = new Date(instante);
  return {
    agora: () => new Date(atual),
    avancar(ms: number) {
      atual = new Date(atual.getTime() + ms);
    },
  };
}
