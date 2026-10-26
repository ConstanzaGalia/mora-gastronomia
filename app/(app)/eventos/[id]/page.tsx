import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { DeleteButton } from '@/components/delete-button'
import { EventFields } from '@/components/event-forms'
import { FormDialog } from '@/components/form-dialog'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import {
  deleteEvent,
  deleteEventExpense,
  deleteEventItem,
  deleteEventPayment,
  saveEvent,
  saveEventExpense,
  saveEventItem,
  saveEventPayment,
} from '@/lib/actions/events'
import {
  EVENT_STATUS_LABEL,
  EVENT_STATUS_TONE,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATE_LABEL,
  PAYMENT_STATE_TONE,
  eventMoney,
  formatEventTime,
  itemCost,
} from '@/lib/events'
import { businessToday, formatDay, formatMoney } from '@/lib/format'
import { assertEventosSpace, assertRole, requireSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

export default async function EventoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  assertEventosSpace(session)
  const supabase = await createClient()

  const [{ data: event }, { data: items }, { data: expenses }, { data: payments }] = await Promise.all([
    supabase.from('events').select('*').eq('id', id).eq('business_space_id', session.spaceId).maybeSingle(),
    supabase.from('event_items').select('id, name, quantity, unit_cost, notes').eq('event_id', id).eq('business_space_id', session.spaceId).order('sort_order').order('created_at'),
    supabase.from('event_expenses').select('id, spent_on, concept, amount').eq('event_id', id).eq('business_space_id', session.spaceId).order('spent_on', { ascending: false }),
    supabase.from('event_payments').select('id, paid_on, amount, method, note').eq('event_id', id).eq('business_space_id', session.spaceId).order('paid_on', { ascending: false }),
  ])
  if (!event) notFound()

  const itemRows = (items ?? []).map((item) => ({ ...item, quantity: Number(item.quantity), unit_cost: Number(item.unit_cost), subtotal: itemCost(Number(item.quantity), Number(item.unit_cost)) }))
  const expenseRows = (expenses ?? []).map((row) => ({ ...row, amount: Number(row.amount) }))
  const paymentRows = (payments ?? []).map((row) => ({ ...row, amount: Number(row.amount) }))
  const cateringCost = itemRows.reduce((sum, item) => sum + item.subtotal, 0)
  const spent = expenseRows.reduce((sum, row) => sum + row.amount, 0)
  const collected = paymentRows.reduce((sum, row) => sum + row.amount, 0)
  const money = eventMoney(Number(event.quoted_amount), collected, cateringCost, spent)
  const when = [formatDay(event.event_on), formatEventTime(event.event_time)].filter(Boolean).join(' · ')
  const details = [
    event.guest_count != null ? `${event.guest_count} invitados` : null,
    event.client_phone,
    event.client_email,
    event.notes,
  ].filter(Boolean)

  return (
    <>
      <PageHeader
        eyebrow="CATERING"
        title={event.name}
        description={`${event.client_name}${event.venue ? ` · ${event.venue}` : ''} · ${when}`}
        badge={<StatusBadge tone={EVENT_STATUS_TONE[event.status]}>{EVENT_STATUS_LABEL[event.status]}</StatusBadge>}
        action={
          <div className="header-actions">
            <Link className="outline-button" href="/eventos">Volver</Link>
            <FormDialog title="Editar evento" trigger="Editar" triggerClassName="outline-button" action={saveEvent} wide formClassName="stack-form dialog-form">
              <input type="hidden" name="id" value={event.id} />
              <input type="hidden" name="from" value={`/eventos/${event.id}`} />
              <EventFields event={event} />
              <button className="primary-button" type="submit">Guardar</button>
            </FormDialog>
            <DeleteButton action={deleteEvent} name={event.name} fields={{ id: event.id }} />
          </div>
        }
      />
      {error && <p className="error-banner">{error}</p>}

      <div className="event-summary">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Cliente</h2>
              <p className="muted">Lo acordado y lo que ya pagó.</p>
            </div>
            <StatusBadge tone={PAYMENT_STATE_TONE[money.payment]}>{PAYMENT_STATE_LABEL[money.payment]}</StatusBadge>
          </div>
          <dl className="event-summary-figures">
            <div><dt>Acordado</dt><dd>{formatMoney(money.quoted)}</dd></div>
            <div><dt>Ya pagó</dt><dd>{formatMoney(money.collected)}</dd></div>
            <div><dt>Falta cobrar</dt><dd className={money.pending > 0 ? 'money-negative' : ''}>{formatMoney(money.pending)}</dd></div>
          </dl>
          {details.length > 0 && <p className="muted event-meta">{details.join(' · ')}</p>}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Costos</h2>
              <p className="muted">Lo que sale hacer el evento.</p>
            </div>
          </div>
          <dl className="event-summary-figures">
            <div><dt>Catering</dt><dd>{formatMoney(money.cateringCost)}</dd></div>
            <div><dt>Gastos</dt><dd>{formatMoney(money.expenses)}</dd></div>
            <div><dt>Margen</dt><dd className={money.margin < 0 ? 'money-negative' : ''}>{formatMoney(money.margin)}</dd></div>
          </dl>
        </section>
      </div>

      <EventCard
        title="Catering"
        hint="Menú operativo con costo interno. No suma a lo que debe el cliente."
        total={itemRows.length ? cateringCost : null}
        action={
          <FormDialog title="Agregar ítem" trigger="Agregar ítem" action={saveEventItem} formClassName="balance-form dialog-form">
            <input type="hidden" name="event_id" value={event.id} />
            <label className="field">Ítem<input name="name" placeholder="Entrada, principal, bebidas…" required /></label>
            <label className="field">Cantidad<input name="quantity" inputMode="decimal" placeholder="1" required /></label>
            <label className="field">Costo unitario<input name="unit_cost" inputMode="decimal" placeholder="0,00" required /></label>
            <label className="field">Notas<input name="notes" /></label>
            <button className="primary-button" type="submit">Agregar</button>
          </FormDialog>
        }
      >
        {itemRows.length === 0 ? (
          <p className="muted ledger-empty">Todavía no hay ítems de catering.</p>
        ) : itemRows.map((item) => (
          <LedgerRow
            key={item.id}
            title={item.name}
            detail={`${item.quantity} × ${formatMoney(item.unit_cost)}${item.notes ? ` · ${item.notes}` : ''}`}
            amount={item.subtotal}
            deleteName={item.name}
            deleteAction={deleteEventItem}
            fields={{ id: item.id, event_id: event.id }}
          />
        ))}
      </EventCard>

      <EventCard
        title="Gastos"
        hint="Salidas de plata de este evento."
        total={expenseRows.length ? spent : null}
        action={
          <FormDialog title="Anotar gasto" trigger="Anotar gasto" action={saveEventExpense} formClassName="balance-form dialog-form">
            <input type="hidden" name="event_id" value={event.id} />
            <label className="field">Fecha<input type="date" name="spent_on" defaultValue={event.event_on} required /></label>
            <label className="field">Concepto<input name="concept" required /></label>
            <label className="field">Monto<input name="amount" inputMode="decimal" placeholder="0,00" required /></label>
            <button className="primary-button" type="submit">Anotar gasto</button>
          </FormDialog>
        }
      >
        {expenseRows.length === 0 ? (
          <p className="muted ledger-empty">Todavía no hay gastos.</p>
        ) : expenseRows.map((row) => (
          <LedgerRow
            key={row.id}
            title={row.concept}
            detail={formatDay(row.spent_on)}
            amount={row.amount}
            deleteName={row.concept}
            deleteAction={deleteEventExpense}
            fields={{ id: row.id, event_id: event.id }}
          />
        ))}
      </EventCard>

      <EventCard
        title="Cobros"
        hint="Seña y pagos parciales del cliente."
        total={paymentRows.length ? collected : null}
        action={
          <FormDialog title="Anotar cobro" trigger="Anotar cobro" action={saveEventPayment} formClassName="balance-form dialog-form">
            <input type="hidden" name="event_id" value={event.id} />
            <label className="field">Fecha<input type="date" name="paid_on" defaultValue={businessToday()} required /></label>
            <label className="field">Monto<input name="amount" inputMode="decimal" placeholder="0,00" required /></label>
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
        }
      >
        {paymentRows.length === 0 ? (
          <p className="muted ledger-empty">Todavía no hay cobros.</p>
        ) : paymentRows.map((row) => (
          <LedgerRow
            key={row.id}
            title={row.note || PAYMENT_METHOD_LABEL[row.method]}
            detail={`${formatDay(row.paid_on)} · ${PAYMENT_METHOD_LABEL[row.method]}`}
            amount={row.amount}
            deleteName={`el cobro del ${formatDay(row.paid_on)}`}
            deleteAction={deleteEventPayment}
            fields={{ id: row.id, event_id: event.id }}
          />
        ))}
      </EventCard>
    </>
  )
}

function EventCard({
  title,
  hint,
  action,
  total,
  children,
}: {
  title: string
  hint: string
  action: ReactNode
  total: number | null
  children: ReactNode
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <p className="muted">{hint}</p>
        </div>
        {action}
      </div>
      <div className="event-ledger">{children}</div>
      {total != null && <p className="event-card-total">Total {formatMoney(total)}</p>}
    </section>
  )
}

function LedgerRow({
  title,
  detail,
  amount,
  deleteName,
  deleteAction,
  fields,
}: {
  title: string
  detail: string
  amount: number
  deleteName: string
  deleteAction: (formData: FormData) => void | Promise<void>
  fields: Record<string, string>
}) {
  return (
    <div className="event-ledger-item">
      <div>
        <strong>{title}</strong>
        <small>{detail}</small>
      </div>
      <div className="event-ledger-amount">
        <span className="amount">{formatMoney(amount)}</span>
        <DeleteButton action={deleteAction} name={deleteName} fields={fields} />
      </div>
    </div>
  )
}
