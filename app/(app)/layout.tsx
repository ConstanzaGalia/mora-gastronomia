import type { ReactNode } from 'react'
import { CalendarDays, ClipboardList, ClipboardPlus, FileBarChart, FileText, Home, NotebookText, Scale, ShoppingBag, Store, Users, UtensilsCrossed } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { ACCESS_VIEW_LABEL, ACCESS_VIEW_PATH, ROLE_LABEL, type AccessView } from '@/lib/format'
import { isEventosSpace, requireSession } from '@/lib/session'

const VIEW_ICON: Record<AccessView, ReactNode> = {
  inicio: <Home size={17} />,
  comensales: <NotebookText size={17} />,
  reportes: <FileBarChart size={17} />,
  pedidos_empresa: <ClipboardPlus size={17} />,
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession()
  const role = session.primary.role
  const nav = role === 'EMPLOYEE'
    ? [{ href: '/mi-menu', label: 'Mi menú', icon: <UtensilsCrossed size={17} /> }]
    : role === 'COMPANY_ADMIN'
      ? [
          { href: '/inicio', label: 'Inicio', icon: <Home size={17} /> },
          { href: '/mi-menu', label: 'Mi menú', icon: <UtensilsCrossed size={17} /> },
          { href: '/empleados', label: 'Empleados', icon: <Users size={17} /> },
          { href: '/elecciones', label: 'Elecciones', icon: <ClipboardList size={17} /> },
          { href: '/comensales', label: 'Comensales', icon: <NotebookText size={17} /> },
          { href: '/reportes', label: 'Reportes', icon: <FileBarChart size={17} /> },
        ]
      : role === 'KITCHEN'
        ? [
            { href: '/inicio', label: 'Inicio', icon: <Home size={17} /> },
            { href: '/pedidos', label: 'Pedidos', icon: <ShoppingBag size={17} /> },
            { href: '/reportes', label: 'Reportes', icon: <FileBarChart size={17} /> },
          ]
      : role === 'SCOPED'
        ? session.accessViews.map((view) => ({
            href: ACCESS_VIEW_PATH[view],
            label: ACCESS_VIEW_LABEL[view],
            icon: VIEW_ICON[view],
          }))
      : isEventosSpace(session)
        ? [
            { href: '/inicio', label: 'Inicio', icon: <Home size={17} /> },
            { href: '/eventos', label: 'Eventos', icon: <CalendarDays size={17} /> },
            ...(role === 'ORG_ADMIN' ? [{ href: '/equipo', label: 'Equipo', icon: <Users size={17} /> }] : []),
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
            ...(role === 'ORG_ADMIN' ? [{ href: '/equipo', label: 'Equipo', icon: <Users size={17} /> }] : []),
          ]

  const profileName = session.profile ? `${session.profile.nombre} ${session.profile.apellido}` : 'Usuario'
  const showSpace = role === 'ORG_ADMIN' || role === 'SPACE_ADMIN'
  const roleLabel = role === 'SCOPED' && session.accessRoleName
    ? session.accessRoleName
    : ROLE_LABEL[role]

  return (
    <AppShell
      spaceId={session.spaceId}
      spaceName={session.spaceName}
      spaces={session.spaces}
      showSpace={showSpace}
      profileName={profileName}
      roleLabel={roleLabel}
      nav={nav}
      showGlobalSearch={role === 'ORG_ADMIN' || role === 'SPACE_ADMIN'}
    >
      {children}
    </AppShell>
  )
}
