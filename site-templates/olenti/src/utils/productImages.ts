/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Resolve product card image URLs for storefront (seed gallery vs ImperorG runtime uploads).
 *
 * Invariants:
 * - ImperorG `/uploads/imperorg-*` paths must keep full filename (timestamp-random.webp).
 * - Legacy seed paths may strip a single numeric build suffix before `.webp`.
 *
 * Related:
 * - src/utils/imageUrl.ts
 * - site-templates/olenti/server/src/routes/admin.ts (upload naming)
 */

const DEFAULT_PRODUCT_IMAGE = '/uploads/products/product-1.webp'

/** True when path ends with `-<msTimestamp>-<random>.webp` (Site Studio admin upload). */
export function isRuntimeUploadFilename(path: string): boolean {
  if (/\/uploads\/imperorg-/i.test(path)) {
    return true
  }
  return /-\d{10,}-\d{6,}\.webp$/i.test(path)
}

/** Strip one legacy numeric suffix (seed gallery rebuild artifact), never for runtime uploads. */
export function normalizeUploadProductPath(value: string): string {
  if (isRuntimeUploadFilename(value)) {
    return value
  }
  return value.replace(/-\d+(?=\.webp$)/, '')
}

// Mapping product names to canonical upload image IDs
const productNameToImageId: Record<string, string> = {
  'Стартовый пакет': 'product-1',
  'Комплект «Стандарт»': 'product-2',
  'Флагманское предложение': 'product-3',
  'Пакет сопровождения': 'product-4',
  'Цифровой продукт': 'product-5',
  'Мини-курс': 'product-6',
  'Стартовый абонемент': 'product-1',
  'Абонемент на 12 занятий': 'product-2',
  'Безлимитный абонемент': 'product-3',
  'Месячный абонемент': 'product-4',
  'Персональная тренировка': 'product-5',
}

const toCanonicalUploadProductPath = (value: string): string | null => {
  if (!value) return null

  if (value.startsWith('@assets/')) {
    const uploadsPath = value
      .replace('@assets/', '/uploads/')
      .replace(/\.(png|jpg|jpeg)$/i, '.webp')
    return normalizeUploadProductPath(uploadsPath)
  }

  if (value.startsWith('/uploads/')) {
    return normalizeUploadProductPath(value)
  }

  return null
}

const byProductName = (productName?: string): string | null => {
  if (!productName) return null
  const imageId = productNameToImageId[productName]
  return imageId ? `/uploads/products/${imageId}.webp` : null
}

const byProductIdMatch = (value: string): string | null => {
  const match = value.match(/product-(\d+)/i)
  if (!match) return null
  return `/uploads/products/product-${match[1]}.webp`
}

export const getProductImage = (imagePath: string | null | undefined, productName?: string): string => {
  if (!imagePath) {
    return byProductName(productName) || DEFAULT_PRODUCT_IMAGE
  }

  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath
  }

  const uploadPath = toCanonicalUploadProductPath(imagePath)
  if (uploadPath) {
    return uploadPath
  }

  const idPath = byProductIdMatch(imagePath)
  if (idPath) {
    return idPath
  }

  const named = byProductName(productName)
  if (named) {
    return named
  }

  return imagePath
}

export const getDefaultProductImage = (): string => DEFAULT_PRODUCT_IMAGE

export const getProductImageByName = (productName?: string): string | null => {
  if (productName) {
    return byProductName(productName)
  }
  return null
}
