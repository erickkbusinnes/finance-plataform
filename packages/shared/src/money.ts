export function money(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100);
}
// Decimal strings are converted exactly to integer cents. No float multiplication.
export function parseMoney(input: string): number {
  const value = input.trim().replace(/\s|R\$/g, '');
  if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(value))
    throw new Error('Informe um valor como 1.234,56');
  const normalized = value.replace(/\./g, '').replace(',', '.');
  const negative = normalized.startsWith('-');
  const [whole, frac = ''] = normalized.replace('-', '').split('.');
  const amount = BigInt(whole) * 100n + BigInt(frac.padEnd(2, '0'));
  if (amount > 1_000_000_000_000n) throw new Error('Valor acima do limite permitido');
  return Number(amount) * (negative ? -1 : 1);
}
