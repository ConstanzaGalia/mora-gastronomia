import Link from 'next/link'
import { EmptyState } from '@/components/empty-state'
import { MarketDeliveryMap } from '@/components/market-delivery-map'
import { MarketFilters, MarketOrderList, MarketSettingsButton } from '@/components/market-admin'
import { PageHeader } from '@/components/page-header'
import { currentMonth, dashboardFocusDate, formatLongDate, formatMoney, formatMonth, monthRange } from '@/lib/format'
import {
  asMarketOrder,
  groupMarketOrdersByDay,
  mapMarketSettings,
  marketKitchen,
  marketTotals,
  sortMarketOrders,
} from '@/lib/market'
import { assertRole, assertViandasSpace, requireSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

const ORDER_SELECT = 'id, service_date, customer_name, phone, address, payment_method, status, notes, total, created_at, market_order_items(option_id, category_name, option_name, quantity, unit_price, amount, sort_order)'

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; mes?: string; vista?: string; error?: string }>
}) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN'])
  assertViandasSpace(session)
  const { fecha, mes, vista, error } = await searchParams
  const view = vista === 'mes' ? 'mes' : 'dia'
  const date = /^\d{4}-\d{2}-\d{2}$/.test(fecha ?? '') ? fecha! : dashboardFocusDate()
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(mes ?? '') ? mes! : currentMonth(date)
  const range = monthRange(month)
  const supabase = await createClient()

  let ordersQuery = supabase
    .from('market_orders')
    .select(ORDER_SELECT)
    .eq('business_space_id', session.spaceId)
    .order('service_date', { ascending: false })
    .order('created_at', { ascending: false })

  ordersQuery = view === 'mes'
    ? ordersQuery.gte('service_date', range.start).lte('service_date', range.end)
    : ordersQuery.eq('service_date', date)

  const [{ data: settingsRow }, { data: rows }] = await Promise.all([
    supabase.from('market_settings').select('*').eq('business_space_id', session.spaceId).maybeSingle(),
    ordersQuery,
  ])

  const settings = mapMarketSettings(settingsRow)
  const orders = (rows ?? []).flatMap((row) => {
    const order = asMarketOrder(row)
    return order ? [order] : []
  })
  const totals = marketTotals(orders)
  const kitchen = view === 'dia' ? marketKitchen(orders) : []
  const deliveries = orders
    .filter((order) => order.status !== 'CANCELADO' && order.address.trim())
    .map((order) => ({
      id: order.id,
      name: order.customerName,
      address: order.address,
      phone: order.phone,
    }))
  const days = view === 'mes' ? groupMarketOrdersByDay(orders) : [{ date, orders: sortMarketOrders(orders) }]
  const periodLabel = view === 'mes' ? formatMonth(month) : formatLongDate(date)
  const periodHint = view === 'mes' ? 'del mes' : 'del día'

  return (
    <>
      <PageHeader
        eyebrow="MERCADITO"
        title="Pedidos"
        description={`Control de pedidos y plata del mercadito · ${periodLabel}. Cada bandeja incluye envío. El precio se carga en Datos y transferencia.`}
        action={
          <div className="topbar-actions">
            <Link className="outline-button" href="/mercadito" target="_blank">Ver link público</Link>
            <MarketSettingsButton settings={settings} />
          </div>
        }
      />
      <MarketFilters vista={view} date={date} month={month} />
      {error && <p className="error-banner">{error}</p>}
      {!settings.transferAlias && !settings.transferCbu && (
        <p className="warn-banner">Faltan alias o CBU. Cargalos en Datos y transferencia para que quien pague por transferencia vea las instrucciones.</p>
      )}
      <div className="stats-grid balance-stats">
        <article className="stat-card money">
          <div className="stat-label">Pedidos</div>
          <div className="stat-value-row"><strong>{totals.orders}</strong></div>
          <p>{totals.cancelled ? `${totals.cancelled} cancelado${totals.cancelled === 1 ? '' : 's'} no suman` : `no cancelados ${periodHint}`}</p>
        </article>
        <article className="stat-card money">
          <div className="stat-label">Viandas</div>
          <div className="stat-value-row"><strong>{totals.viandas}</strong></div>
          <p>unidades a producir {periodHint}</p>
        </article>
        <article className="stat-card money">
          <div className="stat-label">Total</div>
          <div className="stat-value-row"><strong>{formatMoney(totals.total)}</strong></div>
          <p>plata del mercadito {periodHint}</p>
        </article>
        <article className="stat-card money">
          <div className="stat-label">Efectivo</div>
          <div className="stat-value-row"><strong>{formatMoney(totals.cash)}</strong></div>
          <p>pagos en efectivo</p>
        </article>
        <article className="stat-card money">
          <div className="stat-label">Transferencia</div>
          <div className="stat-value-row"><strong>{formatMoney(totals.transfer)}</strong></div>
          <p>pagos por transferencia</p>
        </article>
      </div>
      {view === 'dia' && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Para producir</h2>
              <p className="muted">Cantidades del mercadito, aparte de las empresas.</p>
            </div>
          </div>
          {kitchen.length === 0 ? (
            <EmptyState title="Nada para producir" description="Cuando haya pedidos activos, acá ves las cantidades por opción." />
          ) : (
            <div className="report-bars">
              {kitchen.map((row) => (
                <div className="report-row" key={`${row.category}|${row.name}`}>
                  <span>{row.category} · {row.name}</span>
                  <strong>{row.quantity}</strong>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      {view === 'dia' && deliveries.length > 0 && (
        <section className="panel market-map-panel">
          <div className="panel-heading">
            <div>
              <h2>Entregas del día</h2>
              <p className="muted">Ubicación de los pedidos activos para armar el recorrido.</p>
            </div>
          </div>
          <MarketDeliveryMap stops={deliveries} />
        </section>
      )}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>{view === 'mes' ? 'Pedidos del mes' : 'Pedidos del día'}</h2>
            <p className="muted">Nombre, teléfono, dirección, ítems, nota, forma de pago y estado. Los cancelados no suman plata ni viandas.</p>
          </div>
        </div>
        {orders.length === 0 ? (
          <EmptyState title={view === 'mes' ? 'Sin pedidos ese mes' : 'Sin pedidos ese día'} description="Cuando alguien pida por el mercadito, aparece acá." />
        ) : view === 'mes' ? (
          days.map((day) => (
            <div className="market-day" key={day.date}>
              <h3>{formatLongDate(day.date)}</h3>
              <MarketOrderList orders={day.orders} />
            </div>
          ))
        ) : (
          <MarketOrderList orders={days[0].orders} />
        )}
      </section>
    </>
  )
}
