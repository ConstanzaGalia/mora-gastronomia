import Link from 'next/link'
import { NewCompanyButton } from '@/components/company-form'
import { DeleteButton } from '@/components/delete-button'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { deleteCompany } from '@/lib/actions/companies'
import { initials } from '@/lib/format'
import { assertRole, assertViandasSpace, requireSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

const tones = ['sage', 'blue', 'gold']

export default async function EmpresasPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  assertViandasSpace(session)
  const supabase = await createClient()
  const { data: companies } = await supabase
    .from('companies')
    .select('id, nombre_comercial, razon_social, cuit, active')
    .eq('business_space_id', session.spaceId)
    .order('nombre_comercial')

  const [{ data: employeeRows }, { data: managerRows }] = await Promise.all([
    supabase
      .from('memberships')
      .select('company_id')
      .eq('business_space_id', session.spaceId)
      .eq('role', 'EMPLOYEE')
      .eq('status', 'ACTIVE')
      .limit(10000),
    supabase
      .from('memberships')
      .select('company_id')
      .eq('business_space_id', session.spaceId)
      .eq('role', 'COMPANY_ADMIN')
      .eq('status', 'ACTIVE')
      .limit(1000),
  ])

  const people = new Map<string, number>()
  const managers = new Map<string, number>()
  for (const row of employeeRows ?? []) {
    if (!row.company_id) continue
    people.set(row.company_id, (people.get(row.company_id) ?? 0) + 1)
  }
  for (const row of managerRows ?? []) {
    if (!row.company_id) continue
    managers.set(row.company_id, (managers.get(row.company_id) ?? 0) + 1)
  }

  return (
    <>
      <PageHeader
        eyebrow="GESTIÓN DE CLIENTES"
        title="Empresas"
        description={`Empresas de ${session.spaceName}. El catálogo es del espacio; acá se habilitan las categorías.`}
        action={<NewCompanyButton />}
      />
      {error && <p className="error-banner">{error}</p>}
      <section className="panel companies-panel">
        <div className="panel-heading"><div><h2>Empresas</h2><p className="muted">{companies?.length ?? 0} cargadas.</p></div></div>
        {(companies ?? []).length === 0 ? <EmptyState title="Todavía no hay empresas" description="Creá la primera para poder sumar empleados." /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>EMPRESA</th><th>RAZÓN SOCIAL</th><th>CUIT</th><th>EMPLEADOS</th><th>ENCARGADO</th><th>ESTADO</th><th /></tr></thead>
              <tbody>
                {companies?.map((company, index) => (
                  <tr key={company.id}>
                    <td>
                      <Link href={`/empresas/${company.id}`} className="company-cell">
                        <div className={`company-logo ${tones[index % tones.length]}`}>{initials(company.nombre_comercial)}</div>
                        <strong>{company.nombre_comercial}</strong>
                      </Link>
                    </td>
                    <td>{company.razon_social ?? '—'}</td>
                    <td>{company.cuit ?? '—'}</td>
                    <td>{people.get(company.id) ?? 0}</td>
                    <td>{managers.get(company.id) ?? 0}</td>
                    <td><StatusBadge tone={company.active ? 'success' : 'muted'}>{company.active ? 'Activa' : 'Inactiva'}</StatusBadge></td>
                    <td><DeleteButton action={deleteCompany} name={company.nombre_comercial} fields={{ id: company.id, from: '/empresas' }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
