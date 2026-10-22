export function number(value: number): string {
  return new Intl.NumberFormat('es-ES').format(value)
}

export function signed(value: number): string {
  return value > 0 ? '+' + number(value) : number(value)
}

export function change(before: number, after: number): string {
  return signed(after - before)
}
