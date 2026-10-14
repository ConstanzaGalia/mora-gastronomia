'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { digits, employeeAuthEmail, homePath, pickPrimaryRole } from '@/lib/format'

export async function login(_prev: { error: string }, formData: FormData) {
  const mode = String(formData.get('mode') ?? 'admin')
  const password = String(formData.get('password') ?? '')
  let email = String(formData.get('email') ?? '').trim().toLowerCase()

  if (mode === 'employee') {
    const dni = digits(String(formData.get('dni') ?? ''))
    if (!/^[0-9]{7,8}$/.test(dni)) return { error: 'El DNI tiene que tener 7 u 8 dígitos.' }
    email = employeeAuthEmail(dni)
  }

  if (!email || !password) return { error: 'Completá usuario y contraseña.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: 'Usuario o contraseña incorrectos.' }

  const { data: roles } = await supabase.rpc('get_my_roles')
  const primary = pickPrimaryRole(roles ?? [])
  if (!primary) {
    await supabase.auth.signOut()
    return { error: 'Tu usuario no tiene un acceso vigente.' }
  }

  redirect(homePath(primary.role))
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
