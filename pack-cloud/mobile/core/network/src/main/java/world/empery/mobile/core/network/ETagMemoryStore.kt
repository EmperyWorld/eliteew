/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thread-safe in-memory ETag store keyed by request URL (no query strip beyond Retrofit path).
 *
 * Invariants:
 * - Reads/writes are synchronized; missing keys return null.
 *
 * Related:
 * - ConditionalGetEtagInterceptor, resolveConditionalGet
 */
package world.empery.mobile.core.network

class ETagMemoryStore {
    private val lock = Any()
    private val etags = LinkedHashMap<String, String>(64, 0.75f, true)

    fun get(urlKey: String): String? =
        synchronized(lock) {
            etags[urlKey]
        }

    fun put(urlKey: String, etag: String) {
        val trimmed = etag.trim()
        if (trimmed.isEmpty()) return
        synchronized(lock) {
            etags[urlKey] = trimmed
            while (etags.size > MAX_ENTRIES) {
                val eldest = etags.entries.iterator()
                if (eldest.hasNext()) {
                    eldest.next()
                    eldest.remove()
                } else {
                    break
                }
            }
        }
    }

    fun clear() {
        synchronized(lock) {
            etags.clear()
        }
    }

    companion object {
        private const val MAX_ENTRIES = 256

        /** Process-wide default store used by [ConditionalGetEtagInterceptor]. */
        val shared: ETagMemoryStore = ETagMemoryStore()
    }
}
