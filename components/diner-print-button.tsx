'use client'

import { useEffect } from 'react'

export function DinerPrintButton() {
  useEffect(() => {
    const id = window.setTimeout(() => window.print(), 400)
    return () => window.clearTimeout(id)
  }, [])

  return (
    <button className="primary-button" type="button" onClick={() => window.print()}>Guardar PDF</button>
  )
}
