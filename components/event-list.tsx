import Link from 'next/link'
import { PaymentButton } from '@/components/event-forms'
import { StatusBadge } from '@/components/status-badge'
import {
  EVENT_STATUS_LABEL,
  EVENT_STATUS_TONE,
  PAYMENT_STATE_LABEL,
  PAYMENT_STATE_TONE,
  displayStatus,
  eventDateParts,
  type EventStatus,
  type PaymentState,
} from '@/lib/events'
import { businessToday, formatMoney } from '@/lib/format'

export type EventListRow = {
  id: string
  name: string
  client_name: string
  event_on: string
  guest_count?: number | null
  status: EventStatus
  money: { quoted: number; collected: number; pending: number; payment: PaymentState }
}

export function EventList({ rows, showPayment = false }: { rows: EventListRow[]; showPayment?: boolean }) {
  const today = businessToday()
  return (
    <div className="event-list">
      {rows.map((event) => {
        const date = eventDateParts(event.event_on)
        const status = displayStatus(event.status, event.event_on, today)
        const cancelled = event.status === 'CANCELADO'
        const paid = event.money.payment === 'cobrado'
        return (
          <article key={event.id} className={`event-row${cancelled ? ' is-cancelled' : ''}`}>
            <Link href={`/eventos/${event.id}`} className="event-row-main">
              <div className="event-date">
                <strong>{date.day}</strong>
                <span>{date.month}</span>
                <small>{date.weekday}</small>
              </div>
              <div className="event-identity">
                <strong>{event.name}</strong>
                <p className="event-client">
                  {event.client_name}
                  {event.guest_count != null ? ` · ${event.guest_count} invitados` : ''}
                </p>
                <StatusBadge tone={EVENT_STATUS_TONE[status]}>{EVENT_STATUS_LABEL[status]}</StatusBadge>
              </div>
              <div className="event-money">
                <StatusBadge tone={PAYMENT_STATE_TONE[event.money.payment]}>{PAYMENT_STATE_LABEL[event.money.payment]}</StatusBadge>
                <small>Pagó {formatMoney(event.money.collected)} de {formatMoney(event.money.quoted)}</small>
                <strong className={paid ? '' : 'money-negative'}>
                  {paid ? 'No falta nada' : `Faltan ${formatMoney(event.money.pending)}`}
                </strong>
              </div>
            </Link>
            {showPayment && !cancelled && event.money.pending > 0 && (
              <PaymentButton eventId={event.id} pending={event.money.pending} />
            )}
          </article>
        )
      })}
    </div>
  )
}
