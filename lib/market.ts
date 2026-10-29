import { addDays, businessToday, digits, formatLongDate, formatMoney } from '@/lib/format'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Enums } from '@/lib/database.types'
import { BALCARCE_SLUG } from '@/lib/space'
import { createAdminClient } from '@/lib/supabase/admin'

export type MarketPayment = Extract<Enums<'payment_method'>, 'EFECTIVO' | 'TRANSFERENCIA'>
export type MarketOrderStatus = Enums<'market_order_status'>

export const MARKET_STATUS_LABEL: Record<MarketOrderStatus, string> = {
  RECIBIDO: 'Recibido',
  CONFIRMADO: 'Confirmado',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
}

export const MARKET_STATUS_TONE: Record<MarketOrderStatus, string> = {
  RECIBIDO: 'gold',
  CONFIRMADO: 'success',
  ENTREGADO: 'success',
  CANCELADO: 'muted',
}

const STATUS_RANK: Record<MarketOrderStatus, number> = {
  RECIBIDO: 0,
  CONFIRMADO: 1,
  ENTREGADO: 2,
  CANCELADO: 3,
}

export const MARKET_PAYMENT_LABEL: Record<MarketPayment, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
}

export type MarketSettings = {
  enabled: boolean
  unitPrice: number | null
  whatsapp: string
  transferHolder: string
  transferAlias: string
  transferCbu: string
  transferBank: string
  deliveryNote: string
}

export const MARKET_TRAY_SLUG = 'bandeja'
export const MARKET_BREAD_SLUG = 'pan'
export const MARKET_OFFER = 'Bandeja + envío gratis'

export type MarketOption = { id: string; name: string; sort: number }
export type MarketGroup = { id: string; name: string; slug: string; sort: number; options: MarketOption[] }

export type MarketItem = {
  optionId: string | null
  categoryName: string
  optionName: string
  quantity: number
  unitPrice: number
  amount: number
}

export type MarketOrder = {
  id: string
  serviceDate: string
  customerName: string
  phone: string
  address: string
  paymentMethod: MarketPayment
  status: MarketOrderStatus
  notes: string
  total: number
  createdAt: string
  paid: boolean
  afterCutoff: boolean
  items: MarketItem[]
}

const DEFAULT_WHATSAPP = '5493813201368'

function asArray<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

export function emptyMarketSettings(): MarketSettings {
  return {
    enabled: true,
    unitPrice: 8000,
    whatsapp: DEFAULT_WHATSAPP,
    transferHolder: '',
    transferAlias: '',
    transferCbu: '',
    transferBank: '',
    deliveryNote: '',
  }
}

export function normalizeWhatsapp(value: string) {
  const number = digits(value)
  if (number.startsWith('54')) return number
  if (number.startsWith('9') && number.length >= 10) return `54${number}`
  if (number.length >= 10) return `549${number.replace(/^0/, '')}`
  return number || DEFAULT_WHATSAPP
}

export function hasTransferDetails(settings: MarketSettings) {
  return Boolean(settings.transferAlias || settings.transferCbu)
}

export function transferLines(settings: MarketSettings) {
  const lines: string[] = []
  if (settings.transferHolder) lines.push(`Titular: ${settings.transferHolder}`)
  if (settings.transferBank) lines.push(`Banco: ${settings.transferBank}`)
  if (settings.transferAlias) lines.push(`Alias: ${settings.transferAlias}`)
  if (settings.transferCbu) lines.push(`CBU/CVU: ${settings.transferCbu}`)
  return lines
}

export function marketWhatsappHref(settings: MarketSettings, message: string) {
  return `https://wa.me/${normalizeWhatsapp(settings.whatsapp)}?text=${encodeURIComponent(message)}`
}

export function customerWhatsappHref(phone: string, message: string) {
  if (digits(phone).length < 8) return ''
  return `https://wa.me/${normalizeWhatsapp(phone)}?text=${encodeURIComponent(message)}`
}

export function orderCustomerWhatsappHref(order: Pick<MarketOrder, 'customerName' | 'phone'>) {
  return customerWhatsappHref(
    order.phone,
    `Hola ${order.customerName}, te escribo de Mora Gastronomía por tu pedido.`,
  )
}

