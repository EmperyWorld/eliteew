/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * In-memory LRU cache for content library preview bitmaps (list thumbnails and preview sheet).
 *
 * Invariants:
 * - Entries keyed by unified content id; [retainOnly] drops previews for deleted/missing files.
 * - Bitmap copies are stored; callers must not mutate cached instances.
 *
 * Related:
 * - MobileContentLibraryScreen.kt, EmperyMediaPlayerHolder.contentThumbnailUrl
 */
package feature.ugs

import android.graphics.Bitmap
import android.util.LruCache

object ContentLibraryPreviewCache {
    private const val MAX_ENTRIES = 96

    private val cache = LruCache<String, Bitmap>(MAX_ENTRIES)

    fun get(contentId: String): Bitmap? = cache.get(contentId)

    fun put(
        contentId: String,
        bitmap: Bitmap,
    ) {
        if (bitmap.isRecycled) return
        cache.put(contentId, bitmap.copy(bitmap.config ?: Bitmap.Config.ARGB_8888, false))
    }

    fun remove(contentId: String) {
        cache.remove(contentId)
    }

    /** Drop previews for content ids no longer present in the library list. */
    fun retainOnly(knownIds: Set<String>) {
        val stale = cache.snapshot().keys.filter { it !in knownIds }
        stale.forEach { cache.remove(it) }
    }

    fun clear() {
        cache.evictAll()
    }
}
