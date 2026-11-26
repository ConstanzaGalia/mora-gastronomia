import { notFound } from 'next/navigation'
import { CsvButton } from '@/components/csv-button'
import { EmptyState } from '@/components/empty-state'
import { FilterForm } from '@/components/filter-form'
import { PageHeader } from '@/components/page-header'
import { TrayDaysPopup } from '@/components/tray-month-calendar'
import { canPickCompany } from '@/lib/access'
import {
  currentMonth,
  formatMonth,
  shiftMonth,
} from '@/lib/format'
import {
  loadMonthlyTrays,
  monthlyTraysCsv,
} from '@/lib/monthly-trays'
import { assertRole, assertViandasSpace, requireSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

export default async function ViandasPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; empresa?: string }>
}) {
  const { mes, empresa } = await searchParams
  const session = await requireSession()
  assertRole(session, ['COMPANY_ADMIN', 'ORG_ADMIN', 'SPACE_ADMIN'])
  if (session.primary.role !== 'COMPANY_ADMIN') assertViandasSpace(session)

  const month = mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : currentMonth()
  const supabase = await createClient()
  const isCompanyAdmin = session.primary.role === 'COMPANY_ADMIN'
  const showCompanyFilter = canPickCompany(session)

  const companies = isCompanyAdmin
    ? []
    : ((await supabase
        .from('companies')
        .select('id, nombre_comercial')
        .eq('business_space_id', session.spaceId)
        .eq('active', true)
        .order('nombre_comercial')).data ?? [])

  const companyId = isCompanyAdmin
    ? session.companyId
    : companies.find((company) => company.id === empresa)?.id ?? companies[0]?.id ?? null

  if (!companyId) {
    return (
      <>
        <PageHeader eyebrow="VIANDAS" title="Informe mensual" description="Elegí una empresa para ver las viandas del mes." />
        <EmptyState title="No hay empresas activas" description="Cuando haya una empresa en el espacio, el informe aparece acá." />
      </>
    )
  }

  if (!isCompanyAdmin && !companies.some((company) => company.id === companyId)) notFound()

  const report = await loadMonthlyTrays(supabase, session.spaceId, companyId, month)
  const prev = shiftMonth(month, -1)
  const next = shiftMonth(month, 1)
  const csvRows = monthlyTraysCsv(report)
  const summary = [
    report.total === 1 ? '1 vianda' : `${report.total} viandas`,
    report.mealShiftsEnabled && report.morningTotal
      ? (report.morningTotal === 1 ? '1 a la mañana' : `${report.morningTotal} a la mañana`)
      : '',
    report.mealShiftsEnabled && report.afternoonTotal
      ? (report.afternoonTotal === 1 ? '1 a la tarde' : `${report.afternoonTotal} a la tarde`)
      : '',
  ].filter(Boolean).join(' · ')

  return (
    <>
      <PageHeader
        eyebrow="VIANDAS"
        title={report.companyName}
        description={`Viandas pedidas en ${formatMonth(month)}. Solo cuentan las bandejas elegidas por cada persona.`}
        action={<CsvButton filename={`viandas-${slugFile(report.companyName)}-${month}.csv`} rows={csvRows} />}
      />
      <FilterForm className="form-row">
        {showCompanyFilter && (
          <label className="field">
            Empresa
            <select name="empresa" defaultValue={companyId}>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>{company.nombre_comercial}</option>
              ))}
            </select>
          </label>
        )}
        {!showCompanyFilter && !isCompanyAdmin && <input type="hidden" name="empresa" value={companyId} />}
        <label className="field">
          Mes
          <input type="month" name="mes" defaultValue={month} />
        </label>
      </FilterForm>
      <div className="form-row">
        <a className="outline-button" href={monthHref(prev, showCompanyFilter ? companyId : undefined)}>Mes anterior</a>
        <a className="outline-button" href={monthHref(next, showCompanyFilter ? companyId : undefined)}>Mes siguiente</a>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>{formatMonth(month)}</h2>
            <p className="muted">{summary || 'Sin viandas en este mes.'}</p>
          </div>
        </div>
        {report.employees.length === 0 ? (
          <EmptyState
            title="Sin viandas"
            description="Cuando alguien elija bandeja ese mes, aparece acá."
          />
        ) : (
          <div className="table-wrap">
            <table className="viandas-table">
              <thead>
                <tr>
                  <th>EMPLEADO</th>
                  <th>DNI</th>
                  <th>SECTOR</th>
                  <th className="num">VIANDAS</th>
                  {report.mealShiftsEnabled ? <th className="num">MAÑANA</th> : null}
                  {report.mealShiftsEnabled ? <th className="num">TARDE</th> : null}
                  <th>DÍAS</th>
                </tr>
              </thead>
              <tbody>
                {report.employees.map((employee) => (
                  <tr key={employee.id}>
                    <td>{employeeLabel(employee)}</td>
                    <td>{employee.dni}</td>
                    <td>{employee.sector}</td>
                    <td className="num">{employee.total}</td>
                    {report.mealShiftsEnabled ? <td className="num">{employee.morning || '—'}</td> : null}
                    {report.mealShiftsEnabled ? <td className="num">{employee.afternoon || '—'}</td> : null}
                    <td>
                      <TrayDaysPopup
                        month={month}
                        days={employee.days}
                        personName={employeeLabel(employee)}
                        showShifts={report.mealShiftsEnabled}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="report-total">
                  <td colSpan={3}>Total</td>
                  <td className="num">{report.total}</td>
                  {report.mealShiftsEnabled ? <td className="num">{report.morningTotal}</td> : null}
                  {report.mealShiftsEnabled ? <td className="num">{report.afternoonTotal}</td> : null}
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

function employeeLabel(employee: { apellido: string; nombre: string }) {
  return `${employee.apellido}, ${employee.nombre}`.replace(/^,\s*|\s*,\s*$/g, '').trim() || 'Sin nombre'
}

function monthHref(month: string, companyId?: string) {
  const params = new URLSearchParams({ mes: month })
  if (companyId) params.set('empresa', companyId)
  return `/viandas?${params.toString()}`
}

function slugFile(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'empresa'
}
