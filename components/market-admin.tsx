'use client'

import { useState } from 'react'
import { FormDialog } from '@/components/form-dialog'
import { StatusBadge } from '@/components/status-badge'
import { saveMarketSettings, setMarketDayState, setMarketOrderPaid, setMarketOrderStatus } from '@/lib/actions/market'
import { formatDateTime, formatMoney, moneyInput } from '@/lib/format'
import {
  billedMarketItems,
  countsForProduction,
  marketCollectionLabel,
  orderCustomerWhatsappHref,
  MARKET_PAYMENT_LABEL,
  MARKET_STATUS_LABEL,
  MARKET_STATUS_TONE,
  type MarketOrder,
  type MarketDayState,
  type MarketOrderStatus,
  type MarketSettings,
} from '@/lib/market'

export function MarketFilters({ vista, date, month }: { vista: 'dia' | 'mes'; date: string; month: string }) {
  const [mode, setMode] = useState(vista)

  return (
    <form
      className="balance-filters event-filters market-filters"
      method="get"
      action="/pedidos"
      onChange={(event) => {
        const target = event.target
        if (target instanceof HTMLSelectElement && target.name === 'vista') setMode(target.value === 'mes' ? 'mes' : 'dia')
        event.currentTarget.requestSubmit()
      }}
    >
      <label className="field">Vista
        <select name="vista" value={mode} onChange={(event) => setMode(event.target.value === 'mes' ? 'mes' : 'dia')}>
          <option value="dia">Un día</option>
          <option value="mes">Un mes</option>
        </select>
      </label>
      {mode === 'dia' ? (
        <label className="field">Fecha<input type="date" name="fecha" defaultValue={date} /></label>
      ) : (
        <label className="field">Mes<input type="month" name="mes" defaultValue={month} /></label>
      )}
      {mode === 'dia' ? <input type="hidden" name="mes" value={month} /> : <input type="hidden" name="fecha" value={date} />}
    </form>
  )
}

export function MarketDayBadge({ state }: { state: MarketDayState }) {
  return <StatusBadge tone={state.open ? 'success' : 'locked'}>{state.open ? 'Abierto' : 'Cerrado'}</StatusBadge>
}

// El día está abierto hasta que Mora lo cierra. Al cerrarlo, el mercadito deja de tomar pedidos de ese día.
export function MarketDayControl({ date, state, published }: { date: string; state: MarketDayState; published: boolean }) {
  const detail = state.open
    ? 'Se puede pedir hasta que lo cierres.'
    : 'Lo cerraste: el mercadito no toma más pedidos de este día.'
  return (
    <section className="panel market-day-control">
      <div className="panel-heading">
        <div>
          <h2>Pedidos de este día <MarketDayBadge state={state} /></h2>
          <p className="muted">{detail}{published ? '' : ' Todavía no hay un menú publicado para esa fecha, así que no aparece en el mercadito.'}</p>
        </div>
        <div className="row-actions">
          <DayStateButton date={date} estado={state.open ? 'CERRADO' : 'ABIERTO'} label={state.open ? 'Cerrar el día' : 'Reabrir el día'} primary={state.open} />
        </div>
      </div>
    </section>
  )
}

function DayStateButton({ date, estado, label, primary = false }: { date: string; estado: 'ABIERTO' | 'CERRADO'; label: string; primary?: boolean }) {
  return (
    <form action={setMarketDayState}>
      <input type="hidden" name="fecha" value={date} />
      <input type="hidden" name="estado" value={estado} />
      <button className={primary ? 'primary-button' : 'outline-button'} type="submit">{label}</button>
    </form>
  )
}

