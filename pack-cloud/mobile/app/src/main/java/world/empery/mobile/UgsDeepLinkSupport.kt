/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Maps push/deeplink UGS nested route keys to NavHost paths under the AI tab.
 *
 * Invariants:
 * - Unknown keys return null (open UGS hub root only).
 *
 * Related:
 * - MobileDeepLinkRouter.kt, FeedInternalLinkRouting.kt
 */
package world.empery.mobile

/** Canonical nested NavHost route (`ugs/chat`, …) or null when absent/unknown. */
fun coerceUgsNestedRoute(raw: String?): String? {
    val trimmed = raw?.trim()?.takeIf { it.isNotEmpty() } ?: return null
    val lower = trimmed.lowercase()
    val normalized =
        when (lower) {
            "desktop", "hub", "desktop_hub" -> "ugs/desktop"
            "chat", "ai-chat", "ai_chat", "aichat" -> "ugs/chat"
            "songs", "music", "song" -> "ugs/songs"
            "images", "image", "gallery" -> "ugs/images"
            "presentations", "presentation", "slides" -> "ugs/presentations"
            "content", "library", "content_manager", "content-manager" -> "ugs/content"
            else -> trimmed
        }
    return when {
        normalized.startsWith("ugs/") -> normalized
        normalized == "ugs" -> null
        else -> "ugs/$normalized"
    }
}
