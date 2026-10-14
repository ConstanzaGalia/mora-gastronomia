'use client'

import type { FormEvent, ReactNode } from 'react'

export function FilterForm({ className, children }: { className?: string; children: ReactNode }) {
  function onChange(event: FormEvent<HTMLFormElement>) {
    const target = event.target
    if (target instanceof HTMLInputElement && (target.type === 'text' || target.type === 'number')) return
    event.currentTarget.requestSubmit()
  }

  return (
    <form className={className} method="get" onChange={onChange}>{children}</form>
  )
}
