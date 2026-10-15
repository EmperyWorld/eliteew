/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * In-memory ETag holder for `GET profile/me` conditional refresh.
 *
 * Related:
 * - ProfileRepository.refresh, HttpEtagSupport
 */
package feature.profile

internal class ProfileMeEtagCache {
    @Volatile
    var etag: String? = null
        private set

    fun remember(etag: String?) {
        val trimmed = etag?.trim()?.takeIf { it.isNotEmpty() } ?: return
        this.etag = trimmed
    }

    fun invalidate() {
        etag = null
    }
}
