'use client'

import { Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { SearchGroup, SearchHit } from '@/lib/global-search'
import { foldSearch } from '@/lib/format'

const SEARCH_MIN_CHARS = 2

export type SearchNavLink = { href: string; label: string }

type FlatRow =
  | { id: string; kind: 'nav'; title: string; subtitle?: string; href: string }
  | (SearchHit & { kind: 'hit'; group: string })

export function GlobalSearch({ navLinks }: { navLinks: SearchNavLink[] }) {
  const router = useRouter()
  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [groups, setGroups] = useState<SearchGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const [shortcut, setShortcut] = useState('Ctrl K')

  const term = query.trim()

  const navRows = useMemo(() => {
    return navLinks
      .filter((link) => !term || foldSearch(link.label).includes(foldSearch(term)))
      .map((link) => ({
        id: `nav:${link.href}`,
        kind: 'nav' as const,
        title: link.label,
        href: link.href,
      }))
  }, [navLinks, term])

  const rows = useMemo<FlatRow[]>(() => {
    const hits = groups.flatMap((group) => group.items.map((item) => ({ ...item, kind: 'hit' as const, group: group.label })))
    return [...navRows, ...hits]
  }, [groups, navRows])

  useEffect(() => {
    if (typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)) {
      setShortcut('⌘K')
    }
  }, [])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        if (dialog.current?.open) close()
        else openPalette()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!open) return
    if (term.length < SEARCH_MIN_CHARS) {
      setGroups([])
      setLoading(false)
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: controller.signal })
        if (!response.ok) {
          setGroups([])
          return
        }
        const payload = (await response.json()) as { groups?: SearchGroup[] }
        setGroups(payload.groups ?? [])
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setGroups([])
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [open, term])

  useEffect(() => {
    setActive(0)
  }, [rows.length, term])

  function openPalette() {
    setOpen(true)
    dialog.current?.showModal()
    window.setTimeout(() => input.current?.focus(), 0)
  }

  function close() {
    dialog.current?.close()
    setOpen(false)
    setQuery('')
    setGroups([])
    setActive(0)
  }

  function go(href: string) {
    close()
    router.push(href)
  }

  function onInputKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((value) => Math.min(value + 1, Math.max(rows.length - 1, 0)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((value) => Math.max(value - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const row = rows[active]
      if (row) go(row.href)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      close()
    }
  }

  const groupedHits = groups.filter((group) => group.items.length > 0)
  const activeId = rows[active]?.id ? `search-row-${rows[active].id}` : undefined

  return (
    <>
      <button type="button" className="global-search-trigger" onClick={openPalette}>
        <Search size={16} />
        <span>Buscar empresas, personas, documentos…</span>
        <kbd>{shortcut}</kbd>
      </button>
      <dialog
        ref={dialog}
        className="global-search-dialog"
        onClose={() => {
          setOpen(false)
          setQuery('')
          setGroups([])
          setActive(0)
        }}
        onClick={(event) => {
          if (event.target === dialog.current) close()
        }}
      >
        <div className="global-search-box">
          <Search size={18} />
          <input
            ref={input}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKey}
            placeholder="Buscar por nombre, DNI, mail, empresa, menú…"
            aria-label="Buscar"
            aria-controls="global-search-list"
            aria-activedescendant={activeId}
            autoComplete="off"
          />
          {loading && <span className="global-search-status">Buscando…</span>}
        </div>
        <div id="global-search-list" className="global-search-results" role="listbox" aria-label="Resultados">
          {navRows.length > 0 && (
            <section className="global-search-group">
              <h3>Navegación</h3>
              {navRows.map((row) => {
                const index = rows.findIndex((item) => item.id === row.id)
                return (
                  <SearchRow
                    key={row.id}
                    id={`search-row-${row.id}`}
                    title={row.title}
                    active={index === active}
                    onMouseEnter={() => setActive(index)}
                    onSelect={() => go(row.href)}
                  />
                )
              })}
            </section>
          )}
          {groupedHits.map((group) => (
            <section className="global-search-group" key={group.key}>
              <h3>{group.label}</h3>
              {group.items.map((item) => {
                const index = rows.findIndex((row) => row.kind === 'hit' && row.id === item.id && row.href === item.href)
                return (
                  <SearchRow
                    key={`${group.key}-${item.id}`}
                    id={`search-row-${item.id}`}
                    title={item.title}
                    subtitle={item.subtitle}
                    active={index === active}
                    onMouseEnter={() => setActive(index)}
                    onSelect={() => go(item.href)}
                  />
                )
              })}
            </section>
          ))}
          {term.length < SEARCH_MIN_CHARS && navRows.length > 0 && (
            <p className="muted global-search-hint">Escribí al menos 2 caracteres para buscar en el espacio.</p>
          )}
          {term.length >= SEARCH_MIN_CHARS && !loading && groupedHits.length === 0 && navRows.length === 0 && (
            <p className="muted global-search-hint">No hay coincidencias para “{term}”.</p>
          )}
        </div>
      </dialog>
    </>
  )
}

function SearchRow({
  id,
  title,
  subtitle,
  active,
  onMouseEnter,
  onSelect,
}: {
  id: string
  title: string
  subtitle?: string
  active: boolean
  onMouseEnter: () => void
  onSelect: () => void
}) {
  return (
    <button
      id={id}
      type="button"
      role="option"
      aria-selected={active}
      className={`global-search-row ${active ? 'active' : ''}`}
      onMouseEnter={onMouseEnter}
      onClick={onSelect}
    >
      <strong>{title}</strong>
      {subtitle && <span>{subtitle}</span>}
    </button>
  )
}
