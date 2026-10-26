export function tucumanQuery(address: string) {
  const trimmed = address.trim()
  if (!trimmed) return ''
  if (/tucum[aá]n/i.test(trimmed)) return trimmed
  return `${trimmed}, San Miguel de Tucumán, Tucumán, Argentina`
}
