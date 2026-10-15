/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * feed-007: map EWDesk Markdown internal desktop-open links to mobile app routes.
 *
 * Invariants:
 * - Only `/__eliteew-desktop-open-app__/` paths are routed; external URLs stay external.
 *
 * Related:
 * - EwDeskLinkedMediaUrls.kt, FeedFeature.kt
 */
package feature.feed

/** Parsed internal desktop-open link from EWDesk markdown. */
data class FeedInternalAppLink(
    val rawPath: String,
    val appId: String?,
    val query: Map<String, String> = emptyMap(),
)

private val DESKTOP_OPEN_PREFIX = "/__eliteew-desktop-open-app__/"

internal fun parseFeedInternalAppLink(destination: String): FeedInternalAppLink? {
    val trimmed = destination.trim()
    if (!trimmed.startsWith(DESKTOP_OPEN_PREFIX)) return null
    val rest = trimmed.removePrefix(DESKTOP_OPEN_PREFIX).trimStart('/')
    val pathPart = rest.substringBefore('?').trim()
    val queryPart = rest.substringAfter('?', missingDelimiterValue = "")
    val appId = pathPart.substringBefore('/').trim().takeIf { it.isNotEmpty() }
    val query =
        if (queryPart.isBlank()) {
            emptyMap()
        } else {
            queryPart.split('&')
                .mapNotNull { pair ->
                    val key = pair.substringBefore('=').trim()
                    if (key.isEmpty()) null else key to pair.substringAfter('=').trim()
                }
                .toMap()
        }
    return FeedInternalAppLink(rawPath = trimmed, appId = appId, query = query)
}

/** Resolve to mobile nested route (tab + optional nested path). */
internal fun FeedInternalAppLink.toMobileRoute(): Pair<String, String?> {
    val app = appId?.lowercase().orEmpty()
    return when {
        app == "ugs" || query["tab"]?.equals("ugs", ignoreCase = true) == true -> {
            val nested = query["nested"]?.trim()?.takeIf { it.isNotEmpty() }?.let { "ugs/$it" } ?: "ugs"
            Pair("ugs", nested)
        }
        app == "desktop" || query["tab"]?.equals("desktop", ignoreCase = true) == true ->
            Pair("ugs", "ugs/desktop")
        app == "friends" || query["tab"]?.equals("friends", ignoreCase = true) == true ->
            Pair("friends", null)
        app == "chat" || query["tab"]?.equals("chat", ignoreCase = true) == true -> {
            val nested = query["chat_id"]?.trim()?.takeIf { it.isNotEmpty() }?.let { "chat/$it" }
            Pair("chat", nested)
        }
        app.isNotBlank() -> Pair("ugs", "ugs/desktop")
        else -> Pair("feed", null)
    }
}

/**
 * Map parsed EWDesk desktop-open link to a desktop store component id for [MobileInstalledAppRoutes.bottomTabRouteForStoreAppId].
 *
 * Nested desktop paths (for example `EliteEwShellSettings/performance`) keep the root component segment only.
 */
internal fun FeedInternalAppLink.toStoreAppIdForMobileShell(): String {
    val rawAppId = appId?.trim()?.takeIf { it.isNotEmpty() }
    if (rawAppId != null) {
        return when (rawAppId.lowercase()) {
            "ugs", "desktop" -> "UGSHubApp"
            "friends" -> "FriendsApp"
            "chat" -> "GAFChatApp"
            "feed", "ewdeskapp", "newsapp" -> "EwDeskApp"
            "profile" -> "ProfileApp"
            else -> rawAppId
        }
    }
    return when (query["tab"]?.trim()?.lowercase()) {
        "friends" -> "FriendsApp"
        "chat" -> "GAFChatApp"
        "feed" -> "EwDeskApp"
        "profile" -> "ProfileApp"
        "ugs", "desktop" -> "UGSHubApp"
        else -> "UGSHubApp"
    }
}
