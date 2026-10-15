/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * ugs-013: safe memory limits for UGS history lists and image previews on mobile.
 *
 * Invariants:
 * - History fetch limit stays at 10 unless backend contract changes.
 *
 * Related:
 * - UgsImagesScreen.kt, UgsSongsScreen.kt
 */
package feature.ugs

internal const val UGS_HISTORY_LIMIT = 10
internal const val UGS_IMAGE_THUMBNAIL_MAX_PX = 512

internal fun <T> trimUgsHistory(items: List<T>, limit: Int = UGS_HISTORY_LIMIT): List<T> =
    items.take(limit)
