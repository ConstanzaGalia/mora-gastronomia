import type { createClient } from '@/lib/supabase/server'
import { eventMoney } from '@/lib/events'

type Supabase = Awaited<ReturnType<typeof createClient>>

export async function loadEventRows(supabase: Supabase, spaceId: string) {
  const { data: events } = await supabase
    .from('events')
    .select('id, name, client_name, event_on, guest_count, quoted_amount, status')
    .eq('business_space_id', spaceId)
    .order('event_on', { ascending: false })
  const ids = (events ?? []).map((event) => event.id)
  if (ids.length === 0) return []

  const [{ data: expenses }, { data: payments }] = await Promise.all([
    supabase.from('event_expenses').select('event_id, amount').eq('business_space_id', spaceId).in('event_id', ids),
    supabase.from('event_payments').select('event_id, amount').eq('business_space_id', spaceId).in('event_id', ids),
  ])
  const spentBy = totalsByEvent(expenses ?? [])
  const collectedBy = totalsByEvent(payments ?? [])

  return (events ?? []).map((event) => ({
    ...event,
    money: eventMoney(Number(event.quoted_amount), collectedBy.get(event.id) ?? 0, spentBy.get(event.id) ?? 0),
  }))
}

export type EventRow = Awaited<ReturnType<typeof loadEventRows>>[number]

function totalsByEvent(rows: { event_id: string; amount: number | string }[]) {
  const totals = new Map<string, number>()
  for (const row of rows) totals.set(row.event_id, (totals.get(row.event_id) ?? 0) + Number(row.amount))
  return totals
}

// Eventos donde tiene sentido anotar un gasto rápido: los de los últimos 30 días y los próximos,
// con el más cercano a hoy primero (queda preseleccionado).
export function quickExpenseEvents(rows: EventRow[], today: string) {
  const now = Date.parse(today)
  const day = 24 * 60 * 60 * 1000
  return rows
    .filter((event) => event.status !== 'CANCELADO' && Date.parse(event.event_on) >= now - 30 * day)
    .sort((a, b) => Math.abs(Date.parse(a.event_on) - now) - Math.abs(Date.parse(b.event_on) - now))
    .map((event) => ({ id: event.id, name: event.name, event_on: event.event_on }))
}
