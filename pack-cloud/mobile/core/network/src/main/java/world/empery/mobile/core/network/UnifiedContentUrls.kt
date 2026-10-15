/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Authenticated unified content download/stream URL builder for mobile clients.
 */
package world.empery.mobile.core.network

object UnifiedContentUrls {
    fun downloadUrl(
        apiBaseUrl: String,
        contentId: String,
    ): String {
        val base = apiBaseUrl.trim().trimEnd('/')
        val id = contentId.trim()
        return "$base/content/$id/download"
    }

    fun thumbnailUrl(
        apiBaseUrl: String,
        contentId: String,
    ): String {
        val base = apiBaseUrl.trim().trimEnd('/')
        val id = contentId.trim()
        return "$base/content/$id/thumbnail"
    }
}
