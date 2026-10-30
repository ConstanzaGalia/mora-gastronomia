import { CsvButton } from '@/components/csv-button'
import { DinerCalendar } from '@/components/diner-calendar'
import { EmptyState } from '@/components/empty-state'
import { FilterForm } from '@/components/filter-form'
import { PageHeader } from '@/components/page-header'
import { addDays, businessToday, formatDay } from '@/lib/format'
import { loadExtras, mergeKitchen, mergeMarket, portionNote } from '@/lib/kitchen'
import { loadMarketProduction } from '@/lib/market'
import { assertRole, assertViandasSpace, requireSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

export default async function ReportesPage({ searchParams }: { searchParams: Promise<{ fecha?: string; empresa?: string }> }) {
  const { fecha, empresa } = await searchParams
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN', 'COMPANY_ADMIN'])
  if (session.primary.role !== 'COMPANY_ADMIN') assertViandasSpace(session)
  const date = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : addDays(businessToday(), 1)
  const supabase = await createClient()
  const isCompanyAdmin = session.primary.role === 'COMPANY_ADMIN'
  const companies = isCompanyAdmin
    ? []
    : (await supabase
        .from('companies')
        .select('id, nombre_comercial')
        .eq('business_space_id', session.spaceId)
        .eq('active', true)
        .order('nombre_comercial')).data ?? []
  const companyId = isCompanyAdmin
    ? session.companyId
    : companies.find((company) => company.id === empresa)?.id ?? null
  const companyName = isCompanyAdmin
    ? (await supabase.from('companies').select('nombre_comercial').eq('id', companyId ?? '').maybeSingle()).data?.nombre_comercial
    : companies.find((company) => company.id === companyId)?.nombre_comercial

  const options = companyId
    ? supabase.from('v_daily_company_option_totals').select('category_name, option_name, total, company_name, category_sort_order').eq('service_date', date).eq('company_id', companyId)
    : supabase.from('v_daily_option_totals').select('category_name, option_name, total, category_sort_order').eq('service_date', date).eq('business_space_id', session.spaceId)
  const totals = supabase.from('v_daily_company_totals').select('company_name, total_viandas').eq('service_date', date).eq('business_space_id', session.spaceId)
  if (companyId) totals.eq('company_id', companyId)

  const [{ data: optionRows }, { data: viandaRows }, extras, market] = await Promise.all([
    options,
    totals,
    loadExtras(supabase, session.spaceId, date, companyId),
    isCompanyAdmin || companyId ? Promise.resolve({ viandas: 0, portions: [] }) : loadMarketProduction(supabase, session.spaceId, date),
  ])
  const scoped = Boolean(companyId)
  const sortedOptions = mergeMarket(mergeKitchen(optionRows ?? [], extras), scoped ? [] : market.portions)
  const groups = groupByCategory(sortedOptions)
  const categoryTotals = sumKnownCategories(sortedOptions)
  const viandas = [...(viandaRows ?? [])].sort((a, b) => (a.company_name ?? '').localeCompare(b.company_name ?? '', 'es'))
  const companyViandas = viandas.reduce((sum, row) => sum + (row.total_viandas ?? 0), 0)
  const viandaTotal = companyViandas + (scoped ? 0 : market.viandas)
  const summary = [
    ...categoryTotals.map((row) => (row.total === 1 ? `1 ${row.one}` : `${row.total} ${row.many}`)),
    viandaTotal === 1 ? '1 vianda' : `${viandaTotal} viandas`,
    !scoped && market.viandas > 0 ? `${market.viandas} del mercadito` : '',
  ].filter(Boolean)
  const optionCsv = scoped
    ? [
        ['Categoría', 'Opción', 'Cantidad', 'Extras'],
        ...sortedOptions.map((row) => [row.category_name ?? '', row.option_name ?? '', String(row.total ?? 0), String(row.extras)]),
        ...categoryTotals.map((row) => ['', row.csv, String(row.total), '']),
      ]
    : [
        ['Categoría', 'Opción', 'Cantidad', 'Extras', 'Mercadito'],
        ...sortedOptions.map((row) => [row.category_name ?? '', row.option_name ?? '', String(row.total ?? 0), String(row.extras), String(row.market)]),
        ...categoryTotals.map((row) => ['', row.csv, String(row.total), '', '']),
      ]

  return (
    <>
      <PageHeader
        eyebrow="REPORTES"
        title={companyName ? companyName : 'Total del día'}
        description={`Producción del ${formatDay(date)}. ${isCompanyAdmin ? 'Tu empresa.' : scoped ? 'Filtrado por empresa.' : 'Empresas, extras y mercadito confirmado.'}`}
      />
      <div className="report-filters">
        <DinerCalendar date={date} empresa={isCompanyAdmin ? undefined : companyId ?? undefined} path="/reportes" />
        {!isCompanyAdmin && (
          <FilterForm className="form-row">
            <input type="hidden" name="fecha" value={date} />
            <label className="field">
              Empresa
              <select name="empresa" defaultValue={companyId ?? ''}>
                <option value="">Todas</option>
                {companies.map((company) => <option key={company.id} value={company.id}>{company.nombre_comercial}</option>)}
              </select>
            </label>
          </FilterForm>
        )}
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>{scoped ? 'Total de la empresa' : 'Total'}</h2>
            <p className="muted">{summary.join(' · ')}</p>
          </div>
          <CsvButton filename={`opciones-${date}.csv`} rows={optionCsv} />
        </div>
        {groups.length === 0 ? <EmptyState title="Sin cantidades" description={scoped ? 'No hay elecciones enviadas para esa fecha.' : 'No hay elecciones ni pedidos confirmados del mercadito para esa fecha.'} /> : (
          <table className="report-table">
            <thead><tr><th>Categoría</th><th>Opción</th><th className="num">Cantidad</th></tr></thead>
            <tbody>
              {groups.map((group) => group.rows.map((row, index) => (
                <tr key={`${group.name}-${row.option_name}`}>
                  {index === 0 && <td className="category-cell" rowSpan={group.rows.length}>{group.name}</td>}
                  <td>{row.option_name}{portionNote(row.extras, scoped ? 0 : row.market)}</td>
                  <td className="num">{row.total}</td>
                </tr>
              )))}
            </tbody>
            {categoryTotals.length > 0 && (
              <tfoot>
                {categoryTotals.map((row) => (
                  <tr className="report-total" key={row.key}>
                    <td colSpan={2}>{row.csv}</td>
                    <td className="num">{row.total}</td>
                  </tr>
                ))}
              </tfoot>
            )}
          </table>
        )}
      </section>
      {!scoped && <section className="panel">
        <div className="panel-heading">
          <div><h2>Viandas por empresa</h2><p className="muted">Una vianda de empresa es una elección enviada. Mercadito suma las bandejas confirmadas.</p></div>
          <CsvButton
            filename={`viandas-${date}.csv`}
            rows={[['Empresa', 'Viandas'], ...viandas.map((row) => [row.company_name ?? '', String(row.total_viandas ?? 0)]), ['Mercadito', String(market.viandas)], ['Total', String(viandaTotal)]]}
          />
        </div>
        <table className="report-table report-table-narrow">
          <thead><tr><th>Empresa</th><th className="num">Viandas</th></tr></thead>
          <tbody>
            {viandas.map((row) => (
              <tr key={row.company_name}><td>{row.company_name}</td><td className="num">{row.total_viandas}</td></tr>
            ))}
            <tr><td>Mercadito</td><td className="num">{market.viandas}</td></tr>
            <tr className="report-total"><td>Total</td><td className="num">{viandaTotal}</td></tr>
          </tbody>
        </table>
      </section>}
    </>
  )
}

const KNOWN_CATEGORIES = ['bandeja', 'postre', 'pan', 'bebida'] as const

const CATEGORY_TOTAL_COPY: Record<(typeof KNOWN_CATEGORIES)[number], { one: string; many: string; csv: string }> = {
  bandeja: { one: 'bandeja', many: 'bandejas', csv: 'Total bandejas' },
  postre: { one: 'postre', many: 'postres', csv: 'Total postres' },
  pan: { one: 'pan', many: 'panes', csv: 'Total panes' },
  bebida: { one: 'bebida', many: 'bebidas', csv: 'Total bebidas' },
}

function foldCategory(name: string | null) {
  return (name ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

function knownCategoryKey(name: string | null) {
  const folded = foldCategory(name)
  return KNOWN_CATEGORIES.find((key) => folded === key || folded === CATEGORY_TOTAL_COPY[key].many) ?? null
}

function sumKnownCategories(rows: { category_name: string | null; total: number | null }[]) {
  const sums = new Map<(typeof KNOWN_CATEGORIES)[number], number>()
  for (const row of rows) {
    const key = knownCategoryKey(row.category_name)
    if (!key) continue
    sums.set(key, (sums.get(key) ?? 0) + Number(row.total ?? 0))
  }
  return KNOWN_CATEGORIES.flatMap((key) => {
    const total = sums.get(key) ?? 0
    if (total <= 0) return []
    return [{ key, total, ...CATEGORY_TOTAL_COPY[key] }]
  })
}

function groupByCategory<T extends { category_name: string | null }>(rows: T[]) {
  const groups: { name: string; rows: T[] }[] = []
  for (const row of rows) {
    const name = row.category_name ?? ''
    const current = groups.at(-1)
    if (current?.name === name) current.rows.push(row)
    else groups.push({ name, rows: [row] })
  }
  return groups
}
