import Link from 'next/link'
import { EmptyState } from '@/components/empty-state'
import { MarketDeliveryMap } from '@/components/market-delivery-map'
import { MarketDayBadge, MarketDayControl, MarketFilters, MarketOrderList, MarketSettingsButton } from '@/components/market-admin'
import { PageHeader } from '@/components/page-header'
import { currentMonth, dashboardFocusDate, formatLongDate, formatMoney, formatMonth, monthRange } from '@/lib/format'
import {
  asMarketOrder,
  countsForProduction,
  groupMarketOrdersByDay,
  loadMarketOverrides,
  mapMarketSettings,
  marketDayState,
  marketTotals,
  sortMarketOrders,
} from '@/lib/market'
import { assertRole, assertViandasSpace, requireSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

const ORDER_SELECT = 'id, service_date, customer_name, phone, address, payment_method, status, notes, total, paid, after_cutoff, created_at, market_order_items(option_id, category_name, option_name, quantity, unit_price, amount, sort_order)'

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

  const [{ data: settingsRow }, { data: rows }, overrides, { data: dayRow }] = await Promise.all([
    supabase.from('market_settings').select('*').eq('business_space_id', session.spaceId).maybeSingle(),
    ordersQuery,
    loadMarketOverrides(supabase, session.spaceId, view === 'mes' ? range.start : date, view === 'mes' ? range.end : date),
    view === 'dia'
      ? supabase
          .from('calendar_days')
          .select('is_service_day, calendar_weeks!inner(status)')
          .eq('business_space_id', session.spaceId)
          .eq('service_date', date)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const dayState = (day: string) => marketDayState(overrides.get(day))
  const weekRow = Array.isArray(dayRow?.calendar_weeks) ? dayRow?.calendar_weeks[0] : dayRow?.calendar_weeks
  const dayPublished = Boolean(dayRow?.is_service_day && weekRow?.status === 'PUBLISHED')

  const settings = mapMarketSettings(settingsRow)
  const orders = (rows ?? []).flatMap((row) => {
    const order = asMarketOrder(row)
    return order ? [order] : []
  })
  const totals = marketTotals(orders)
  const deliveries = orders
    .filter((order) => countsForProduction(order.status) && order.address.trim())
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
        description={`Reparto y plata del mercadito · ${periodLabel}.`}
        action={
          <div className="header-actions">
            <Link className="outline-button" href="/mercadito" target="_blank">Ver link público</Link>
            <MarketSettingsButton settings={settings} />
          </div>
        }
      />
      <MarketFilters vista={view} date={date} month={month} />
      {view === 'dia' && <MarketDayControl date={date} state={dayState(date)} published={dayPublished} />}
      {error && <p className="error-banner">{error}</p>}
      {!settings.transferAlias && !settings.transferCbu && (
        <p className="warn-banner">Faltan alias o CBU. Cargalos en Datos y transferencia para que quien pague por transferencia vea las instrucciones.</p>
      )}
      <div className="stats-grid balance-stats">
        <article className="stat-card money">
          <div className="stat-label">Confirmados</div>
          <div className="stat-value-row"><strong>{totals.orders}</strong></div>
          <p>{[totals.received ? `${totals.received} sin confirmar` : '', totals.cancelled ? `${totals.cancelled} cancelado${totals.cancelled === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ') || `en producción ${periodHint}`}</p>
        </article>
        <article className="stat-card money">
          <div className="stat-label">Viandas</div>
          <div className="stat-value-row"><strong>{totals.viandas}</strong></div>
          <p>confirmadas {periodHint}. Los recibidos no entran.</p>
        </article>
        <article className="stat-card money">
          <div className="stat-label">Esperado</div>
          <div className="stat-value-row"><strong>{formatMoney(totals.expected)}</strong></div>
          <p>plata de los pedidos confirmados</p>
        </article>
        <article className="stat-card money">
          <div className="stat-label">Cobrado</div>
          <div className="stat-value-row"><strong>{formatMoney(totals.collected)}</strong></div>
          <p>ya ingresó</p>
        </article>
        <article className="stat-card money">
          <div className="stat-label">Por cobrar</div>
          <div className="stat-value-row"><strong>{formatMoney(totals.toCollect)}</strong></div>
          <p>{formatMoney(totals.cashDue)} en efectivo · {formatMoney(totals.transferDue)} por transferencia</p>
        </article>
      </div>
      {view === 'dia' && deliveries.length > 0 && (
        <section className="panel market-map-panel">
          <div className="panel-heading">
            <div>
              <h2>Entregas del día</h2>
              <p className="muted">Recorrido de los pedidos confirmados. Los que siguen recibidos no entran.</p>
            </div>
          </div>
          <MarketDeliveryMap stops={deliveries} />
        </section>
      )}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>{view === 'mes' ? 'Pedidos del mes' : 'Pedidos del día'}</h2>
            <p className="muted">Confirmá para que entre a cocina. El cobro es aparte: efectivo al entregar y transferencia cuando llega el comprobante.</p>
          </div>
          {view === 'dia' && <Link className="text-button" href={`/reportes?fecha=${date}`}>Ver el total del día</Link>}
        </div>
        {orders.length === 0 ? (
          <EmptyState title={view === 'mes' ? 'Sin pedidos ese mes' : 'Sin pedidos ese día'} description="Cuando alguien pida por el mercadito, aparece acá." />
        ) : view === 'mes' ? (
          days.map((day) => (
            <div className="market-day" key={day.date}>
              <h3>{formatLongDate(day.date)} <MarketDayBadge state={dayState(day.date)} /></h3>
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
