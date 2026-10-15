/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Derives SPA web origin from Retrofit API base URL for external browser handoff.
 *
 * Invariants:
 * - Strips trailing `/api/v1` or `/api` suffix from configured base URL.
 *
 * Related:
 * - AppRuntimeConfig, DesktopHubFeature.kt
 */
package world.empery.mobile.core.network

object MobileWebOrigin {
    fun fromApiBase(apiBase: String): String {
        val normalized = apiBase.trim().trimEnd('/')
        return normalized
            .removeSuffix("/api/v1")
            .removeSuffix("/api")
            .trimEnd('/')
    }
}
