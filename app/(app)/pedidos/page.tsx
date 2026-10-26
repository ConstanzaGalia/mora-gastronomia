import Link from 'next/link'
import { EmptyState } from '@/components/empty-state'
import { FilterForm } from '@/components/filter-form'
import { MarketOrderList, MarketSettingsButton } from '@/components/market-admin'
import { PageHeader } from '@/components/page-header'
import { dashboardFocusDate, formatLongDate } from '@/lib/format'
import { emptyMarketSettings, type MarketOrder, type MarketPayment } from '@/lib/market'
import { assertRole, assertViandasSpace, requireSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

export default async function PedidosPage({ searchParams }: { searchParams: Promise<{ fecha?: string; error?: string }> }) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  assertViandasSpace(session)
  const { fecha, error } = await searchParams
  const date = /^\d{4}-\d{2}-\d{2}$/.test(fecha ?? '') ? fecha! : dashboardFocusDate()
  const supabase = await createClient()

  const [{ data: settingsRow }, { data: rows }] = await Promise.all([
    supabase.from('market_settings').select('*').eq('business_space_id', session.spaceId).maybeSingle(),
    supabase
      .from('market_orders')
      .select('id, service_date, customer_name, phone, address, payment_method, status, notes, total, created_at, market_order_items(option_id, category_name, option_name, quantity, unit_price, amount, sort_order)')
      .eq('business_space_id', session.spaceId)
      .eq('service_date', date)
      .order('created_at', { ascending: false }),
  ])

  const settings = settingsRow
    ? {
        enabled: settingsRow.enabled,
        unitPrice: settingsRow.unit_price == null ? null : Number(settingsRow.unit_price),
        whatsapp: settingsRow.whatsapp ?? '',
        transferHolder: settingsRow.transfer_holder ?? '',
        transferAlias: settingsRow.transfer_alias ?? '',
        transferCbu: settingsRow.transfer_cbu ?? '',
        transferBank: settingsRow.transfer_bank ?? '',
        deliveryNote: settingsRow.delivery_note ?? '',
      }
    : emptyMarketSettings()

  const orders: MarketOrder[] = (rows ?? []).flatMap((row) => {
    if (row.payment_method !== 'EFECTIVO' && row.payment_method !== 'TRANSFERENCIA') return []
    const items = [...(row.market_order_items ?? [])].sort((a, b) => a.sort_order - b.sort_order)
    return [{
      id: row.id,
      serviceDate: row.service_date,
      customerName: row.customer_name,
      phone: row.phone,
      address: row.address,
      paymentMethod: row.payment_method as MarketPayment,
      status: row.status,
      notes: row.notes ?? '',
      total: Number(row.total),
      createdAt: row.created_at,
      items: items.map((item) => ({
        optionId: item.option_id,
        categoryName: item.category_name,
        optionName: item.option_name,
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        amount: Number(item.amount),
      })),
    }]
  })

  return (
    <>
      <PageHeader
        eyebrow="MERCADITO"
        title="Pedidos"
        description={`Pedidos del ${formatLongDate(date)}. El público pide en /mercadito con el menú publicado del día.`}
        action={
          <div className="topbar-actions">
            <Link className="outline-button" href="/mercadito" target="_blank">Ver link público</Link>
            <MarketSettingsButton settings={settings} />
          </div>
        }
      />
      <FilterForm className="form-row">
        <label className="field">Fecha<input type="date" name="fecha" defaultValue={date} /></label>
      </FilterForm>
      {error && <p className="error-banner">{error}</p>}
      {!settings.transferAlias && !settings.transferCbu && (
        <p className="warn-banner">Faltan alias o CBU. Cargalos en Datos y transferencia para que quien pague por transferencia vea las instrucciones.</p>
      )}
      {orders.length === 0 ? (
        <EmptyState title="Sin pedidos ese día" description="Cuando alguien pida por el mercadito, aparece acá." />
      ) : (
        <section className="panel">
          <MarketOrderList orders={orders} />
        </section>
      )}
    </>
  )
}
