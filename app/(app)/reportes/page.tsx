import { CsvButton } from '@/components/csv-button'
import { DinerCalendar } from '@/components/diner-calendar'
import { EmptyState } from '@/components/empty-state'
import { FilterForm } from '@/components/filter-form'
import { PageHeader } from '@/components/page-header'
import { addDays, businessToday, formatDay } from '@/lib/format'
import { extraNote, loadExtras, mergeKitchen } from '@/lib/kitchen'
import { assertRole, requireSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

export default async function ReportesPage({ searchParams }: { searchParams: Promise<{ fecha?: string; empresa?: string }> }) {
  const { fecha, empresa } = await searchParams
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN', 'COMPANY_ADMIN'])
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

  const [{ data: optionRows }, { data: viandaRows }, extras] = await Promise.all([
    options,
    totals,
    loadExtras(supabase, session.spaceId, date, companyId),
  ])
  const sortedOptions = mergeKitchen(optionRows ?? [], extras)
  const groups = groupByCategory(sortedOptions)
  const viandas = [...(viandaRows ?? [])].sort((a, b) => (a.company_name ?? '').localeCompare(b.company_name ?? '', 'es'))
  const viandaTotal = viandas.reduce((sum, row) => sum + (row.total_viandas ?? 0), 0)
  const scoped = Boolean(companyId)

  return (
    <>
      <PageHeader
        eyebrow="REPORTES"
        title={companyName ? companyName : 'Total del día'}
        description={`Producción del ${formatDay(date)}. ${isCompanyAdmin ? 'Tu empresa.' : scoped ? 'Filtrado por empresa.' : 'Suma de todas las empresas.'}`}
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
          <div><h2>{scoped ? 'Total de la empresa' : 'Total'}</h2><p className="muted">{viandaTotal === 1 ? '1 vianda' : `${viandaTotal} viandas`}</p></div>
          <CsvButton
            filename={`opciones-${date}.csv`}
            rows={[['Categoría', 'Opción', 'Cantidad', 'Extras'], ...sortedOptions.map((row) => [row.category_name ?? '', row.option_name ?? '', String(row.total ?? 0), String(row.extras)])]}
          />
        </div>
        {groups.length === 0 ? <EmptyState title="Sin cantidades" description="No hay elecciones enviadas para esa fecha." /> : (
          <table className="report-table">
            <thead><tr><th>Categoría</th><th>Opción</th><th className="num">Cantidad</th></tr></thead>
            <tbody>
              {groups.map((group) => group.rows.map((row, index) => (
                <tr key={`${group.name}-${row.option_name}`}>
                  {index === 0 && <td className="category-cell" rowSpan={group.rows.length}>{group.name}</td>}
                  <td>{row.option_name}{extraNote(row.extras)}</td>
                  <td className="num">{row.total}</td>
                </tr>
              )))}
            </tbody>
          </table>
        )}
      </section>
      {!scoped && <section className="panel">
        <div className="panel-heading">
          <div><h2>Viandas por empresa</h2><p className="muted">Una vianda es una elección enviada, sin importar cuántas categorías tenga.</p></div>
          <CsvButton
            filename={`viandas-${date}.csv`}
            rows={[['Empresa', 'Viandas'], ...viandas.map((row) => [row.company_name ?? '', String(row.total_viandas ?? 0)]), ['Total', String(viandaTotal)]]}
          />
        </div>
        <table className="report-table report-table-narrow">
          <thead><tr><th>Empresa</th><th className="num">Viandas</th></tr></thead>
          <tbody>
            {viandas.map((row) => (
              <tr key={row.company_name}><td>{row.company_name}</td><td className="num">{row.total_viandas}</td></tr>
            ))}
            <tr className="report-total"><td>Total</td><td className="num">{viandaTotal}</td></tr>
          </tbody>
        </table>
      </section>}
    </>
  )
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
