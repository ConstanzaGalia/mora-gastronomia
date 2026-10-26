'use client'

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

const DialogClose = createContext<() => void>(() => {})

export function useDialogClose() {
  return useContext(DialogClose)
}

export function FormDialog({
  title,
  trigger,
  triggerClassName = 'primary-button',
  disabled,
  wide,
  action,
  formClassName = 'stack-form dialog-form',
  children,
}: {
  title: string
  trigger: string
  triggerClassName?: string
  disabled?: boolean
  wide?: boolean
  action?: (formData: FormData) => void | Promise<void>
  formClassName?: string
  children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [formKey, setFormKey] = useState(0)

  const close = useCallback(() => {
    dialog.current?.close()
  }, [])

  function open() {
    setFormKey((value) => value + 1)
    dialog.current?.showModal()
  }

  return (
    <>
      <button className={triggerClassName} type="button" onClick={open} disabled={disabled}>{trigger}</button>
      <dialog
        ref={dialog}
        className={wide ? 'company-dialog payment-dialog' : 'company-dialog'}
        onClick={(event) => {
          if (event.target === dialog.current) close()
        }}
      >
        <div className="dialog-heading">
          <h2>{title}</h2>
          <button className="outline-button" type="button" onClick={close}>Cerrar</button>
        </div>
        <DialogClose.Provider value={close}>
          {action ? (
            <form
              key={formKey}
              className={formClassName}
              action={async (formData) => {
                try {
                  await action(formData)
                } finally {
                  close()
                }
              }}
            >
              {children}
            </form>
          ) : (
            <div key={formKey}>{children}</div>
          )}
        </DialogClose.Provider>
      </dialog>
    </>
  )
}