export function MarketSettingsButton({ settings }: { settings: MarketSettings }) {
  return (
    <FormDialog title="Datos del mercadito" trigger="Datos y transferencia" triggerClassName="outline-button" action={saveMarketSettings} wide>
      <label className="check-line">
        <input type="checkbox" name="enabled" value="true" defaultChecked={settings.enabled} />
        Tomar pedidos por el link público
      </label>
      <label className="field">Precio por bandeja<input name="unit_price" inputMode="decimal" defaultValue={settings.unitPrice != null ? moneyInput(settings.unitPrice) : ''} required /></label>
      <p className="muted">Incluye envío a domicilio. Es el precio que ve el público en el mercadito.</p>
      <label className="field">WhatsApp (con 54)<input name="whatsapp" defaultValue={settings.whatsapp} placeholder="5493813201368" /></label>
      <label className="field">Titular<input name="transfer_holder" defaultValue={settings.transferHolder} /></label>
      <label className="field">Banco<input name="transfer_bank" defaultValue={settings.transferBank} /></label>
      <label className="field">Alias<input name="transfer_alias" defaultValue={settings.transferAlias} /></label>
      <label className="field">CBU / CVU<input name="transfer_cbu" defaultValue={settings.transferCbu} /></label>
      <label className="field">Nota de entrega<textarea name="delivery_note" rows={2} defaultValue={settings.deliveryNote} placeholder="Zona de envío, horario, etc." /></label>
      <button className="primary-button" type="submit">Guardar</button>
    </FormDialog>
  )
}

export function MarketOrderList({ orders }: { orders: MarketOrder[] }) {
  if (orders.length === 0) {
    return <p className="muted">Todavía no hay pedidos para esa fecha.</p>
  }
  return (
    <div className="event-list">
      {orders.map((order) => {
        const whatsapp = orderCustomerWhatsappHref(order)
        return (
          <article className={`event-row market-order${order.status === 'CANCELADO' ? ' is-cancelled' : ''}`} key={order.id}>
            <div className="event-row-main">
              <div className="event-identity">
                <strong>{order.customerName}</strong>
                <div className="market-order-badges">
                  <StatusBadge tone={MARKET_STATUS_TONE[order.status]}>{MARKET_STATUS_LABEL[order.status]}</StatusBadge>
                  {order.status !== 'CANCELADO' && (
                    <StatusBadge tone={order.paid ? 'success' : 'gold'}>{marketCollectionLabel(order)}</StatusBadge>
                  )}
                  {order.afterCutoff && order.status !== 'CANCELADO' && <StatusBadge tone="locked">Fuera de corte</StatusBadge>}
                </div>
                <div className="market-order-contact">
                  <span className="event-client">{order.phone}</span>
                  {whatsapp && (
                    <a className="market-order-wa" href={whatsapp} rel="noopener noreferrer" target="_blank" aria-label={`WhatsApp a ${order.customerName}`} title="WhatsApp">
                      <WhatsAppIcon />
                    </a>
                  )}
                </div>
              </div>
              <div>
                <p className="muted">{order.address}</p>
                <p>{billedMarketItems(order.items).map((item) => `${item.quantity} ${item.optionName}`).join(' · ')}</p>
                <p className="muted">{MARKET_PAYMENT_LABEL[order.paymentMethod]} · {formatDateTime(order.createdAt)}{order.notes ? ` · ${order.notes}` : ''}</p>
              </div>
              <div className="event-money">
                <strong>{formatMoney(order.total)}</strong>
                <OrderActions order={order} />
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

function OrderActions({ order }: { order: MarketOrder }) {
  const status = order.status
  return (
    <div className="row-actions">
      {status === 'RECIBIDO' && <StatusButton id={order.id} status="CONFIRMADO" label="Confirmar" />}
      {status === 'CONFIRMADO' && <StatusButton id={order.id} status="ENTREGADO" label="Marcar entregado" />}
      {countsForProduction(status) && (
        <PaidButton
          id={order.id}
          paid={!order.paid}
          label={order.paid ? 'Quitar cobro' : order.paymentMethod === 'TRANSFERENCIA' ? 'Comprobante recibido' : 'Marcar cobrado'}
        />
      )}
      {status === 'ENTREGADO' && <StatusButton id={order.id} status="CONFIRMADO" label="Volver a confirmado" />}
      {(status === 'CONFIRMADO' || status === 'CANCELADO') && <StatusButton id={order.id} status="RECIBIDO" label="Volver a recibido" />}
      {status !== 'CANCELADO' && <StatusButton id={order.id} status="CANCELADO" label="Cancelar" />}
    </div>
  )
}

function StatusButton({ id, status, label }: { id: string; status: MarketOrderStatus; label: string }) {
  return (
    <form action={setMarketOrderStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className="outline-button" type="submit">{label}</button>
    </form>
  )
}

function PaidButton({ id, paid, label }: { id: string; paid: boolean; label: string }) {
  return (
    <form action={setMarketOrderPaid}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="paid" value={paid ? 'true' : 'false'} />
      <button className="outline-button" type="submit">{label}</button>
    </form>
  )
}
