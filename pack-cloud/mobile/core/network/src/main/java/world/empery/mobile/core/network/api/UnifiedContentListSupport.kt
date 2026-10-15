/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Client-side pagination helpers for unified content list API (mobile CM lite + UGS history).
 *
 * Invariants:
 * - Respects server `has_more` and caps total fetched items to avoid unbounded memory use.
 *
 * Related:
 * - ContentApiContracts.kt, MobileContentLibraryScreen.kt, UgsSongsScreen.kt
 */
package world.empery.mobile.core.network.api

data class UnifiedContentListPage(
    val items: List<UnifiedContentDto>,
    val total: Int,
    val hasMore: Boolean,
)

suspend fun UnifiedContentApi.fetchContentPage(
    sourceService: String? = null,
    contentType: String? = null,
    search: String? = null,
    ownerOnly: Boolean = true,
    listProfile: String? = "compact",
    limit: Int = 50,
    offset: Int = 0,
    sortField: String = "date",
    sortOrder: String = "desc",
): UnifiedContentListPage {
    val response =
        listContent(
            sourceService = sourceService,
            contentType = contentType,
            search = search?.trim()?.takeIf { it.isNotEmpty() },
            ownerOnly = ownerOnly,
            listProfile = listProfile,
            limit = limit.coerceIn(1, 200),
            offset = offset.coerceAtLeast(0),
            sortField = sortField,
            sortOrder = sortOrder,
        )
    return UnifiedContentListPage(
        items = response.items,
        total = response.total,
        hasMore = response.has_more,
    )
}

suspend fun UnifiedContentApi.listAllContent(
    sourceService: String? = null,
    contentType: String? = null,
    search: String? = null,
    ownerOnly: Boolean = true,
    listProfile: String? = "compact",
    pageSize: Int = 50,
    maxItems: Int = 200,
): List<UnifiedContentDto> {
    val cappedPageSize = pageSize.coerceIn(1, 200)
    val cap = maxItems.coerceAtLeast(1)
    val collected = mutableListOf<UnifiedContentDto>()
    var offset = 0
    while (collected.size < cap) {
        val page =
            fetchContentPage(
                sourceService = sourceService,
                contentType = contentType,
                search = search,
                ownerOnly = ownerOnly,
                listProfile = listProfile,
                limit = cappedPageSize,
                offset = offset,
            )
        if (page.items.isEmpty()) break
        collected.addAll(page.items)
        if (!page.hasMore || page.items.size < cappedPageSize) break
        offset += page.items.size
    }
    return collected.take(cap)
}
