/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure Desktop Hub helpers: theme cycle order and lazy-column section index contract.
 *
 * Invariants:
 * - [DESKTOP_HUB_LAZY_COLUMN_INDICES] must match item order in [DesktopHubScreen] LazyColumn.
 *
 * Related:
 * - DesktopHubDeepLinkSupport.kt, DesktopHubRepository, DesktopHubFeature.kt
 */
package feature.desktop

/** LazyColumn item indices — keep in sync with [DesktopHubScreen] (embedded SPA entries shift handoff+). */
object DesktopHubLazyColumnIndices {
    const val REMOTE_DASHBOARD = 0
    const val SHELL_STATE = 1
    const val EWA = 2
    // 3…9 — embedded SPA entry cards (Handbook, Social Hub, … Professional Worlds)
    const val HANDOFF = 10
    const val CONFIG = 11
    const val NOTES = 12
    const val TODOS = 13
    const val FAVORITES = 14
    // 15 settings entry, 16 app store entry
    const val STORE = 17
}

/** DARK → LIGHT → AUTO → DARK (matches web Settings Center theme cycle). */
fun resolveNextDesktopTheme(current: String?): String =
    when (current?.trim()?.uppercase()) {
        "DARK" -> "LIGHT"
        "LIGHT" -> "AUTO"
        else -> "DARK"
    }

fun normalizeDesktopThemeKey(raw: String?): String =
    when (raw?.trim()?.uppercase()) {
        "DARK", "LIGHT", "AUTO" -> raw.trim().uppercase()
        else -> "AUTO"
    }
