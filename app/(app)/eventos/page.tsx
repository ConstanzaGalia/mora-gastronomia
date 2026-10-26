import { EmptyState } from '@/components/empty-state'
import { EventFilters } from '@/components/event-filters'
import { EventList } from '@/components/event-list'
import { NewEventButton } from '@/components/event-forms'
import { PageHeader } from '@/components/page-header'
import { eventMoney, itemCost, periodFromSearch, type PaymentState } from '@/lib/events'
import { formatMonth } from '@/lib/format'
import { assertEventosSpace, assertRole, requireSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

export default async function EventosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; mes?: string; anio?: string; vista?: string; cobro?: string }>
}) {
  const { error, mes, anio, vista, cobro } = await searchParams
  const period = periodFromSearch(mes, anio, vista)
  const cobroFilter = cobro === 'pendiente' || cobro === 'parcial' || cobro === 'cobrado' ? cobro as PaymentState : undefined
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  assertEventosSpace(session)
  const supabase = await createClient()

  const [{ data: events }, { data: items }, { data: expenses }, { data: payments }] = await Promise.all([
    supabase.from('events').select('id, name, client_name, event_on, guest_count, quoted_amount, status').eq('business_space_id', session.spaceId).gte('event_on', period.start).lte('event_on', period.end).order('event_on', { ascending: false }),
    supabase.from('event_items').select('event_id, quantity, unit_cost').eq('business_space_id', session.spaceId),
    supabase.from('event_expenses').select('event_id, amount').eq('business_space_id', session.spaceId),
    supabase.from('event_payments').select('event_id, amount').eq('business_space_id', session.spaceId),
  ])

  const rows = (events ?? []).map((event) => {
    const cateringCost = (items ?? []).filter((item) => item.event_id === event.id).reduce((sum, item) => sum + itemCost(Number(item.quantity), Number(item.unit_cost)), 0)
    const spent = (expenses ?? []).filter((row) => row.event_id === event.id).reduce((sum, row) => sum + Number(row.amount), 0)
    const collected = (payments ?? []).filter((row) => row.event_id === event.id).reduce((sum, row) => sum + Number(row.amount), 0)
    const money = eventMoney(Number(event.quoted_amount), collected, cateringCost, spent)
    return { ...event, money }
  }).filter((event) => !cobroFilter || event.money.payment === cobroFilter)

  const periodLabel = period.vista === 'anio' ? period.year : formatMonth(period.month)

  return (
    <>
      <PageHeader
        eyebrow="CATERING"
        title="Eventos"
        description={`Quién contrató, cuándo es y cuánto falta cobrar · ${periodLabel}.`}
        action={<NewEventButton />}
      />
      {error && <p className="error-banner">{error}</p>}
      <section className="panel">
        <div className="panel-heading event-list-heading">
          <div>
            <h2>{rows.length} evento{rows.length === 1 ? '' : 's'}</h2>
            <p className="muted">Entrá a uno para ver el menú, los gastos y los pagos.</p>
          </div>
          <EventFilters action="/eventos" vista={period.vista} month={period.month} year={period.year} cobro={cobroFilter} />
        </div>
        {rows.length === 0 ? (
          <EmptyState title="No hay eventos en este período" description="Creá el primero para anotar el menú, los gastos y los cobros." />
        ) : (
          <EventList rows={rows} showDelete />
        )}
      </section>
    </>
  )
}
