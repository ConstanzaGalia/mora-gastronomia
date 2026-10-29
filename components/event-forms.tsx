import { FormDialog } from '@/components/form-dialog'
import { saveEvent, saveEventExpense, saveEventPayment } from '@/lib/actions/events'
import { businessToday, moneyInput } from '@/lib/format'
import {
  EVENT_STATUS_LABEL,
  eventTimeInput,
  type EventStatus,
} from '@/lib/events'

// REALIZADO se deduce de la fecha, así que no se elige a mano.
const STATUSES = (Object.entries(EVENT_STATUS_LABEL) as [EventStatus, string][]).filter(([value]) => value !== 'REALIZADO')

export function EventFields({
  event,
}: {
  event?: {
    name: string
    client_name: string
    client_phone: string | null
    client_email: string | null
    event_on: string
    event_time: string | null
    venue: string | null
    guest_count: number | null
    quoted_amount: number
    notes: string | null
    status: EventStatus
  }
}) {
  const hasMore = Boolean(
    event && (event.client_phone || event.client_email || event.event_time || event.venue || event.guest_count != null || event.notes),
  )
  return (
    <>
      <label className="field">Nombre del evento<input name="name" defaultValue={event?.name ?? ''} required /></label>
      <label className="field">Cliente<input name="client_name" defaultValue={event?.client_name ?? ''} required /></label>
      <div className="event-fields-row">
        <label className="field">Fecha<input type="date" name="event_on" defaultValue={event?.event_on ?? businessToday()} required /></label>
        <label className="field">Monto acordado<input name="quoted_amount" inputMode="decimal" defaultValue={event ? moneyInput(event.quoted_amount) : ''} placeholder="0,00" required /></label>
      </div>
      <label className="field">Estado
        <select name="status" defaultValue={event?.status === 'REALIZADO' ? 'CONFIRMADO' : event?.status ?? 'BORRADOR'}>
          {STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <details className="event-more" open={hasMore}>
        <summary>Más datos</summary>
        <div className="event-more-fields">
          <div className="event-fields-row">
            <label className="field">Teléfono<input name="client_phone" defaultValue={event?.client_phone ?? ''} /></label>
            <label className="field">Email<input type="email" name="client_email" defaultValue={event?.client_email ?? ''} /></label>
          </div>
          <div className="event-fields-row">
            <label className="field">Hora<input type="time" name="event_time" defaultValue={eventTimeInput(event?.event_time ?? null)} /></label>
            <label className="field">Invitados<input name="guest_count" inputMode="numeric" defaultValue={event?.guest_count ?? ''} /></label>
          </div>
          <label className="field">Lugar<input name="venue" defaultValue={event?.venue ?? ''} /></label>
          <label className="field">Notas<textarea name="notes" rows={3} defaultValue={event?.notes ?? ''} /></label>
        </div>
      </details>
    </>
  )
}

export function NewEventButton() {
  return (
    <FormDialog title="Nuevo evento" trigger="Nuevo evento" action={saveEvent} wide formClassName="stack-form dialog-form">
      <input type="hidden" name="from" value="/eventos" />
      <EventFields />
      <button className="primary-button" type="submit">Crear evento</button>
    </FormDialog>
  )
}

export function PaymentButton({
  eventId,
  pending,
  triggerClassName = 'outline-button',
}: {
  eventId: string
  pending?: number
  triggerClassName?: string
}) {
  return (
    <FormDialog title="Anotar cobro" trigger="Anotar cobro" triggerClassName={triggerClassName} action={saveEventPayment} formClassName="balance-form dialog-form">
      <input type="hidden" name="event_id" value={eventId} />
      <label className="field">Fecha<input type="date" name="paid_on" defaultValue={businessToday()} required /></label>
      <label className="field">Monto<input name="amount" inputMode="decimal" placeholder="0,00" defaultValue={pending ? moneyInput(pending) : ''} required /></label>
      <label className="field">Medio
        <select name="method" defaultValue="TRANSFERENCIA">
          <option value="EFECTIVO">Efectivo</option>
          <option value="TRANSFERENCIA">Transferencia</option>
          <option value="ECHEQ">eCheq</option>
        </select>
      </label>
      <label className="field">Nota<input name="note" placeholder="Seña, saldo…" /></label>
      <button className="primary-button" type="submit">Anotar cobro</button>
    </FormDialog>
  )
}

// Botón flotante "+" para anotar un gasto rápido (pensado para el celular).
export function ExpenseFab({
  eventId,
  events,
}: {
  eventId?: string
  events?: { id: string; name: string; event_on: string }[]
}) {
  if (!eventId && !events?.length) return null
  return (
    <FormDialog title="Anotar gasto" trigger="+" triggerLabel="Anotar gasto" triggerClassName="fab" action={saveEventExpense} formClassName="balance-form dialog-form">
      {eventId ? (
        <input type="hidden" name="event_id" value={eventId} />
      ) : (
        <label className="field">Evento
          <select name="event_id" defaultValue={events?.[0]?.id}>
            {events?.map((event) => <option key={event.id} value={event.id}>{event.name} · {event.event_on.slice(8, 10)}/{event.event_on.slice(5, 7)}</option>)}
          </select>
        </label>
      )}
      <label className="field">Concepto<input name="concept" placeholder="Compras, flete, personal…" required /></label>
      <label className="field">Monto<input name="amount" inputMode="decimal" placeholder="0,00" required /></label>
      <label className="field">Fecha<input type="date" name="spent_on" defaultValue={businessToday()} required /></label>
      <button className="primary-button" type="submit">Anotar gasto</button>
    </FormDialog>
  )
}
