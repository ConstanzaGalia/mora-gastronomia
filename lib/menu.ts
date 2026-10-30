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
  parts.push('El plazo vence el día anterior, a la hora de tu empresa. El lunes cierra el sábado.')
  if (options?.hasExtension) parts.push('Si hay extensión ese día, también podés elegir de 7:00 a 9:00.')
  return parts.join(' ')
}

export type MenuAvailabilityRow = {
  category_id: string
  option_id: string
  sort_order: number
  gastronomic_categories: { name: string; sort_order: number } | { name: string; sort_order: number }[] | null
  gastronomic_options: { name: string; active: boolean } | { name: string; active: boolean }[] | null
}

export type MenuGroup = {
  id: string
  name: string
  sort: number
  optional: boolean
  options: { id: string; name: string; sort: number }[]
}

function asOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

export function buildMenuGroups(rows: MenuAvailabilityRow[], enabledIds: Set<string>): MenuGroup[] {
  const groups = new Map<string, MenuGroup>()
  for (const row of rows) {
    const category = asOne(row.gastronomic_categories)
    const option = asOne(row.gastronomic_options)
    if (!enabledIds.has(row.category_id) || !option?.active || !category) continue
    const current = groups.get(row.category_id) ?? {
      id: row.category_id,
      name: category.name,
      sort: category.sort_order,
      optional: isOptionalCategory(category.name),
      options: [],
    }
    current.options.push({ id: row.option_id, name: option.name, sort: row.sort_order })
    groups.set(row.category_id, current)
  }
  return [...groups.values()]
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'es'))
    .map((group) => ({ ...group, options: group.options.sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'es')) }))
}

export function missingChoiceError(requiredNames: string[], optionalNames: string[] = []) {
  const required = uniqueNames(requiredNames)
  const optional = uniqueNames(optionalNames)
  const parts = [required.length ? `Elegí ${joinEs(required)}.` : 'Elegí las opciones de tu menú.']
  if (optional.length === 1) parts.push(`${sentenceStart(optional[0])} podés saltearlo.`)
  if (optional.length > 1) parts.push(`${sentenceStart(joinEs(optional))} podés saltearlos.`)
  return parts.join(' ')
}
