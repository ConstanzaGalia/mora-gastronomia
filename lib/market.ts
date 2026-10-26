import { dashboardFocusDate, dashboardFocusLabel, digits, formatLongDate, formatMoney } from '@/lib/format'
import { BALCARCE_SLUG } from '@/lib/space'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Enums } from '@/lib/database.types'

export type MarketPayment = Extract<Enums<'payment_method'>, 'EFECTIVO' | 'TRANSFERENCIA'>
export type MarketOrderStatus = Enums<'market_order_status'>

export const MARKET_STATUS_LABEL: Record<MarketOrderStatus, string> = {
  NUEVO: 'Nuevo',
  LISTO: 'Listo',
  CANCELADO: 'Cancelado',
}

export const MARKET_STATUS_TONE: Record<MarketOrderStatus, string> = {
  NUEVO: 'gold',
  LISTO: 'success',
  CANCELADO: 'muted',
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

export type MarketOption = { id: string; name: string; sort: number }
export type MarketGroup = { id: string; name: string; sort: number; options: MarketOption[] }

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

export function orderWhatsappMessage(order: MarketOrder, settings: MarketSettings) {
  const lines = [
    `Hola Mora, hice un pedido en el mercadito para el ${formatLongDate(order.serviceDate)}.`,
    '',
    `Nombre: ${order.customerName}`,
    `Teléfono: ${order.phone}`,
    `Dirección: ${order.address}`,
    `Pago: ${MARKET_PAYMENT_LABEL[order.paymentMethod]}`,
    '',
    ...order.items.map((item) => `- ${item.quantity} ${item.optionName} (${item.categoryName})`),
    '',
    `Total: ${formatMoney(order.total)}`,
  ]
  if (order.notes) {
    lines.push('', `Nota: ${order.notes}`)
  }
  if (order.paymentMethod === 'TRANSFERENCIA') {
    lines.push('', 'Si pagué con transferencia, adjunto el comprobante.')
    const details = transferLines(settings)
    if (details.length) {
      lines.push('', ...details)
    }
  }
  return lines.join('\n')
}

export async function loadMarketDay(serviceDate = dashboardFocusDate()) {
  const admin = createAdminClient()
  const { data: space } = await admin
    .from('business_spaces')
    .select('id, name')
    .eq('slug', BALCARCE_SLUG)
    .eq('active', true)
    .maybeSingle()
  if (!space) return null

  const [{ data: settingsRow }, { data: day }] = await Promise.all([
    admin.from('market_settings').select('*').eq('business_space_id', space.id).maybeSingle(),
    admin
      .from('calendar_days')
      .select('id, is_service_day, calendar_weeks!inner(status)')
      .eq('business_space_id', space.id)
      .eq('service_date', serviceDate)
      .maybeSingle(),
  ])

  const settings = mapSettings(settingsRow)
  const published = Boolean(day?.is_service_day && asArray(day.calendar_weeks)?.status === 'PUBLISHED')
  const { data: availability } = published && day
    ? await admin
        .from('daily_availability')
        .select('category_id, option_id, sort_order, gastronomic_categories(name, sort_order), gastronomic_options(name, active)')
        .eq('calendar_day_id', day.id)
    : { data: [] as never[] }

  return {
    spaceId: space.id,
    spaceName: space.name,
    serviceDate,
    focusLabel: dashboardFocusLabel(serviceDate),
    published,
    settings,
    groups: published ? marketGroups(availability ?? []) : [],
  }
}

export async function loadMarketOrder(orderId: string) {
  const admin = createAdminClient()
  const { data: order } = await admin
    .from('market_orders')
    .select('id, service_date, customer_name, phone, address, payment_method, status, notes, total, created_at, business_space_id')
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
    settings: mapSettings(settingsRow),
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

function mapSettings(row: {
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

type AvailabilityRow = {
  category_id: string
  option_id: string
  sort_order: number
  gastronomic_categories: { name: string; sort_order: number } | { name: string; sort_order: number }[] | null
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
