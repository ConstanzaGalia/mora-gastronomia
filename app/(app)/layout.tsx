import type { ReactNode } from 'react'
import { CalendarDays, ClipboardList, ClipboardPlus, FileBarChart, FileText, Home, NotebookText, Scale, ShoppingBag, Store, Users, UtensilsCrossed } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { ROLE_LABEL } from '@/lib/format'
import { isEventosSpace, requireSession } from '@/lib/session'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession()
  const role = session.primary.role
  const nav = role === 'EMPLOYEE'
    ? [{ href: '/mi-menu', label: 'Mi menú', icon: <UtensilsCrossed size={17} /> }]
    : role === 'COMPANY_ADMIN'
      ? [
          { href: '/inicio', label: 'Inicio', icon: <Home size={17} /> },
          { href: '/empleados', label: 'Empleados', icon: <Users size={17} /> },
          { href: '/elecciones', label: 'Elecciones', icon: <ClipboardList size={17} /> },
          { href: '/comensales', label: 'Comensales', icon: <NotebookText size={17} /> },
          { href: '/reportes', label: 'Reportes', icon: <FileBarChart size={17} /> },
        ]
      : isEventosSpace(session)
        ? [
            { href: '/inicio', label: 'Inicio', icon: <Home size={17} /> },
            { href: '/eventos', label: 'Eventos', icon: <CalendarDays size={17} /> },
          ]
        : [
            { href: '/inicio', label: 'Inicio', icon: <Home size={17} /> },
            ...(role === 'ORG_ADMIN' ? [{ href: '/pedidos', label: 'Pedidos', icon: <ShoppingBag size={17} /> }] : []),
            { href: '/calendario', label: 'Calendario', icon: <CalendarDays size={17} /> },
            { href: '/empresas', label: 'Empresas', icon: <Store size={17} /> },
            { href: '/catalogo', label: 'Catálogo gastronómico', icon: <UtensilsCrossed size={17} /> },
            { href: '/documentos', label: 'Documentos', icon: <FileText size={17} /> },
            { href: '/pedidos-empresa', label: 'Pedidos por empresa', icon: <ClipboardPlus size={17} /> },
            { href: '/comensales', label: 'Comensales', icon: <NotebookText size={17} /> },
            { href: '/reportes', label: 'Reportes', icon: <FileBarChart size={17} /> },
            { href: '/balance', label: 'Balance', icon: <Scale size={17} /> },
          ]

  const profileName = session.profile ? `${session.profile.nombre} ${session.profile.apellido}` : 'Usuario'
  const showSpace = role === 'ORG_ADMIN' || role === 'SPACE_ADMIN'

  return (
    <AppShell
      spaceId={session.spaceId}
      spaceName={session.spaceName}
      spaces={session.spaces}
      showSpace={showSpace}
      profileName={profileName}
      roleLabel={ROLE_LABEL[role]}
      nav={nav}
      showGlobalSearch={role === 'ORG_ADMIN' || role === 'SPACE_ADMIN'}
    >
      {children}
    </AppShell>
  )
}
