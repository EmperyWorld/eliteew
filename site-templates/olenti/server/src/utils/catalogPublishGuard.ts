/**
 * Publish / activate guards for Olenti consultations and masterclasses.
 * Rejects isActive=true unless required catalog fields are present after merge.
 */

export type PublishableCatalogFields = {
  title?: unknown
  price?: unknown
  duration?: unknown
  shortDescription?: unknown
  fullDescription?: unknown
  isActive?: unknown
}

function nonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function positiveNumber(value: unknown): boolean {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) && n > 0
}

/**
 * Merge existing row with PATCH body; if resulting isActive is true, require title, price, duration.
 * Returns an error message or null when ok.
 */
export function validateCatalogPublishActivation(
  existing: PublishableCatalogFields,
  patch: PublishableCatalogFields
): string | null {
  const merged: PublishableCatalogFields = {
    title: patch.title !== undefined ? patch.title : existing.title,
    price: patch.price !== undefined ? patch.price : existing.price,
    duration: patch.duration !== undefined ? patch.duration : existing.duration,
    shortDescription:
      patch.shortDescription !== undefined
        ? patch.shortDescription
        : existing.shortDescription,
    fullDescription:
      patch.fullDescription !== undefined
        ? patch.fullDescription
        : existing.fullDescription,
    isActive: patch.isActive !== undefined ? patch.isActive : existing.isActive,
  }

  if (merged.isActive !== true && merged.isActive !== 'true') {
    return null
  }

  const missing: string[] = []
  if (!nonEmptyString(merged.title)) missing.push('title')
  if (!positiveNumber(merged.price)) missing.push('price')
  if (!nonEmptyString(merged.duration) && !positiveNumber(merged.duration)) {
    missing.push('duration')
  }
  if (missing.length === 0) return null
  return `Cannot activate: missing or invalid required fields: ${missing.join(', ')}`
}
