export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

export function cpfValido(cpf: string): boolean {
  const d = somenteDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const digito = (base: string, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(d.slice(0, 9), 10) === Number(d[9]) && digito(d.slice(0, 10), 11) === Number(d[10]);
}

/** Máscara progressiva: formata só o que já foi digitado (até 11 dígitos). */
export function formatarCpf(cpf: string): string {
  const d = somenteDigitos(cpf).slice(0, 11);
  const grupos = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean);
  let saida = grupos.join('.');
  if (d.length > 9) saida += `-${d.slice(9)}`;
  return saida;
}

export function mascararCpf(cpf: string): string {
  const d = somenteDigitos(cpf);
  return d.length === 11 ? `***.***.***-${d.slice(9)}` : '***';
}

const PLACA_ANTIGA = /^[A-Z]{3}\d{4}$/;
const PLACA_MERCOSUL = /^[A-Z]{3}\d[A-Z]\d{2}$/;

export function normalizarPlaca(placa: string): string {
  return placa.replace(/[\s-]/g, '').toUpperCase();
}

export function placaValida(placa: string): boolean {
  const p = normalizarPlaca(placa);
  return PLACA_ANTIGA.test(p) || PLACA_MERCOSUL.test(p);
}

export function formatarPlaca(placa: string): string {
  const p = normalizarPlaca(placa);
  return p.length > 3 ? `${p.slice(0, 3)}-${p.slice(3)}` : p;
}
