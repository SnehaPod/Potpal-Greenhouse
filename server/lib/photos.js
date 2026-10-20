// Photo uploads, shared by /api/identify and /api/plants/:id/health.

import multer from 'multer'
import { randomUUID } from 'node:crypto'

// Express middleware that reads one image from the "photo" form field.
// It keeps the upload in memory (we only pass it on) and caps it at 5 MB.
export const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
}).single('photo')

/**
 * Save the uploaded photo to the "plant-photos" bucket and return its public URL.
 * Stored as "<user id>/<random id>.jpg"; the storage policy only allows users
 * to write inside their own folder.
 */
export async function savePhoto(req) {
  const extension = req.file.mimetype.split('/')[1] || 'jpg'
  const path = `${req.user.id}/${randomUUID()}.${extension}`

  const { error } = await req.supabase.storage
    .from('plant-photos')
    .upload(path, req.file.buffer, { contentType: req.file.mimetype })
  if (error) throw error

  const { data } = req.supabase.storage.from('plant-photos').getPublicUrl(path)
  return data.publicUrl
}
