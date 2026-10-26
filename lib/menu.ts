export function isOptionalCategory(name: string) {
  const normalized = name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  return normalized === 'postre' || normalized === 'pan'
}

function uniqueNames(names: string[]) {
  const seen = new Set<string>()
  const result: string[] = []
  for (const name of names) {
    const trimmed = name.trim()
    const key = trimmed.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    if (!trimmed || seen.has(key)) continue
    seen.add(key)
    result.push(trimmed)
  }
  return result
}

function joinEs(items: string[]) {
  const words = items.map((item) => item.toLowerCase())
  if (words.length === 0) return ''
  if (words.length === 1) return words[0]
  if (words.length === 2) return `${words[0]} y ${words[1]}`
  return `${words.slice(0, -1).join(', ')} y ${words[words.length - 1]}`
}

function sentenceStart(text: string) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text
}

export function menuLegend(
  categories: { name: string; sortOrder?: number }[],
  options?: { hasExtension?: boolean },
) {
  const sorted = [...categories].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, 'es'))
  const required = uniqueNames(sorted.filter((category) => !isOptionalCategory(category.name)).map((category) => category.name))
  const optional = uniqueNames(sorted.filter((category) => isOptionalCategory(category.name)).map((category) => category.name))
  const parts: string[] = []
  if (required.length) parts.push(`Elegí ${joinEs(required)}.`)
  if (optional.length === 1) parts.push(`${sentenceStart(optional[0])} es opcional.`)
  if (optional.length > 1) parts.push(`${sentenceStart(joinEs(optional))} son opcionales.`)
  parts.push('El cierre es a las 12:00 del día anterior.')
  if (options?.hasExtension) parts.push('Si hay extensión ese día, también podés elegir de 7:00 a 9:00.')
  return parts.join(' ')
}

export function missingChoiceError(requiredNames: string[], optionalNames: string[] = []) {
  const required = uniqueNames(requiredNames)
  const optional = uniqueNames(optionalNames)
  const parts = [required.length ? `Elegí ${joinEs(required)}.` : 'Elegí las opciones de tu menú.']
  if (optional.length === 1) parts.push(`${sentenceStart(optional[0])} podés saltearlo.`)
  if (optional.length > 1) parts.push(`${sentenceStart(joinEs(optional))} podés saltearlos.`)
  return parts.join(' ')
}
