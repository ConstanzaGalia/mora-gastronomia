import Link from 'next/link'
import { CsvButton } from '@/components/csv-button'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { ViandaPeriodFilters, type ViandaPeriodVista } from '@/components/vianda-period-filters'
import {
  addDays,
  businessToday,
  currentMonth,
  formatDay,
  formatLongDate,
  formatMonth,
  mondayOf,
  monthRange,
} from '@/lib/format'
import { loadMarketViandasByDate } from '@/lib/market'
import { assertRole, assertViandasSpace, requireSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

export default async function TotalesViandasPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; fecha?: string; mes?: string; empresa?: string }>
}) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  assertViandasSpace(session)

  const { vista: rawVista, fecha, mes, empresa } = await searchParams
  const vista: ViandaPeriodVista = rawVista === 'semana' || rawVista === 'mes' ? rawVista : 'dia'
  const date = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : addDays(businessToday(), 1)
  const month = mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : currentMonth(date)
  const { start, end, label } = periodBounds(vista, date, month)

  const supabase = await createClient()
  const companies = (await supabase
    .from('companies')
    .select('id, nombre_comercial')
    .eq('business_space_id', session.spaceId)
    .eq('active', true)
    .order('nombre_comercial')).data ?? []
  const companyId = companies.find((company) => company.id === empresa)?.id ?? null
  const companyName = companies.find((company) => company.id === companyId)?.nombre_comercial
  const scoped = Boolean(companyId)

  let totalsQuery = supabase
    .from('v_daily_company_totals')
    .select('company_id, company_name, service_date, total_viandas')
    .eq('business_space_id', session.spaceId)
    .gte('service_date', start)
    .lte('service_date', end)
    .limit(10000)
  if (companyId) totalsQuery = totalsQuery.eq('company_id', companyId)

  const [{ data: rows }, market] = await Promise.all([
    totalsQuery,
    scoped
      ? Promise.resolve({ total: 0, byDate: new Map<string, number>() })
      : loadMarketViandasByDate(supabase, session.spaceId, start, end),
  ])

  const byCompany = new Map<string, { name: string; total: number }>()
  const byDay = new Map<string, number>()
  for (const row of rows ?? []) {
    const companyKey = row.company_id ?? row.company_name ?? ''
    const name = row.company_name ?? 'Sin nombre'
    const amount = row.total_viandas ?? 0
    const current = byCompany.get(companyKey) ?? { name, total: 0 }
    current.total += amount
    byCompany.set(companyKey, current)
    if (row.service_date) byDay.set(row.service_date, (byDay.get(row.service_date) ?? 0) + amount)
  }

  const companiesTotals = [...byCompany.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const companyTotal = companiesTotals.reduce((sum, row) => sum + row.total, 0)
  const grandTotal = companyTotal + market.total

  const dayRows = datesInRange(start, end).map((day) => {
    const companiesDay = byDay.get(day) ?? 0
    const marketDay = scoped ? 0 : (market.byDate.get(day) ?? 0)
    return { date: day, companies: companiesDay, market: marketDay, total: companiesDay + marketDay }
  }).filter((row) => vista === 'dia' || row.total > 0)

  const companyCsv = [
    ['Empresa', 'Viandas'],
    ...companiesTotals.map((row) => [row.name, String(row.total)]),
    ...(!scoped ? [['Mercadito', String(market.total)]] : []),
    ['Total', String(grandTotal)],
  ]
  const dayCsv = [
    ['Fecha', 'Empresas', ...(!scoped ? ['Mercadito'] : []), 'Total'],
    ...dayRows.map((row) => [
      row.date,
      String(row.companies),
      ...(!scoped ? [String(row.market)] : []),
      String(row.total),
    ]),
  ]

  return (
    <>
      <PageHeader
        eyebrow="REPORTES"
        title={companyName ? `Totales · ${companyName}` : 'Totales de viandas'}
        description={`${label}. Una vianda de empresa es una elección enviada.${scoped ? '' : ' Mercadito suma las bandejas confirmadas o entregadas.'}`}
        action={(
          <Link className="outline-button" href={`/reportes?fecha=${date}${companyId ? `&empresa=${companyId}` : ''}`}>
            Producción del día
          </Link>
        )}
      />
      <ViandaPeriodFilters
        vista={vista}
        date={date}
        month={month}
        empresa={companyId ?? ''}
        companies={companies}
      />
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>{scoped ? 'Total de la empresa' : 'Viandas por empresa'}</h2>
            <p className="muted">
              {grandTotal === 1 ? '1 vianda' : `${grandTotal} viandas`}
              {!scoped && market.total > 0 ? ` · ${market.total} del mercadito` : ''}
            </p>
          </div>
          <CsvButton filename={`viandas-${vista}-${start}${start !== end ? `-${end}` : ''}.csv`} rows={companyCsv} />
        </div>
        {companiesTotals.length === 0 && market.total === 0 ? (
          <EmptyState title="Sin viandas" description="No hay elecciones enviadas ni pedidos de mercadito en ese período." />
        ) : (
          <table className="report-table report-table-narrow">
            <thead><tr><th>Empresa</th><th className="num">Viandas</th></tr></thead>
            <tbody>
              {companiesTotals.map((row) => (
                <tr key={row.name}><td>{row.name}</td><td className="num">{row.total}</td></tr>
              ))}
              {!scoped && (
                <tr><td>Mercadito</td><td className="num">{market.total}</td></tr>
              )}
              <tr className="report-total"><td>Total</td><td className="num">{grandTotal}</td></tr>
            </tbody>
          </table>
        )}
      </section>
      {vista !== 'dia' && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Por día</h2>
              <p className="muted">Desglose del período.</p>
            </div>
            <CsvButton filename={`viandas-por-dia-${start}-${end}.csv`} rows={dayCsv} />
          </div>
          {dayRows.length === 0 ? (
            <p className="muted ledger-empty">Sin movimientos en esos días.</p>
          ) : (
            <table className="report-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th className="num">Empresas</th>
                  {!scoped && <th className="num">Mercadito</th>}
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {dayRows.map((row) => (
                  <tr key={row.date}>
                    <td>
                      <Link href={`/reportes?fecha=${row.date}${companyId ? `&empresa=${companyId}` : ''}`}>
                        {formatDay(row.date)}
                      </Link>
                    </td>
                    <td className="num">{row.companies}</td>
                    {!scoped && <td className="num">{row.market}</td>}
                    <td className="num">{row.total}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="report-total">
                  <td>Total</td>
                  <td className="num">{companyTotal}</td>
                  {!scoped && <td className="num">{market.total}</td>}
                  <td className="num">{grandTotal}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </section>
      )}
    </>
  )
}

function periodBounds(vista: ViandaPeriodVista, date: string, month: string) {
  if (vista === 'mes') {
    const range = monthRange(month)
    return { start: range.start, end: range.end, label: formatMonth(month) }
  }
  if (vista === 'semana') {
    const start = mondayOf(date)
    const end = addDays(start, 6)
    return {
      start,
      end,
      label: `Semana del ${formatLongDate(start)} al ${formatDay(end)}`,
    }
  }
  return { start: date, end: date, label: formatLongDate(date) }
}

function datesInRange(start: string, end: string) {
  const days: string[] = []
  let cursor = start
  while (cursor <= end) {
    days.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return days
}
