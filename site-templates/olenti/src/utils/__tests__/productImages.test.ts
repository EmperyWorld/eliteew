/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for productImages URL normalization (ImperorG vs seed gallery).
 */

import { describe, expect, it } from 'vitest'
import { getProductImage, isRuntimeUploadFilename, normalizeUploadProductPath } from '../productImages'

describe('productImages', () => {
  it('preserves ImperorG upload filename with timestamp-random suffix', () => {
    const path =
      '/uploads/imperorg-product-cmpnxkge4003y6kp8nzv06hqf-1779879297267-424841996.webp'
    expect(isRuntimeUploadFilename(path)).toBe(true)
    expect(normalizeUploadProductPath(path)).toBe(path)
    expect(getProductImage(path)).toBe(path)
  })

  it('strips single legacy numeric suffix for seed product paths', () => {
    const raw = '/uploads/products/product-1-1779879000000.webp'
    expect(isRuntimeUploadFilename(raw)).toBe(false)
    expect(normalizeUploadProductPath(raw)).toBe('/uploads/products/product-1.webp')
  })

  it('does not strip random suffix from runtime upload pattern', () => {
    const path = '/uploads/content/home-hero-background-1779879000000-123456789.webp'
    expect(isRuntimeUploadFilename(path)).toBe(true)
    expect(normalizeUploadProductPath(path)).toBe(path)
  })
})
