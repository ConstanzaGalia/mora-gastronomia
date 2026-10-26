'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { describeError, slugify } from '@/lib/format'
import { redirectWithError } from '@/lib/redirect-error'
import { assertRole, requireSession } from '@/lib/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const MAX_BYTES = 15 * 1024 * 1024
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

export async function saveDocumentCategory(_prev: { error: string; saved: boolean }, formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { error: 'El nombre de la categoría es obligatorio.', saved: false }
  const slug = slugify(name)
  if (!slug) return { error: 'El nombre no genera un identificador válido.', saved: false }

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('document_categories')
    .select('id, slug')
    .eq('business_space_id', session.spaceId)
    .eq('slug', slug)
    .maybeSingle()
  if (existing) return { error: 'Esa categoría ya existe.', saved: false }

  const { error } = await supabase.from('document_categories').insert({
    business_space_id: session.spaceId,
    name,
    slug,
  })
  if (error) {
    if (error.code === '23505') return { error: 'Esa categoría ya existe.', saved: false }
    return { error: describeError(error), saved: false }
  }
  revalidatePath('/documentos')
  return { error: '', saved: true }
}

export async function deleteDocumentCategory(formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  const id = String(formData.get('id') ?? '')
  const supabase = await createClient()
  const { count } = await supabase
    .from('space_documents')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id)
  if (count) redirectWithError('/documentos', 'No se puede eliminar: hay documentos en esa categoría.')
  const { error } = await supabase.from('document_categories').delete().eq('id', id).eq('business_space_id', session.spaceId)
  if (error) redirectWithError('/documentos', describeError(error))
  revalidatePath('/documentos')
}

export async function saveDocument(_prev: { error: string }, formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  const categoryId = String(formData.get('category_id') ?? '')
  const title = String(formData.get('title') ?? '').trim()
  const issuedOn = String(formData.get('issued_on') ?? '').trim() || null
  const expiresOn = String(formData.get('expires_on') ?? '').trim() || null
  const file = formData.get('file')
  if (!categoryId) return { error: 'Elegí una categoría.' }
  if (!title) return { error: 'El título del documento es obligatorio.' }
  if (!(file instanceof File) || file.size === 0) return { error: 'Elegí un archivo para subir.' }
  if (file.size > MAX_BYTES) return { error: 'El archivo no puede superar los 15 MB.' }
  const mimeType = file.type || guessMime(file.name)
  if (!ALLOWED_TYPES.has(mimeType)) return { error: 'Solo se aceptan PDF, Word o imágenes (JPG, PNG o WebP).' }

  const supabase = await createClient()
  const { data: category } = await supabase
    .from('document_categories')
    .select('id')
    .eq('id', categoryId)
    .eq('business_space_id', session.spaceId)
    .maybeSingle()
  if (!category) return { error: 'Esa categoría no existe.' }

  const id = crypto.randomUUID()
  const storagePath = `${session.spaceId}/${id}/${safeFileName(file.name)}`
  const admin = createAdminClient()
  const { error: uploadError } = await admin.storage.from('space-documents').upload(storagePath, file, {
    contentType: mimeType,
    upsert: false,
  })
  if (uploadError) return { error: describeError(uploadError) }

  const { error } = await supabase.from('space_documents').insert({
    id,
    business_space_id: session.spaceId,
    category_id: categoryId,
    title,
    original_name: file.name,
    storage_path: storagePath,
    mime_type: mimeType,
    file_size: file.size,
    issued_on: issuedOn,
    expires_on: expiresOn,
    created_by: session.userId,
  })
  if (error) {
    await admin.storage.from('space-documents').remove([storagePath])
    return { error: describeError(error) }
  }
  revalidatePath('/documentos')
  return { error: '' }
}

export async function deleteDocument(formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  const id = String(formData.get('id') ?? '')
  const supabase = await createClient()
  const { data: document } = await supabase
    .from('space_documents')
    .select('id, storage_path')
    .eq('id', id)
    .eq('business_space_id', session.spaceId)
    .maybeSingle()
  if (!document) redirectWithError('/documentos', 'No encontramos ese documento.')
  const { error } = await supabase.from('space_documents').delete().eq('id', document.id)
  if (error) redirectWithError('/documentos', describeError(error))
  await createAdminClient().storage.from('space-documents').remove([document.storage_path])
  revalidatePath('/documentos')
}

export async function openDocument(formData: FormData) {
  const session = await requireSession()
  assertRole(session, ['ORG_ADMIN', 'SPACE_ADMIN'])
  const id = String(formData.get('id') ?? '')
  const supabase = await createClient()
  const { data: document } = await supabase
    .from('space_documents')
    .select('storage_path')
    .eq('id', id)
    .eq('business_space_id', session.spaceId)
    .maybeSingle()
  if (!document) redirectWithError('/documentos', 'No encontramos ese documento.')
  const { data, error } = await createAdminClient().storage.from('space-documents').createSignedUrl(document.storage_path, 120)
  if (error || !data?.signedUrl) redirectWithError('/documentos', 'No se pudo abrir el archivo.')
  redirect(data.signedUrl)
}

function safeFileName(name: string) {
  const cleaned = name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return cleaned.slice(0, 80) || 'documento'
}

function guessMime(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return 'application/pdf'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'doc') return 'application/msword'
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  return ''
}
