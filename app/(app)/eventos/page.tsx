import Link from 'next/link'
import { EmptyState } from '@/components/empty-state'
import { EventList } from '@/components/event-list'
import { ExpenseFab, NewEventButton } from '@/components/event-forms'
import { PageHeader } from '@/components/page-header'
import { loadEventRows, quickExpenseEvents } from '@/lib/event-data'
import { businessToday } from '@/lib/format'
import { assertEventosSpace, assertRole, requireSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

const TABS = [
  { value: 'proximos', label: 'Próximos', empty: 'No hay eventos próximos', hint: 'Creá uno para anotar los gastos y los cobros.' },
  { value: 'cobrar', label: 'Por cobrar', empty: 'No hay saldos pendientes', hint: 'Cuando un evento tenga plata por cobrar, aparece acá.' },
  { value: 'anteriores', label: 'Anteriores', empty: 'Todavía no hay eventos anteriores', hint: 'Acá quedan los eventos ya realizados y los cancelados.' },
] as const

export default async function EventosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ver?: string }>
}) {
  const { error, ver } = await searchParams
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  assertEventosSpace(session)
  const supabase = await createClient()
  const today = businessToday()

  const all = await loadEventRows(supabase, session.spaceId)
  const live = all.filter((event) => event.status !== 'CANCELADO')
  const groups = {
    proximos: live.filter((event) => event.event_on >= today).sort((a, b) => a.event_on.localeCompare(b.event_on)),
    cobrar: live.filter((event) => event.money.pending > 0),
    anteriores: all.filter((event) => event.status === 'CANCELADO' || event.event_on < today),
  }
  const tab = TABS.find((item) => item.value === ver) ?? TABS[0]
  const rows = groups[tab.value]

  return (
    <>
      <PageHeader
        eyebrow="CATERING"
        title="Eventos"
        description="Quién contrató, cuándo es y cuánto falta cobrar."
        action={<NewEventButton />}
      />
      {error && <p className="error-banner">{error}</p>}
      <section className="panel">
        <nav className="event-tabs" aria-label="Eventos">
          {TABS.map((item) => (
            <Link key={item.value} href={`/eventos?ver=${item.value}`} className={item.value === tab.value ? 'active' : ''}>
              {item.label} <span>{groups[item.value].length}</span>
            </Link>
          ))}
        </nav>
        {rows.length === 0 ? (
          <EmptyState title={tab.empty} description={tab.hint} />
        ) : (
          <EventList rows={rows} showPayment />
        )}
      </section>
      <ExpenseFab events={quickExpenseEvents(all, today)} />
    </>
  )
}
