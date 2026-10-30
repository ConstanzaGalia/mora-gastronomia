import Link from 'next/link'
import { DeleteButton } from '@/components/delete-button'
import { EmptyState } from '@/components/empty-state'
import { FormDialog } from '@/components/form-dialog'
import { NewWeekForm } from '@/components/new-week-form'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { deleteWeek } from '@/lib/actions/calendar'
import { formatDay } from '@/lib/format'
import { assertRole, assertViandasSpace, requireSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

export default async function CalendarioPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  assertViandasSpace(session)
  const supabase = await createClient()
  const { data: weeks } = await supabase
    .from('calendar_weeks')
    .select('id, week_start, week_end, status, calendar_days(id, service_date, is_service_day, daily_availability(sort_order, gastronomic_options(name), gastronomic_categories(name, sort_order)))')
    .eq('business_space_id', session.spaceId)
    .order('week_start', { ascending: false })

  return (
    <>
      <PageHeader
        eyebrow="CALENDARIO DE SERVICIO"
        title="Calendario"
        description="Prepará la semana en borrador y publicala cuando el menú esté listo."
        action={
          <FormDialog title="Nueva semana" trigger="Nueva semana">
            <p className="muted">Tiene que empezar un lunes. Se crean de lunes a viernes como días de servicio.</p>
            <NewWeekForm />
          </FormDialog>
        }
      />
      {error && <p className="error-banner">{error}</p>}
      {(weeks ?? []).length === 0 ? <EmptyState title="No hay semanas" description="Creá la semana siguiente para cargar el menú." /> : weeks?.map((week) => (
        <section className="panel" key={week.id}>
          <div className="panel-heading">
            <div>
              <h2>{formatDay(week.week_start)} al {formatDay(week.week_end)}</h2>
              <p className="muted">{week.status === 'PUBLISHED' ? 'Publicada: se puede sumar o sacar opciones que nadie eligió.' : 'Borrador: podés seguir editando.'}</p>
            </div>
            <StatusBadge tone={week.status === 'PUBLISHED' ? 'success' : 'draft'}>{week.status === 'PUBLISHED' ? 'Publicada' : 'Borrador'}</StatusBadge>
          </div>
          <div className="week-menu">
            {week.calendar_days.sort((a, b) => a.service_date.localeCompare(b.service_date)).map((day) => {
              const groups = optionGroups(day.daily_availability)
              const count = groups.reduce((sum, group) => sum + group.names.length, 0)
              const tone = !day.is_service_day ? 'empty' : week.status === 'PUBLISHED' ? 'published' : count ? 'editing' : 'draft'
              return (
                <article className={`week-menu-day ${tone}`} key={day.id}>
                  <header>
                    <strong>{day.service_date.slice(8)}</strong>
                    <span>{formatDay(day.service_date).split(' ')[0]}</span>
                    <small>
                      <span className="status-dot" />
                      {!day.is_service_day ? 'Sin servicio' : week.status === 'PUBLISHED' ? 'Publicado' : count ? 'En edición' : 'Borrador'}
                    </small>
                  </header>
                  {!day.is_service_day || count === 0 ? (
                    <p className="week-menu-empty">{day.is_service_day ? 'Sin opciones' : '—'}</p>
                  ) : (
                    <div className="week-menu-groups">
                      {groups.map((group) => (
                        <div key={group.category}>
                          <h3>{group.category}</h3>
                          <ul>
                            {group.names.map((name, index) => <li key={`${index}-${name}`}>{name}</li>)}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
          <div className="panel-footer">
            <Link className="text-button" href={`/calendario/${week.id}`}>Configurar</Link>
            {week.status === 'DRAFT' && (
              <DeleteButton action={deleteWeek} name={`la semana del ${formatDay(week.week_start)}`} label="Eliminar semana" fields={{ week_id: week.id }} />
            )}
          </div>
        </section>
      ))}
    </>
  )
}

function asOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function optionGroups(rows: {
  sort_order: number
  gastronomic_options: { name: string } | { name: string }[] | null
  gastronomic_categories: { name: string; sort_order: number } | { name: string; sort_order: number }[] | null
}[]) {
  const groups = new Map<string, { sort: number; names: string[] }>()
  for (const row of [...rows].sort((a, b) => a.sort_order - b.sort_order)) {
    const option = asOne(row.gastronomic_options)
    const category = asOne(row.gastronomic_categories)
    if (!option?.name) continue
    const label = category?.name || 'Menú'
    const current = groups.get(label) ?? { sort: category?.sort_order ?? 0, names: [] }
    current.names.push(option.name)
    groups.set(label, current)
  }
  return [...groups.entries()]
    .sort((a, b) => a[1].sort - b[1].sort || a[0].localeCompare(b[0], 'es'))
    .map(([category, group]) => ({ category, names: group.names }))
}