export function deliveryMapsHref(addresses: string[]) {
  const stops = addresses.map((address) => address.trim()).filter(Boolean)
  if (!stops.length) return ''
  return `https://www.google.com/maps/dir/${stops.map(encodeURIComponent).join('/')}`
}

export function isPastMarketCutoff(serviceDate: string, now = new Date()) {
  const deadline = new Date(`${addDays(serviceDate, -1)}T12:00:00-03:00`)
  return now.getTime() >= deadline.getTime()
}

export function marketCutoffLabel(serviceDate: string) {
  return `${formatLongDate(addDays(serviceDate, -1))} a las 12:00`
}

export function countsForProduction(status: MarketOrderStatus) {
  return status === 'CONFIRMADO' || status === 'ENTREGADO'
}

export function marketCollectionLabel(order: Pick<MarketOrder, 'paid' | 'paymentMethod' | 'status'>) {
  if (order.status === 'CANCELADO') return ''
  if (order.paid) return 'Cobrado'
  return order.paymentMethod === 'EFECTIVO' ? 'Cobra al entregar' : 'A cobrar'
}

export function orderWhatsappMessage(order: MarketOrder, settings: MarketSettings) {
  const lines = [
    `Hola Mora, dejé un pedido en el mercadito para el ${formatLongDate(order.serviceDate)}.`,
    'Ya quedó registrado.',
    '',
    `Nombre: ${order.customerName}`,
    `Teléfono: ${order.phone}`,
    `Dirección: ${order.address}`,
    `Pago: ${MARKET_PAYMENT_LABEL[order.paymentMethod]}`,
    '',
    ...billedMarketItems(order.items).map((item) => `- ${item.quantity} ${item.optionName}`),
    '- Envío gratis',
    '',
    `Total: ${formatMoney(order.total)}`,
  ]
  if (order.notes) {
    lines.push('', `Nota: ${order.notes}`)
  }
  if (order.afterCutoff) {
    lines.push('', 'Sé que el horario de ese día ya cerró. Quedo atento si pueden sumarlo.')
  }
  if (order.paymentMethod === 'TRANSFERENCIA') {
    lines.push('', 'Adjunto el comprobante de la transferencia.')
    const details = transferLines(settings)
    if (details.length) {
      lines.push('', ...details)
    }
  }
  return lines.join('\n')
}

export async function loadMarketDay(serviceDate?: string, now = new Date()) {
  const admin = createAdminClient()
  const { data: space } = await admin
    .from('business_spaces')
    .select('id, name')
    .eq('slug', BALCARCE_SLUG)
    .eq('active', true)
    .maybeSingle()
  if (!space) return null

  const { data: settingsRow } = await admin.from('market_settings').select('*').eq('business_space_id', space.id).maybeSingle()
  const settings = mapMarketSettings(settingsRow)
  const date = serviceDate ?? (await nextOpenMarketDate(admin, space.id, now))
  if (!date) {
    return {
      spaceId: space.id,
      spaceName: space.name,
      serviceDate: null,
      published: false,
      settings,
      groups: [] as MarketGroup[],
      cutoffLabel: '',
    }
  }

  const { data: day } = await admin
    .from('calendar_days')
    .select('id, is_service_day, calendar_weeks!inner(status)')
    .eq('business_space_id', space.id)
    .eq('service_date', date)
    .maybeSingle()

  const published = Boolean(day?.is_service_day && asArray(day.calendar_weeks)?.status === 'PUBLISHED')
  const { data: availability } = published && day
    ? await admin
        .from('daily_availability')
        .select('category_id, option_id, sort_order, gastronomic_categories(name, slug, sort_order), gastronomic_options(name, active)')
        .eq('calendar_day_id', day.id)
    : { data: [] as never[] }

  return {
    spaceId: space.id,
    spaceName: space.name,
    serviceDate: date,
    published,
    settings,
    groups: published ? marketGroups(availability ?? []) : [],
    cutoffLabel: marketCutoffLabel(date),
  }
}

