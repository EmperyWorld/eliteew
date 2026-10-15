/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Maps push/deeplink profile section keys to collapsible category ids.
 *
 * Invariants:
 * - Unknown section keys return null (no-op deeplink).
 *
 * Related:
 * - ProfileTabViewModel, MobileDeepLinks.kt
 */
package feature.profile

fun resolveProfileCategoryFromSection(raw: String?): ProfileCategoryId? =
    when (raw?.trim()?.lowercase()) {
        "updates", "ota", "update" -> ProfileCategoryId.UPDATES
        "account", "privacy" -> ProfileCategoryId.ACCOUNT
        "security", "secure", "access" -> ProfileCategoryId.SECURITY
        "video_calls", "videocalls", "calls", "call_target" -> ProfileCategoryId.VIDEO_CALLS
        "notifications", "push" -> ProfileCategoryId.NOTIFICATIONS
        "appearance", "theme", "style" -> ProfileCategoryId.APPEARANCE
        "storage", "cache" -> ProfileCategoryId.STORAGE
        "support", "help", "feedback" -> ProfileCategoryId.SUPPORT
        else -> null
    }

/** Whether opening Profile with this section should trigger an OTA stale check. */
fun profileSectionTriggersOtaCheck(raw: String?): Boolean =
    resolveProfileCategoryFromSection(raw) == ProfileCategoryId.UPDATES
