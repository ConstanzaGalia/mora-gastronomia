'use client'

import { useState } from 'react'

export function LandingMenu({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className="xl:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg text-primary"
        aria-expanded={open}
        aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="material-symbols-outlined text-[22px]">{open ? 'close' : 'menu'}</span>
      </button>
      {open && (
        <nav className="xl:hidden absolute top-20 inset-x-0 bg-surface border-b border-outline-variant shadow-md px-6 py-4 flex flex-col gap-1">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-colors py-2"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </a>
          ))}
        </nav>
      )}
    </>
  )
}
