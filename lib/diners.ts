import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

export type DinerCategory = { id: string; name: string }

export type Diner = {
  id: string
  apellido: string
  nombre: string
  dni: string
  sectorId: string | null
  selectionId: string | null
  membershipActive: boolean
  choices: Record<string, string>
}

export type DinerGroup = {
  id: string
  name: string
  diners: Diner[]
}

export type DinerPeopleFilter = 'pidieron' | 'todas'

export type DinerReport = {
  categories: DinerCategory[]
  diners: Diner[]
  groups: DinerGroup[] | null
}

type Client = SupabaseClient<Database>

export function dinerLabel(diner: { apellido: string; nombre: string }) {
  return `${diner.apellido}, ${diner.nombre}`.replace(/^,\s*|\s*,\s*$/g, '').trim() || 'Sin nombre'
}

export function compareDiners(a: { apellido: string; nombre: string }, b: { apellido: string; nombre: string }) {
  const last = a.apellido.localeCompare(b.apellido, 'es')
  if (last !== 0) return last
  return a.nombre.localeCompare(b.nombre, 'es')
}

export function dinerPeopleFilter(value: string | undefined): DinerPeopleFilter {
  return value === 'todas' ? 'todas' : 'pidieron'
}

export async function loadDiners(
  supabase: Client,
  companyId: string,
  date: string,
  personas: DinerPeopleFilter = 'pidieron',
): Promise<DinerReport> {
  const [{ data: members }, { data: details }, { data: links }, { data: sectorRows }] = await Promise.all([
    supabase
      .from('memberships')
      .select('user_id, role, sector_id, profiles!memberships_user_id_fkey(nombre, apellido, dni)')
      .eq('company_id', companyId)
      .in('role', ['EMPLOYEE', 'COMPANY_ADMIN'])
      .eq('status', 'ACTIVE')
      .lte('started_at', date)
      .or(`ended_at.is.null,ended_at.gte.${date}`),
    supabase
      .from('v_selection_details')
      .select('selection_id, employee_id, category_id, option_name')
      .eq('service_date', date)
      .eq('company_id', companyId)
      .eq('status', 'SUBMITTED'),
    supabase
      .from('company_gastronomic_categories')
      .select('category_id')
      .eq('company_id', companyId)
      .eq('active', true),
    supabase
      .from('company_sectors')
      .select('id, name, sort_order')
      .eq('company_id', companyId)
      .order('sort_order'),
  ])

  const categoryIds = [...new Set((links ?? []).map((link) => link.category_id))]
  const { data: categoryRows } = categoryIds.length === 0
    ? { data: [] }
    : await supabase.from('gastronomic_categories').select('id, name, sort_order').in('id', categoryIds)
  const categories = (categoryRows ?? [])
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'es'))
    .map((category) => ({ id: category.id, name: category.name }))
  const offered = new Set(categories.map((category) => category.id))

  const choicesByEmployee = new Map<string, Record<string, string>>()
  const selectionByEmployee = new Map<string, string>()
  for (const row of details ?? []) {
    if (!row.employee_id) continue
    if (row.selection_id) selectionByEmployee.set(row.employee_id, row.selection_id)
    if (!row.category_id || !row.option_name || !offered.has(row.category_id)) continue
    const choices = choicesByEmployee.get(row.employee_id) ?? {}
    choices[row.category_id] = choices[row.category_id] ? `${choices[row.category_id]}, ${row.option_name}` : row.option_name
    choicesByEmployee.set(row.employee_id, choices)
  }

  const people = new Map<string, Diner>()
  const ordered = [...(members ?? [])].sort((a, b) => Number(a.role !== 'EMPLOYEE') - Number(b.role !== 'EMPLOYEE'))
  for (const member of ordered) {
    if (people.has(member.user_id)) continue
    const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles
    people.set(member.user_id, {
      id: member.user_id,
      apellido: profile?.apellido ?? '',
      nombre: profile?.nombre ?? '',
      dni: profile?.dni ?? '',
      sectorId: member.sector_id,
      selectionId: selectionByEmployee.get(member.user_id) ?? null,
      membershipActive: true,
      choices: choicesByEmployee.get(member.user_id) ?? {},
    })
  }

  // Pedidos de quienes ya no tienen membership activa (p. ej. baja el día anterior).
  const orphanIds = [...selectionByEmployee.keys()].filter((id) => !people.has(id))
  if (orphanIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, nombre, apellido, dni')
      .in('id', orphanIds)
    for (const profile of profiles ?? []) {
      people.set(profile.id, {
        id: profile.id,
        apellido: profile.apellido ?? '',
        nombre: profile.nombre ?? '',
        dni: profile.dni ?? '',
        sectorId: null,
        selectionId: selectionByEmployee.get(profile.id) ?? null,
        membershipActive: false,
        choices: choicesByEmployee.get(profile.id) ?? {},
      })
    }
  }

  const listed = personas === 'pidieron'
    ? [...people.values()].filter((diner) => Object.keys(diner.choices).length > 0 || diner.selectionId)
    : [...people.values()]
  const diners = listed.sort(compareDiners)
  const sectors = sectorRows ?? []
  return { categories, diners, groups: groupDiners(diners, sectors) }
}

function groupDiners(diners: Diner[], sectors: { id: string; name: string }[]): DinerGroup[] | null {
  if (sectors.length === 0) return null
  const known = new Set(sectors.map((sector) => sector.id))
  const groups = sectors.map((sector) => ({
    id: sector.id,
    name: sector.name,
    diners: diners.filter((diner) => diner.sectorId === sector.id),
  }))
  const unassigned = diners.filter((diner) => !diner.sectorId || !known.has(diner.sectorId))
  if (unassigned.length) groups.push({ id: 'sin-sector', name: 'Sin sector', diners: unassigned })
  return groups.filter((group) => group.diners.length > 0)
}
