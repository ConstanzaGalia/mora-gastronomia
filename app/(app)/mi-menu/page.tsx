import { EmptyState } from '@/components/empty-state'
import { MenuWeek, type MenuWeekDay, type MenuWeekGroup } from '@/components/menu-day'
import { PageHeader } from '@/components/page-header'
import { addDays, businessToday, mondayOf } from '@/lib/format'
import { assertRole, requireSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

export default async function MiMenuPage() {
  const session = await requireSession()
  assertRole(session, ['EMPLOYEE'])
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

  const serviceDays = (days ?? []).filter((day) => day.is_service_day)
  const menus = await Promise.all(serviceDays.map(async (day) => {
    const { data } = await supabase.rpc('get_my_menu', { p_service_date: day.service_date })
    return { serviceDate: day.service_date, rows: data ?? [] }
  }))
  const { data: selections } = await supabase
    .from('employee_selections')
    .select('id, service_date, status')
    .eq('employee_id', session.userId)
    .eq('status', 'SUBMITTED')
    .gte('service_date', start)
    .lte('service_date', end)

  const selectionByDate = new Map((selections ?? []).map((row) => [row.service_date, row.id]))
  const weeks = groupWeeks(menus.map((menu) => ({
    serviceDate: menu.serviceDate,
    rows: menu.rows,
    selectionId: selectionByDate.get(menu.serviceDate) ?? null,
  })))

  return (
    <>
      <PageHeader
        eyebrow="MI ESPACIO"
        title="Mi menú"
        description="Elegí bandeja y bebida. Postre y pan son opcionales. El cierre es a las 12:00 del día anterior. Si tu empresa tiene extensión, también podés elegir de 7:00 a 9:00 del mismo día."
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
