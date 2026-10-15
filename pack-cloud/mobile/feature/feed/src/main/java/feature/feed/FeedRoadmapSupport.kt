/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Super Roadmap feed-001…008: topic filters, read time estimate, offline cache policy, cursor merge, internal links.
 *
 * Invariants:
 * - Topic filter "all" shows every post; unknown topics are treated as product.
 *
 * Related:
 * - FeedFeature.kt, FeedRepository, MobileFeatureShellPreferences
 */
package feature.feed

import world.empery.mobile.core.network.api.EwDeskNewsListItemDto
import world.empery.mobile.core.storage.FeedPostEntity

/** feed-004: EWDesk topic filters. */
enum class FeedTopicFilter(val id: String) {
    ALL("all"),
    PRODUCT("product"),
    RELEASE("release"),
    SOCIAL("social"),
    UGS("ugs"),
    DESKTOP("desktop"),
    SUPPORT("support"),
}

internal fun FeedTopicFilter.matchesPost(post: FeedPostEntity): Boolean {
    if (this == FeedTopicFilter.ALL) return true
    val haystack = "${post.title} ${post.body}".lowercase()
    return when (this) {
        FeedTopicFilter.PRODUCT -> haystack.contains("продукт") || haystack.contains("product") || haystack.contains("eliteew")
        FeedTopicFilter.RELEASE -> haystack.contains("релиз") || haystack.contains("release") || haystack.contains("ota") || haystack.contains("обновлен")
        FeedTopicFilter.SOCIAL -> haystack.contains("social") || haystack.contains("друз") || haystack.contains("gaf")
        FeedTopicFilter.UGS -> haystack.contains("ugs") || haystack.contains("генерац") || haystack.contains("ai ")
        FeedTopicFilter.DESKTOP -> haystack.contains("desktop") || haystack.contains("рабоч") || haystack.contains("стол")
        FeedTopicFilter.SUPPORT -> haystack.contains("support") || haystack.contains("поддерж") || haystack.contains("доступ")
        FeedTopicFilter.ALL -> true
    }
}

fun parseFeedTopicFilter(raw: String?): FeedTopicFilter =
    FeedTopicFilter.entries.firstOrNull { it.id == raw?.trim()?.lowercase() } ?: FeedTopicFilter.ALL

/** feed-001: approximate read time from plain body length. */
internal fun estimateFeedReadMinutes(plainBody: String): Int {
    val words = plainBody.trim().split(Regex("\\s+")).count { it.isNotBlank() }
    return maxOf(1, (words + 199) / 200)
}

/** feed-005: offline cache policy — stale after 6h without successful refresh. */
internal const val FEED_OFFLINE_STALE_MS = 6L * 60L * 60L * 1000L

fun isFeedCacheStale(lastSuccessEpochMs: Long, nowEpochMs: Long = System.currentTimeMillis()): Boolean {
    if (lastSuccessEpochMs <= 0L) return true
    return nowEpochMs - lastSuccessEpochMs > FEED_OFFLINE_STALE_MS
}

/** feed-006: merge cursor pages without duplicate ids, stable order (pinned first). */
internal fun mergeFeedCursorPages(
    existing: List<FeedPostEntity>,
    page: List<EwDeskNewsListItemDto>,
): List<FeedPostEntity> {
    val byId = linkedMapOf<String, FeedPostEntity>()
    existing.forEach { byId[it.id] = it }
    page.map(::ewDeskListItemToFeedEntity).forEach { byId[it.id] = it }
    return byId.values.sortedWith(
        compareByDescending<FeedPostEntity> { it.pinned }
            .thenByDescending { it.publishedAt ?: it.updatedAt ?: "" },
    )
}

internal fun feedCursorHasMore(nextCursor: String?): Boolean =
    !nextCursor.isNullOrBlank()
