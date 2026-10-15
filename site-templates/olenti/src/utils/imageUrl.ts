/**
 * Get the full URL for uploaded images.
 * Images from /uploads should NOT go through /api, they're served directly by nginx.
 *
 * @param imagePath - The image path (e.g., "/uploads/services/flower.webp" or "https://...")
 * @returns The full URL to the image
 */
export const getUploadedImageUrl = (imagePath: string | null | undefined): string => {
  if (!imagePath) {
    return ''
  }

  // If it's already a full URL, return as-is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath
  }

  // For /uploads paths, return directly without /api prefix
  // These are served by nginx from the /uploads location
  if (imagePath.startsWith('/uploads')) {
    return imagePath
  }

  // For relative paths that don't start with /uploads, assume they're static assets
  if (imagePath.startsWith('/')) {
    return imagePath
  }

  // Default: return as-is
  return imagePath
}
