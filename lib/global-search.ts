import { digits, foldSearch, formatDay, matchesSearch, ROLE_LABEL } from '@/lib/format'
import { isEventosSlug } from '@/lib/space'
import { createClient } from '@/lib/supabase/server'
import type { SessionContext } from '@/lib/session'

export const SEARCH_MIN_CHARS = 2
export const SEARCH_PER_GROUP = 6

export type SearchHit = {
  id: string
  title: string
  subtitle?: string
  href: string
}

export type SearchGroup = {
  key: string
  label: string
  items: SearchHit[]
}

function asOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function sanitizeTerm(raw: string) {
  return raw
    .trim()
    .slice(0, 80)
    .replace(/[%_,'"\\()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function ilikePattern(term: string) {
  return `%${term}%`
}

function orIlike(columns: string[], term: string) {
  return columns.map((column) => `${column}.ilike.${ilikePattern(term)}`).join(',')
}

function matchesText(term: string, ...parts: Array<string | null | undefined>) {
  return matchesSearch(parts.filter(Boolean).join(' '), term)
}

function searchPatterns(term: string) {
  return [...new Set([term, foldSearch(term)].filter((value) => value.length > 0))]
}

export async function searchWorkspace(session: SessionContext, rawQuery: string): Promise<SearchGroup[]> {
  const term = sanitizeTerm(rawQuery)
  if (term.length < SEARCH_MIN_CHARS) return []

  const supabase = await createClient()
  const spaceId = session.spaceId

  if (isEventosSlug(session.spaceSlug)) {
    return (await searchEvents(supabase, spaceId, term)).filter((group) => group.items.length > 0)
  }

  const [companies, people, documents, weeks, catalog] = await Promise.all([
    searchCompanies(supabase, spaceId, term),
    searchPeople(supabase, spaceId, term),
    searchDocuments(supabase, spaceId, term),
    searchWeeks(supabase, spaceId, term),
    searchCatalog(supabase, spaceId, term),
  ])

  return [companies, people, documents, weeks, catalog].filter((group) => group.items.length > 0)
}

type Client = Awaited<ReturnType<typeof createClient>>

async function searchCompanies(supabase: Client, spaceId: string, term: string): Promise<SearchGroup> {
  const numeric = digits(term)
  const filters = searchPatterns(term).flatMap((pattern) => orIlike(['nombre_comercial', 'razon_social'], pattern).split(','))
  if (numeric.length >= 4) filters.push(`cuit.ilike.${ilikePattern(numeric)}`)

  const { data } = await supabase
    .from('companies')
    .select('id, nombre_comercial, razon_social, cuit, active')
    .eq('business_space_id', spaceId)
    .or(filters.join(','))
    .order('nombre_comercial')
    .limit(SEARCH_PER_GROUP)

  return {
    key: 'companies',
    label: 'Empresas',
    items: (data ?? []).filter((company) => matchesSearch([company.nombre_comercial, company.razon_social, company.cuit].join(' '), term)).map((company) => ({
      id: company.id,
      title: company.nombre_comercial,
      subtitle: [company.razon_social, company.cuit, company.active ? null : 'Inactiva'].filter(Boolean).join(' · ') || undefined,
      href: `/empresas/${company.id}`,
    })),
  }
}

async function searchPeople(supabase: Client, spaceId: string, term: string): Promise<SearchGroup> {
  const numeric = digits(term)
  const profileFilters = searchPatterns(term).flatMap((pattern) => orIlike(['nombre', 'apellido', 'email', 'dni'], pattern).split(','))
  if (numeric.length >= 4) profileFilters.push(`dni.ilike.${ilikePattern(numeric)}`)

  const parts = term.split(' ').filter((part) => part.length > 0)
  if (parts.length >= 2) {
    const first = parts[0]
    const last = parts.slice(1).join(' ')
    profileFilters.push(`and(nombre.ilike.${ilikePattern(first)},apellido.ilike.${ilikePattern(last)})`)
    profileFilters.push(`and(nombre.ilike.${ilikePattern(last)},apellido.ilike.${ilikePattern(first)})`)
  }

  const { data } = await supabase
    .from('memberships')
    .select('id, role, status, company_id, profiles!memberships_user_id_fkey!inner(id, nombre, apellido, dni, email), companies(id, nombre_comercial)')
    .eq('business_space_id', spaceId)
    .or(profileFilters.join(','), { referencedTable: 'profiles' })
    .order('status')
    .limit(20)

  const seen = new Set<string>()
  const items: SearchHit[] = []
  for (const row of data ?? []) {
    const profile = asOne(row.profiles)
    const company = asOne(row.companies)
    if (!profile || !row.company_id) continue
    const key = `${profile.id}:${row.company_id}`
    if (seen.has(key)) continue
    seen.add(key)
    const fullName = `${profile.apellido}, ${profile.nombre}`
    if (!matchesSearch([fullName, profile.dni, profile.email, company?.nombre_comercial].join(' '), term) && !(numeric.length >= 4 && digits(profile.dni ?? '').includes(numeric))) continue
    items.push({
      id: row.id,
      title: fullName,
      subtitle: [company?.nombre_comercial, profile.dni, profile.email, ROLE_LABEL[row.role], row.status === 'ACTIVE' ? null : 'Cerrada']
        .filter(Boolean)
        .join(' · '),
      href: `/empresas/${row.company_id}`,
    })
    if (items.length >= SEARCH_PER_GROUP) break
  }

  return { key: 'people', label: 'Personas', items }
}

async function searchDocuments(supabase: Client, spaceId: string, term: string): Promise<SearchGroup> {
  const { data } = await supabase
    .from('space_documents')
    .select('id, title, original_name')
    .eq('business_space_id', spaceId)
    .or(searchPatterns(term).map((pattern) => orIlike(['title', 'original_name'], pattern)).join(','))
    .order('created_at', { ascending: false })
    .limit(SEARCH_PER_GROUP)

  return {
    key: 'documents',
    label: 'Documentos',
    items: (data ?? []).filter((document) => matchesSearch(`${document.title} ${document.original_name}`, term)).map((document) => ({
      id: document.id,
      title: document.title,
      subtitle: document.original_name === document.title ? undefined : document.original_name,
      href: `/documentos?q=${encodeURIComponent(document.title)}`,
    })),
  }
}

async function searchWeeks(supabase: Client, spaceId: string, term: string): Promise<SearchGroup> {
  const { data } = await supabase
    .from('calendar_weeks')
    .select('id, week_start, week_end, status')
    .eq('business_space_id', spaceId)
    .order('week_start', { ascending: false })
    .limit(24)

  const items = (data ?? [])
    .filter((week) => {
      const statusLabel = week.status === 'PUBLISHED' ? 'publicada' : 'borrador'
      return matchesText(term, formatDay(week.week_start), formatDay(week.week_end), week.week_start, week.week_end, statusLabel, week.status)
    })
    .slice(0, SEARCH_PER_GROUP)
    .map((week) => ({
      id: week.id,
      title: `${formatDay(week.week_start)} al ${formatDay(week.week_end)}`,
      subtitle: week.status === 'PUBLISHED' ? 'Publicada' : 'Borrador',
      href: `/calendario/${week.id}`,
    }))

  return { key: 'weeks', label: 'Menús / semanas', items }
}

async function searchCatalog(supabase: Client, spaceId: string, term: string): Promise<SearchGroup> {
  const { data } = await supabase
    .from('gastronomic_options')
    .select('id, name, description, gastronomic_categories!inner(id, name, business_space_id)')
    .eq('gastronomic_categories.business_space_id', spaceId)
    .order('name')
    .limit(400)

  const items = (data ?? []).flatMap((option) => {
    const category = asOne(option.gastronomic_categories)
    if (!matchesSearch([option.name, option.description, category?.name].join(' '), term)) return []
    return [{
      id: option.id,
      title: option.name,
      subtitle: [category?.name, option.description].filter(Boolean).join(' · ') || undefined,
      href: `/catalogo?q=${encodeURIComponent(option.name)}`,
    }]
  }).slice(0, SEARCH_PER_GROUP)

  return {
    key: 'catalog',
    label: 'Catálogo',
    items,
  }
}

async function searchEvents(supabase: Client, spaceId: string, term: string): Promise<SearchGroup[]> {
  const { data } = await supabase
    .from('events')
    .select('id, name, client_name, event_on, venue')
    .eq('business_space_id', spaceId)
    .or(searchPatterns(term).map((pattern) => orIlike(['name', 'client_name', 'venue'], pattern)).join(','))
    .order('event_on', { ascending: false })
    .limit(SEARCH_PER_GROUP)

  return [{
    key: 'events',
    label: 'Eventos',
    items: (data ?? []).filter((event) => matchesSearch([event.name, event.client_name, event.venue].join(' '), term)).map((event) => ({
      id: event.id,
      title: event.name,
      subtitle: [event.client_name, formatDay(event.event_on), event.venue].filter(Boolean).join(' · '),
      href: `/eventos/${event.id}`,
    })),
  }]
}