async function nextOpenMarketDate(admin: ReturnType<typeof createAdminClient>, spaceId: string, now: Date) {
  const today = businessToday(now)
  const { data: days } = await admin
    .from('calendar_days')
    .select('service_date, is_service_day, calendar_weeks!inner(status)')
    .eq('business_space_id', spaceId)
    .eq('is_service_day', true)
    .gte('service_date', today)
    .lte('service_date', addDays(today, 21))
    .order('service_date', { ascending: true })

  return (
    (days ?? []).find((day) => asArray(day.calendar_weeks)?.status === 'PUBLISHED' && !isPastMarketCutoff(day.service_date, now))
      ?.service_date ?? null
  )
}

export async function loadMarketOrder(orderId: string) {
  const admin = createAdminClient()
  const { data: order } = await admin
    .from('market_orders')
    .select('id, service_date, customer_name, phone, address, payment_method, status, notes, total, paid, after_cutoff, created_at, business_space_id')
    .eq('id', orderId)
    .maybeSingle()
  if (!order || (order.payment_method !== 'EFECTIVO' && order.payment_method !== 'TRANSFERENCIA')) return null

  const [{ data: items }, { data: settingsRow }] = await Promise.all([
    admin
      .from('market_order_items')
      .select('option_id, category_name, option_name, quantity, unit_price, amount, sort_order')
      .eq('order_id', order.id)
      .order('sort_order'),
    admin.from('market_settings').select('*').eq('business_space_id', order.business_space_id).maybeSingle(),
  ])

  return {
    settings: mapMarketSettings(settingsRow),
    order: {
      id: order.id,
      serviceDate: order.service_date,
      customerName: order.customer_name,
      phone: order.phone,
      address: order.address,
      paymentMethod: order.payment_method,
      status: order.status,
      notes: order.notes ?? '',
      total: Number(order.total),
      createdAt: order.created_at,
      paid: order.paid,
      afterCutoff: order.after_cutoff,
      items: (items ?? []).map((item) => ({
        optionId: item.option_id,
        categoryName: item.category_name,
        optionName: item.option_name,
        quantity: item.quantity,
        unitPrice: Number(item.unit_price),
        amount: Number(item.amount),
      })),
    } satisfies MarketOrder,
  }
}

export function mapMarketSettings(row: {
  enabled: boolean
  unit_price: number | null
  whatsapp: string | null
  transfer_holder: string | null
  transfer_alias: string | null
  transfer_cbu: string | null
  transfer_bank: string | null
  delivery_note: string | null
} | null): MarketSettings {
  const defaults = emptyMarketSettings()
  return {
    enabled: row?.enabled ?? defaults.enabled,
    unitPrice: row?.unit_price == null ? defaults.unitPrice : Number(row.unit_price),
    whatsapp: row?.whatsapp?.trim() || defaults.whatsapp,
    transferHolder: row?.transfer_holder?.trim() ?? '',
    transferAlias: row?.transfer_alias?.trim() ?? '',
    transferCbu: row?.transfer_cbu?.trim() ?? '',
    transferBank: row?.transfer_bank?.trim() ?? '',
    deliveryNote: row?.delivery_note?.trim() ?? '',
  }
}

