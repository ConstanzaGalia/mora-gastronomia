import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

export async function loadExtras(supabase: SupabaseClient<Database>, spaceId: string, date: string, companyId?: string | null) {
  const { data: day } = await supabase.from('calendar_days').select('id').eq('business_space_id', spaceId).eq('service_date', date).maybeSingle()
  if (!day) return []
  let query = supabase.from('company_day_extras').select('quantity, company_id, category_id, option_id').eq('calendar_day_id', day.id)
  if (companyId) query = query.eq('company_id', companyId)
  const { data: rows } = await query
  if (!rows?.length) return []
  const [{ data: categories }, { data: options }, { data: companies }] = await Promise.all([
    supabase.from('gastronomic_categories').select('id, name, sort_order').in('id', [...new Set(rows.map((row) => row.category_id))]),
    supabase.from('gastronomic_options').select('id, name').in('id', [...new Set(rows.map((row) => row.option_id))]),
    supabase.from('companies').select('id, nombre_comercial').in('id', [...new Set(rows.map((row) => row.company_id))]),
  ])
  const category = new Map((categories ?? []).map((row) => [row.id, row]))
  const option = new Map((options ?? []).map((row) => [row.id, row.name]))
  const company = new Map((companies ?? []).map((row) => [row.id, row.nombre_comercial]))
  return rows.flatMap((row) => {
    const found = category.get(row.category_id)
    const name = option.get(row.option_id)
    if (!found || !name) return []
    return [{
      category_name: found.name,
      option_name: name,
      quantity: row.quantity,
      category_sort_order: found.sort_order,
      company_name: company.get(row.company_id) ?? '',
    }]
  })
}

export type KitchenRow = {
  category_name: string | null
  option_name: string | null
  total: number | null
  category_sort_order?: number | null
  company_name?: string | null
}

export type ExtraPiece = {
  category_name: string
  option_name: string
  quantity: number
  category_sort_order: number
  company_name?: string | null
}

export type MergedKitchenRow = KitchenRow & { extras: number; market: number }

export type MarketPiece = {
  category_name: string
  option_name: string
  quantity: number
  category_sort_order: number
}

export function mergeKitchen(rows: KitchenRow[], extras: ExtraPiece[], withCompany = false): MergedKitchenRow[] {
  const map = new Map<string, MergedKitchenRow>()
  for (const row of rows) {
    const key = withCompany ? `${row.company_name}|${row.category_name}|${row.option_name}` : `${row.category_name}|${row.option_name}`
    map.set(key, { ...row, total: Number(row.total ?? 0), extras: 0, market: 0 })
  }
  for (const extra of extras) {
    const key = withCompany ? `${extra.company_name}|${extra.category_name}|${extra.option_name}` : `${extra.category_name}|${extra.option_name}`
    const current = map.get(key) ?? {
      category_name: extra.category_name,
      option_name: extra.option_name,
      company_name: extra.company_name,
      total: 0,
      category_sort_order: extra.category_sort_order,
      extras: 0,
      market: 0,
    }
    current.total = Number(current.total ?? 0) + extra.quantity
    current.extras += extra.quantity
    map.set(key, current)
  }
  return sortKitchen(map)
}

export function mergeMarket(rows: MergedKitchenRow[], portions: MarketPiece[]): MergedKitchenRow[] {
  const map = new Map<string, MergedKitchenRow>()
  for (const row of rows) map.set(`${row.category_name}|${row.option_name}`, { ...row, market: row.market ?? 0 })
  for (const portion of portions) {
    const key = `${portion.category_name}|${portion.option_name}`
    const current = map.get(key) ?? {
      category_name: portion.category_name,
      option_name: portion.option_name,
      total: 0,
      category_sort_order: portion.category_sort_order,
      extras: 0,
      market: 0,
    }
    current.total = Number(current.total ?? 0) + portion.quantity
    current.market += portion.quantity
    map.set(key, current)
  }
  return sortKitchen(map)
}

function sortKitchen(map: Map<string, MergedKitchenRow>) {
  return [...map.values()].sort((a, b) => (a.category_sort_order ?? 0) - (b.category_sort_order ?? 0) || String(a.option_name).localeCompare(String(b.option_name), 'es'))
}

export function extraNote(extras: number) {
  if (!extras) return ''
  return ` (incluye ${extras} ${extras === 1 ? 'extra' : 'extras'})`
}

export function portionNote(extras: number, market = 0) {
  const parts: string[] = []
  if (extras) parts.push(`${extras} ${extras === 1 ? 'extra' : 'extras'}`)
  if (market) parts.push(`${market} del mercadito`)
  return parts.length ? ` (incluye ${parts.join(' y ')})` : ''
}
