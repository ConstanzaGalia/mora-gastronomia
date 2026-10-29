'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, UtensilsCrossed, X } from 'lucide-react'
import { GlobalSearch, type SearchNavLink } from '@/components/global-search'
import { logout } from '@/lib/actions/auth'
import { switchSpace } from '@/lib/actions/spaces'
import type { SpaceOption } from '@/lib/space'

export function AppShell({
  spaceId,
  spaceName,
  spaces,
  showSpace,
  profileName,
  roleLabel,
  nav,
  showGlobalSearch = false,
  children,
}: {
  spaceId: string
  spaceName: string
  spaces: SpaceOption[]
  showSpace: boolean
  profileName: string
  roleLabel: string
  nav: { href: string; label: string; icon: ReactNode }[]
  showGlobalSearch?: boolean
  children: ReactNode
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const canSwitch = spaces.length > 1

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? '' : 'mobile-hidden'}`}>
        <div className="brand">
          <Image src="/brand/mora-logo.png" alt="Mora Gastronomía" width={40} height={40} className="brand-logo" priority />
          <div><strong>Mora</strong><span>Gastronomía</span></div>
          <button className="mobile-close" onClick={() => setOpen(false)} aria-label="Cerrar menú" type="button"><X size={18} /></button>
        </div>
        {showSpace && (
          <div className="space-switcher">
            <div className="space-icon"><UtensilsCrossed size={16} /></div>
            {canSwitch ? (
              <form action={switchSpace} className="space-switcher-form">
                <small>Espacio actual</small>
                <select name="space_id" defaultValue={spaceId} aria-label="Cambiar espacio" onChange={(event) => event.currentTarget.form?.requestSubmit()}>
                  {spaces.map((space) => (
                    <option key={space.id} value={space.id}>{space.name}</option>
                  ))}
                </select>
              </form>
            ) : (
              <div><small>Espacio actual</small><strong>{spaceName}</strong></div>
            )}
          </div>
        )}
        <nav className={`primary-nav ${showSpace ? '' : 'primary-nav-top'}`} aria-label="Navegación principal">
          <span className="nav-label">GESTIÓN</span>
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${pathname === item.href || pathname.startsWith(`${item.href}/`) ? 'active' : ''}`}
              onClick={() => setOpen(false)}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="profile-mini">
            <div className="avatar avatar-coral">{profileName.slice(0, 2).toUpperCase()}</div>
            <div><strong>{profileName}</strong><span>{roleLabel}</span></div>
          </div>
          <form action={logout}>
            <button className="text-button logout-button" type="submit">Cerrar sesión</button>
          </form>
        </div>
      </aside>
      <main className="main-content">
        <button className="menu-toggle" type="button" onClick={() => setOpen(true)} aria-label="Abrir menú"><Menu size={21} /></button>
        {showGlobalSearch && (
          <header className="app-topbar">
            <GlobalSearch navLinks={nav.map(({ href, label }): SearchNavLink => ({ href, label }))} />
          </header>
        )}
        <div className="content-wrap">{children}</div>
      </main>
    </div>
  )
}
