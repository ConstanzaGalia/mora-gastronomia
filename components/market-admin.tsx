'use client'

import { FormDialog } from '@/components/form-dialog'
import { StatusBadge } from '@/components/status-badge'
import { saveMarketSettings, setMarketOrderStatus } from '@/lib/actions/market'
import { formatDateTime, formatMoney, moneyInput } from '@/lib/format'
import {
  MARKET_PAYMENT_LABEL,
  MARKET_STATUS_LABEL,
  MARKET_STATUS_TONE,
  type MarketOrder,
  type MarketOrderStatus,
  type MarketSettings,
} from '@/lib/market'

export function MarketSettingsButton({ settings }: { settings: MarketSettings }) {
  return (
    <FormDialog title="Datos del mercadito" trigger="Datos y transferencia" triggerClassName="outline-button" action={saveMarketSettings} wide>
      <label className="check-line">
        <input type="checkbox" name="enabled" value="true" defaultChecked={settings.enabled} />
        Tomar pedidos por el link público
      </label>
      <label className="field">Precio por unidad<input name="unit_price" inputMode="decimal" defaultValue={settings.unitPrice != null ? moneyInput(settings.unitPrice) : ''} required /></label>
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
      {orders.map((order) => (
        <article className="event-row" key={order.id}>
          <div className="event-row-main">
            <div className="event-identity">
              <strong>{order.customerName}</strong>
              <span className="event-client">{order.phone}</span>
              <StatusBadge tone={MARKET_STATUS_TONE[order.status]}>{MARKET_STATUS_LABEL[order.status]}</StatusBadge>
            </div>
            <div>
              <p className="muted">{order.address}</p>
              <p>{order.items.map((item) => `${item.quantity} ${item.optionName}`).join(' · ')}</p>
              <p className="muted">{MARKET_PAYMENT_LABEL[order.paymentMethod]} · {formatDateTime(order.createdAt)}{order.notes ? ` · ${order.notes}` : ''}</p>
            </div>
            <div className="event-money">
              <strong>{formatMoney(order.total)}</strong>
              <div className="row-actions">
                {order.status !== 'LISTO' && <StatusButton id={order.id} status="LISTO" label="Marcar listo" />}
                {order.status !== 'CANCELADO' && <StatusButton id={order.id} status="CANCELADO" label="Cancelar" />}
                {order.status !== 'NUEVO' && <StatusButton id={order.id} status="NUEVO" label="Volver a nuevo" />}
              </div>
            </div>
          </div>
        </article>
      ))}
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
