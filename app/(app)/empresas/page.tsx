import { CompaniesTable } from '@/components/companies-table'
import { NewCompanyButton } from '@/components/company-form'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { assertRole, assertViandasSpace, requireSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

const tones = ['sage', 'blue', 'gold'] as const

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

  const [{ data: employeeRows }, { data: managerRows }, { data: categoryRows }, { data: enabledRows }] = await Promise.all([
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
    supabase
      .from('gastronomic_categories')
      .select('id, name, sort_order')
      .eq('business_space_id', session.spaceId)
      .order('sort_order'),
    supabase
      .from('company_gastronomic_categories')
      .select('company_id, category_id')
      .eq('business_space_id', session.spaceId)
      .eq('active', true),
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
  const categoryName = new Map((categoryRows ?? []).map((row) => [row.id, { name: row.name, sort: row.sort_order }]))
  const categoriesByCompany = new Map<string, { name: string; sort: number }[]>()
  for (const row of enabledRows ?? []) {
    const category = categoryName.get(row.category_id)
    if (!category) continue
    const current = categoriesByCompany.get(row.company_id) ?? []
    current.push(category)
    categoriesByCompany.set(row.company_id, current)
  }

  const rows = (companies ?? []).map((company, index) => ({
    ...company,
    employees: people.get(company.id) ?? 0,
    managers: managers.get(company.id) ?? 0,
    categories: (categoriesByCompany.get(company.id) ?? [])
      .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'es'))
      .map((row) => row.name),
    tone: tones[index % tones.length],
  }))

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
        {rows.length === 0 ? (
          <EmptyState title="Todavía no hay empresas" description="Creá la primera para poder sumar empleados." />
        ) : (
          <CompaniesTable companies={rows} />
        )}
      </section>
    </>
  )
}
