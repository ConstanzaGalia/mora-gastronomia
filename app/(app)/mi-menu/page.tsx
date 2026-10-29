import { EmptyState } from '@/components/empty-state'
import { MenuWeek, type MenuCompany, type MenuRow, type MenuWeekDay, type MenuWeekGroup } from '@/components/menu-day'
import { PageHeader } from '@/components/page-header'
import { addDays, businessToday, mondayOf } from '@/lib/format'
import { menuLegend } from '@/lib/menu'
import { assertRole, requireSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

export default async function MiMenuPage() {
  const session = await requireSession()
  assertRole(session, ['EMPLOYEE', 'COMPANY_ADMIN'])
  const supabase = await createClient()
  const today = businessToday()
  const start = mondayOf(today)
  const end = addDays(start, 11)

  const { data: days } = await supabase
    .from('calendar_days')
    .select('service_date, is_service_day, calendar_weeks!inner(status)')
    .eq('business_space_id', session.spaceId)
    .eq('calendar_weeks.status', 'PUBLISHED')
    .gte('service_date', start)
    .lte('service_date', end)
    .order('service_date')

  const companyIds = [...new Set(
    session.roles
      .filter((role) => (role.role === 'EMPLOYEE' || role.role === 'COMPANY_ADMIN') && role.company_id)
      .map((role) => role.company_id as string),
  )]

  const serviceDays = (days ?? []).filter((day) => day.is_service_day)
  const menus = await Promise.all(serviceDays.map(async (day) => {
    const { data } = await supabase.rpc('get_my_menu', { p_service_date: day.service_date })
    return { serviceDate: day.service_date, companies: groupByCompany(data ?? []) }
  }))
  const { data: selections } = await supabase
    .from('employee_selections')
    .select('id, service_date, company_id, status')
    .eq('employee_id', session.userId)
    .eq('status', 'SUBMITTED')
    .gte('service_date', start)
    .lte('service_date', end)

  const selectionByDate = new Map((selections ?? []).map((row) => [row.service_date, row]))
  const weeks = groupWeeks(menus.map((menu) => ({
    serviceDate: menu.serviceDate,
    companies: menu.companies,
    selectionId: selectionByDate.get(menu.serviceDate)?.id ?? null,
    selectionCompanyId: selectionByDate.get(menu.serviceDate)?.company_id ?? null,
  })))

  const [{ data: enabled }, { data: extensions }] = await Promise.all([
    companyIds.length
      ? supabase
          .from('company_gastronomic_categories')
          .select('category_id')
          .in('company_id', companyIds)
          .eq('active', true)
      : Promise.resolve({ data: [] }),
    companyIds.length
      ? supabase
          .from('day_company_extensions')
          .select('calendar_day_id')
          .in('company_id', companyIds)
          .limit(1)
      : Promise.resolve({ data: [] }),
  ])
  const enabledIds = [...new Set((enabled ?? []).map((row) => row.category_id))]
  const { data: categoryRows } = enabledIds.length
    ? await supabase.from('gastronomic_categories').select('name, sort_order').in('id', enabledIds)
    : { data: [] }
  const categories = (categoryRows ?? []).map((category) => ({ name: category.name, sortOrder: category.sort_order }))
  const description = [
    weeks.length ? 'Los días en verde ya están confirmados.' : null,
    menuLegend(categories, { hasExtension: (extensions ?? []).length > 0 }),
  ].filter(Boolean).join(' ')

  return (
    <>
      <PageHeader
        eyebrow="MI ESPACIO"
        title="Mi menú"
        description={description}
      />
      {weeks.length === 0 ? (
        <EmptyState title="No hay un menú publicado" description="Cuando Mora publique la semana, vas a poder elegir acá." />
      ) : (
        <MenuWeek weeks={weeks} today={today} />
      )}
    </>
  )
}

function groupWeeks(days: MenuWeekDay[]): MenuWeekGroup[] {
  const grouped = new Map<string, MenuWeekDay[]>()
  for (const day of days) {
    const start = mondayOf(day.serviceDate)
    grouped.set(start, [...(grouped.get(start) ?? []), day])
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([start, weekDays]) => ({
      start,
      days: [...weekDays].sort((left, right) => left.serviceDate.localeCompare(right.serviceDate)),
    }))
}

function groupByCompany(rows: (MenuRow & { company_id: string; company_name: string })[]): MenuCompany[] {
  const grouped = new Map<string, MenuCompany>()
  for (const row of rows) {
    const company = grouped.get(row.company_id) ?? { companyId: row.company_id, companyName: row.company_name, rows: [] }
    company.rows.push(row)
    grouped.set(row.company_id, company)
  }
  return [...grouped.values()].sort((left, right) => left.companyName.localeCompare(right.companyName, 'es'))
}