export function asMarketOrder(row: {
  id: string
  service_date: string
  customer_name: string
  phone: string
  address: string
  payment_method: string
  status: MarketOrderStatus
  notes: string | null
  total: number
  paid: boolean
  after_cutoff: boolean
  created_at: string
  market_order_items?: {
    option_id: string | null
    category_name: string
    option_name: string
    quantity: number
    unit_price: number
    amount: number
    sort_order: number
  }[] | null
}): MarketOrder | null {
  if (row.payment_method !== 'EFECTIVO' && row.payment_method !== 'TRANSFERENCIA') return null
  const items = [...(row.market_order_items ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  return {
    id: row.id,
    serviceDate: row.service_date,
    customerName: row.customer_name,
    phone: row.phone,
    address: row.address,
    paymentMethod: row.payment_method,
    status: row.status,
    notes: row.notes ?? '',
    total: Number(row.total),
    createdAt: row.created_at,
    paid: row.paid,
    afterCutoff: row.after_cutoff,
    items: items.map((item) => ({
      optionId: item.option_id,
      categoryName: item.category_name,
      optionName: item.option_name,
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
      amount: Number(item.amount),
    })),
  }
}

export function billedMarketItems(items: MarketItem[]) {
  return items.filter((item) => item.amount > 0)
}

export function marketTotals(orders: MarketOrder[]) {
  const production = orders.filter((order) => countsForProduction(order.status))
  const viandas = production.reduce((sum, order) => sum + billedMarketItems(order.items).reduce((count, item) => count + item.quantity, 0), 0)
  const expected = production.reduce((sum, order) => sum + order.total, 0)
  const collected = production.filter((order) => order.paid).reduce((sum, order) => sum + order.total, 0)
  return {
    received: orders.filter((order) => order.status === 'RECIBIDO').length,
    orders: production.length,
    cancelled: orders.filter((order) => order.status === 'CANCELADO').length,
    viandas,
    expected,
    collected,
    toCollect: expected - collected,
    cashDue: production.filter((order) => !order.paid && order.paymentMethod === 'EFECTIVO').reduce((sum, order) => sum + order.total, 0),
    transferDue: production.filter((order) => !order.paid && order.paymentMethod === 'TRANSFERENCIA').reduce((sum, order) => sum + order.total, 0),
  }
}

export async function loadMarketProduction(supabase: SupabaseClient<Database>, spaceId: string, date: string) {
  const [{ data: orders }, { data: categories }] = await Promise.all([
    supabase
      .from('market_orders')
      .select('status, market_order_items(category_name, option_name, quantity, amount)')
      .eq('business_space_id', spaceId)
      .eq('service_date', date)
      .in('status', ['CONFIRMADO', 'ENTREGADO']),
    supabase.from('gastronomic_categories').select('name, sort_order').eq('business_space_id', spaceId),
  ])

  const sortOf = new Map((categories ?? []).map((row) => [row.name, row.sort_order]))
  const grouped = new Map<string, { category_name: string; option_name: string; quantity: number; category_sort_order: number }>()
  let viandas = 0
  for (const order of orders ?? []) {
    for (const item of order.market_order_items ?? []) {
      if (Number(item.amount) <= 0) continue
      viandas += item.quantity
      const key = `${item.category_name}|${item.option_name}`
      const current = grouped.get(key) ?? {
        category_name: item.category_name,
        option_name: item.option_name,
        quantity: 0,
        category_sort_order: sortOf.get(item.category_name) ?? 999,
      }
      current.quantity += item.quantity
      grouped.set(key, current)
    }
  }
  return { viandas, portions: [...grouped.values()] }
}

export function groupMarketOrdersByDay(orders: MarketOrder[]) {
  const groups = new Map<string, MarketOrder[]>()
  for (const order of orders) {
    const list = groups.get(order.serviceDate) ?? []
    list.push(order)
    groups.set(order.serviceDate, list)
  }
  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, rows]) => ({ date, orders: sortMarketOrders(rows) }))
}

export function sortMarketOrders(orders: MarketOrder[]) {
  return [...orders].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.createdAt.localeCompare(a.createdAt))
}

export function splitMarketMenu(groups: MarketGroup[]) {
  return {
    trays: groups.find((group) => group.slug === MARKET_TRAY_SLUG) ?? null,
    breads: groups.find((group) => group.slug === MARKET_BREAD_SLUG) ?? null,
  }
}

type AvailabilityRow = {
  category_id: string
  option_id: string
  sort_order: number
  gastronomic_categories: { name: string; slug: string; sort_order: number } | { name: string; slug: string; sort_order: number }[] | null
  gastronomic_options: { name: string; active: boolean } | { name: string; active: boolean }[] | null
}

function marketGroups(rows: AvailabilityRow[]): MarketGroup[] {
  const groups = new Map<string, MarketGroup>()
  for (const row of rows) {
    const category = asArray(row.gastronomic_categories)
    const option = asArray(row.gastronomic_options)
    if (!category || !option?.active) continue
    const current = groups.get(row.category_id) ?? {
      id: row.category_id,
      name: category.name,
      slug: category.slug,
      sort: category.sort_order,
      options: [],
    }
    current.options.push({ id: row.option_id, name: option.name, sort: row.sort_order })
    groups.set(row.category_id, current)
  }
  return [...groups.values()]
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'es'))
    .map((group) => ({
      ...group,
      options: group.options.sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'es')),
    }))
}
