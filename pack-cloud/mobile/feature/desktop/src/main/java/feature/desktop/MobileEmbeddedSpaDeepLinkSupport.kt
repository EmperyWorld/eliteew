// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Maps push/deeplink tab keys to embedded SPA hash routes (EWA companion only in T03 scope).
// Invariants:
// - Does not replace shell bottom-tab routes; `ewa`/`companion` open WebView directly.
// Related:
// - MobileDeepLinks.kt, EwaCompanionWebViewLauncher.kt, MainActivity.kt
// ---
package feature.desktop

import android.net.Uri

private val EWA_COMPANION_TAB_ALIASES: Set<String> = setOf("ewa", "companion")

/** Hash query keys forwarded into `#/mobile-ewa-companion?…` for companion deep-link bootstrap. */
private val EWA_COMPANION_HASH_QUERY_KEYS: Set<String> =
    setOf("operation", "run", "tools", "open", "phrases", "workflows")

fun resolveEmbeddedSpaHashFromIncomingTab(raw: String?): String? =
    when (raw?.trim()?.lowercase()) {
        in EWA_COMPANION_TAB_ALIASES -> EwaCompanionWebViewLauncher.MOBILE_EWA_COMPANION_HASH
        else -> null
    }

fun isEmbeddedSpaIncomingTab(raw: String): Boolean =
    resolveEmbeddedSpaHashFromIncomingTab(raw) != null

/** Builds `operation=…&tools=1` suffix for companion SPA hash (excludes `tab`, `spaBoot`). */
fun extractEwaCompanionHashQuery(uri: Uri): String? {
    val names = uri.queryParameterNames ?: return null
    if (names.isEmpty()) return null
    val parts = mutableListOf<String>()
    for (key in names) {
        val normalized = key.trim().lowercase()
        if (normalized !in EWA_COMPANION_HASH_QUERY_KEYS) continue
        val value = uri.getQueryParameter(key)?.trim().orEmpty()
        if (value.isEmpty() && normalized != "tools" && normalized != "phrases" && normalized != "workflows") {
            continue
        }
        parts += if (value.isEmpty()) normalized else "$normalized=${Uri.encode(value)}"
    }
    return parts.takeIf { it.isNotEmpty() }?.joinToString("&")
}

fun appendHashQueryToSpaUrl(baseSpaUrl: String, hashQuery: String?): String {
    val suffix = hashQuery?.trim().orEmpty()
    if (suffix.isEmpty()) return baseSpaUrl
    val separator = if (baseSpaUrl.contains('?')) '&' else '?'
    return "$baseSpaUrl$separator$suffix"
}

data class PendingEmbeddedSpaDeepLink(
    val spaHash: String,
    val hashQuery: String? = null,
)

fun extractEwaCompanionHashQueryFromData(data: Map<String, String>): String? {
    if (data.isEmpty()) return null
    val parts = mutableListOf<String>()
    for (key in data.keys) {
        val normalized = key.trim().lowercase()
        if (normalized !in EWA_COMPANION_HASH_QUERY_KEYS) continue
        val value = data[key]?.trim().orEmpty()
        if (value.isEmpty() && normalized != "tools" && normalized != "phrases" && normalized != "workflows") {
            continue
        }
        parts += if (value.isEmpty()) normalized else "$normalized=${Uri.encode(value)}"
    }
    return parts.takeIf { it.isNotEmpty() }?.joinToString("&")
}
