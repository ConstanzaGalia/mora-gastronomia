import { EmployeeImportForm } from '@/components/employee-import'
import { EmptyState } from '@/components/empty-state'
import { FormDialog } from '@/components/form-dialog'
import { PageHeader } from '@/components/page-header'
import { PeopleForm } from '@/components/people-form'
import { PersonActions } from '@/components/person-actions'
import { StatusBadge } from '@/components/status-badge'
import { ROLE_LABEL, formatDay } from '@/lib/format'
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
      .select('id, role, status, started_at, ended_at, sector_id, profiles!memberships_user_id_fkey(id, nombre, apellido, dni)')
      .eq('company_id', session.companyId)
      .order('started_at', { ascending: false }),
    supabase.from('company_sectors').select('id, name, sort_order').eq('company_id', session.companyId).order('sort_order'),
  ])
  const sectors = sectorRows ?? []
  const sectorName = new Map(sectors.map((sector) => [sector.id, sector.name]))

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
              <p className="muted">Si el DNI ya existe, se reutiliza la cuenta. Las elecciones cerradas quedan en la empresa anterior.</p>
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
            <p className="muted">{(members ?? []).length === 1 ? '1 persona.' : `${members?.length ?? 0} personas.`}</p>
          </div>
        </div>
        {(members ?? []).length === 0 ? <EmptyState title="Todavía no hay personas" description="Sumá un empleado con el DNI para vincularlo a tu empresa." /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>PERSONA</th><th>DNI</th><th>SECTOR</th><th>ROL</th><th>DESDE</th><th>HASTA</th><th>ESTADO</th><th /></tr></thead>
            <tbody>
              {(members ?? []).map((member) => {
                const profile = member.profiles
                return (
                <tr key={member.id}>
                  <td>{profile ? `${profile.apellido}, ${profile.nombre}` : '—'}</td>
                  <td>{profile?.dni ?? '—'}</td>
                  <td>{member.role === 'EMPLOYEE' ? (member.sector_id ? sectorName.get(member.sector_id) ?? '—' : 'Sin sector') : '—'}</td>
                  <td>{ROLE_LABEL[member.role]}</td>
                  <td>{formatDay(member.started_at)}</td>
                  <td>{member.ended_at ? formatDay(member.ended_at) : '—'}</td>
                  <td><StatusBadge tone={member.status === 'ACTIVE' ? 'success' : 'muted'}>{member.status === 'ACTIVE' ? 'Vigente' : 'Cerrada'}</StatusBadge></td>
                  <td>
                    {profile && session.companyId && (
                      <PersonActions
                        membershipId={member.id}
                        companyId={session.companyId}
                        profileId={profile.id}
                        nombre={profile.nombre}
                        apellido={profile.apellido}
                        canEnd={member.status === 'ACTIVE' && member.role === 'EMPLOYEE'}
                        canDelete={member.role === 'EMPLOYEE'}
                        next="/empleados"
                        sectors={sectors}
                        sectorId={member.sector_id}
                        showSector={member.role === 'EMPLOYEE' && member.status === 'ACTIVE'}
                      />
                    )}
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        )}
      </section>
    </>
  )
}
