import { EmployeeImportForm } from '@/components/employee-import'
import { EmptyState } from '@/components/empty-state'
import { FormDialog } from '@/components/form-dialog'
import { PageHeader } from '@/components/page-header'
import { PeopleForm } from '@/components/people-form'
import { PeopleTable } from '@/components/people-table'
import { assertRole, requireSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'

export default async function EmpleadosPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  const session = await requireSession()
  assertRole(session, ['COMPANY_ADMIN'])
  if (!session.companyId) return <EmptyState title="Sin empresa" description="Tu acceso no está asociado a una empresa." />

  const supabase = await createClient()
  const { data: company } = await supabase.from('companies').select('nombre_comercial').eq('id', session.companyId).maybeSingle()
  const [{ data: members }, { data: sectorRows }] = await Promise.all([
    supabase
      .from('memberships')
      .select('id, role, status, started_at, ended_at, sector_id, profiles!memberships_user_id_fkey(id, nombre, apellido, dni, email)')
      .eq('company_id', session.companyId),
    supabase.from('company_sectors').select('id, name, sort_order').eq('company_id', session.companyId).order('sort_order'),
  ])
  const sectors = sectorRows ?? []
  const sectorName = new Map(sectors.map((sector) => [sector.id, sector.name]))
  const people = (members ?? []).map((member) => {
    const profile = Array.isArray(member.profiles) ? member.profiles[0] ?? null : member.profiles
    return {
      membershipId: member.id,
      profileId: profile?.id ?? null,
      nombre: profile?.nombre ?? '',
      apellido: profile?.apellido ?? '',
      dni: profile?.dni ?? '',
      email: profile?.email ?? '',
      sectorLabel: member.role === 'EMPLOYEE' ? (member.sector_id ? sectorName.get(member.sector_id) ?? '—' : 'Sin sector') : '—',
      role: member.role,
      startedAt: member.started_at,
      endedAt: member.ended_at,
      status: member.status,
      sectorId: member.sector_id,
      showSector: member.role === 'EMPLOYEE' && member.status === 'ACTIVE',
      canEnd: member.status === 'ACTIVE' && member.role === 'EMPLOYEE',
      canDelete: member.role === 'EMPLOYEE',
    }
  })

  return (
    <>
      <PageHeader
        eyebrow="TU EMPRESA"
        title="Empleados"
        description={company?.nombre_comercial ?? 'Personas de tu empresa.'}
        action={
          <div className="header-actions">
            <FormDialog title="Importar empleados" trigger="Importar Excel" triggerClassName="outline-button" wide>
              <EmployeeImportForm companyId={session.companyId} />
            </FormDialog>
            <FormDialog title="Sumar empleado" trigger="Sumar empleado">
              <p className="muted">Si el DNI ya existe, se reutiliza la cuenta. Si está en otra empresa, elegís si queda en las dos o se cierra la otra.</p>
              <PeopleForm companyId={session.companyId} canAssignAdmin={false} sectors={sectors} />
            </FormDialog>
          </div>
        }
      />
      {error && <p className="error-banner">{error}</p>}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Personas</h2>
            <p className="muted">{people.length === 1 ? '1 persona.' : `${people.length} personas.`}</p>
          </div>
        </div>
        {people.length === 0 ? <EmptyState title="Todavía no hay personas" description="Sumá un empleado con el DNI para vincularlo a tu empresa." /> : (
          <PeopleTable people={people} companyId={session.companyId} next="/empleados" sectors={sectors} />
        )}
      </section>
    </>
  )
}
