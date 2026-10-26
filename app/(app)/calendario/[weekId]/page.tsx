import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AvailabilityForm } from '@/components/availability-form'
import { ExtensionForm } from '@/components/extension-form'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { setWeekStatus } from '@/lib/actions/calendar'
import { formatDay } from '@/lib/format'
import { assertRole, requireSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

export default async function WeekPage({
  params,
  searchParams,
}: {
  params: Promise<{ weekId: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { weekId } = await params
  const { error } = await searchParams
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  const supabase = await createClient()

  const { data: week } = await supabase
    .from('calendar_weeks')
    .select('id, week_start, week_end, status, business_space_id, calendar_days(id, service_date, is_service_day, daily_availability(option_id))')
    .eq('id', weekId)
    .maybeSingle()
  if (!week || week.business_space_id !== session.spaceId) notFound()

  const dayIds = week.calendar_days.map((day) => day.id)
  const [{ data: categories }, { data: companies }, { data: extensions }] = await Promise.all([
    supabase
      .from('gastronomic_categories')
      .select('id, name, slug, sort_order, gastronomic_options(id, name, active, sort_order)')
      .eq('business_space_id', session.spaceId)
      .eq('active', true)
      .order('sort_order'),
    supabase.from('companies').select('id, nombre_comercial').eq('business_space_id', session.spaceId).eq('active', true).order('nombre_comercial'),
    dayIds.length === 0
      ? Promise.resolve({ data: [] })
      : supabase.from('day_company_extensions').select('calendar_day_id, company_id').in('calendar_day_id', dayIds),
  ])

  const published = week.status === 'PUBLISHED'
  const catalog = (categories ?? []).map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    options: category.gastronomic_options.filter((option) => option.active).sort((a, b) => a.sort_order - b.sort_order),
  }))

  return (
    <>
      <PageHeader
        eyebrow="SEMANA"
        title={`${formatDay(week.week_start)} al ${formatDay(week.week_end)}`}
        description={published ? 'Publicada. Solo se muestran las opciones que se ofrecieron. Despublicar solo es posible si nadie eligió todavía.' : 'Marcá en qué días se ofrece cada opción y guardá la semana antes de publicar.'}
        badge={<StatusBadge tone={published ? 'success' : 'draft'}>{published ? 'Publicada' : 'Borrador'}</StatusBadge>}
        action={
          <div className="header-actions">
            <Link className="outline-button" href="/calendario">Volver al calendario</Link>
            <form action={setWeekStatus}>
              <input type="hidden" name="week_id" value={week.id} />
              <input type="hidden" name="status" value={published ? 'DRAFT' : 'PUBLISHED'} />
              <button className="primary-button" type="submit">{published ? 'Volver a borrador' : 'Publicar semana'}</button>
            </form>
          </div>
        }
      />
      {error && <p className="error-banner">{error}</p>}
      <AvailabilityForm
        weekId={week.id}
        published={published}
        categories={catalog}
        days={[...week.calendar_days].sort((a, b) => a.service_date.localeCompare(b.service_date)).map((day) => ({
          id: day.id,
          serviceDate: day.service_date,
          isServiceDay: day.is_service_day,
          optionIds: day.daily_availability.map((row) => row.option_id),
        }))}
      />
      <ExtensionForm
        weekId={week.id}
        days={[...week.calendar_days].sort((a, b) => a.service_date.localeCompare(b.service_date)).map((day) => ({
          id: day.id,
          serviceDate: day.service_date,
          isServiceDay: day.is_service_day,
        }))}
        companies={companies ?? []}
        enabled={(extensions ?? []).map((row) => `${row.calendar_day_id}|${row.company_id}`)}
      />
    </>
  )
}
