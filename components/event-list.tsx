import Link from 'next/link'
import { DeleteButton } from '@/components/delete-button'
import { StatusBadge } from '@/components/status-badge'
import { deleteEvent } from '@/lib/actions/events'
import {
  EVENT_STATUS_LABEL,
  EVENT_STATUS_TONE,
  PAYMENT_STATE_LABEL,
  PAYMENT_STATE_TONE,
  eventDateParts,
  type EventStatus,
  type PaymentState,
} from '@/lib/events'
import { formatMoney } from '@/lib/format'

export type EventListRow = {
  id: string
  name: string
  client_name: string
  event_on: string
  guest_count?: number | null
  status: EventStatus
  money: { quoted: number; collected: number; pending: number; payment: PaymentState }
}

export function EventList({ rows, showDelete = false }: { rows: EventListRow[]; showDelete?: boolean }) {
  return (
    <div className="event-list">
      {rows.map((event) => {
        const date = eventDateParts(event.event_on)
        const paid = event.money.payment === 'cobrado'
        return (
          <article key={event.id} className="event-row">
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
                <StatusBadge tone={EVENT_STATUS_TONE[event.status]}>{EVENT_STATUS_LABEL[event.status]}</StatusBadge>
              </div>
              <div className="event-money">
                <StatusBadge tone={PAYMENT_STATE_TONE[event.money.payment]}>{PAYMENT_STATE_LABEL[event.money.payment]}</StatusBadge>
                <small>Pagó {formatMoney(event.money.collected)} de {formatMoney(event.money.quoted)}</small>
                <strong className={paid ? '' : 'money-negative'}>
                  {paid ? 'No falta nada' : `Faltan ${formatMoney(event.money.pending)}`}
                </strong>
              </div>
            </Link>
            {showDelete && <DeleteButton action={deleteEvent} name={event.name} fields={{ id: event.id }} />}
          </article>
        )
      })}
    </div>
  )
}
