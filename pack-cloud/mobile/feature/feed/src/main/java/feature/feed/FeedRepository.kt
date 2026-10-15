/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EWDesk feed repository: Room cache observe/load, cursor-paginated refresh, single-post upsert.
 *
 * Invariants:
 * - Same package as FeedFeature; public [FeedRepository] API unchanged for AppContainer / FeedTabViewModel.
 *
 * Related:
 * - FeedFeature.kt, FeedUiModels.kt, FeedRoadmapSupport.kt
 */
package feature.feed

import kotlinx.coroutines.flow.Flow
import world.empery.mobile.core.network.api.EwDeskApi
import world.empery.mobile.core.network.api.EwDeskNewsListItemDto
import world.empery.mobile.core.network.api.EwDeskNewsPostDto
import world.empery.mobile.core.storage.FeedPostEntity
import world.empery.mobile.core.storage.MobileDatabase

internal fun ewDeskListItemToFeedEntity(it: EwDeskNewsListItemDto): FeedPostEntity =
    FeedPostEntity(
        id = it.id,
        title = it.title,
        body = it.body_excerpt.orEmpty(),
        pinned = it.pinned,
        publishedAt = it.published_at,
        updatedAt = it.updated_at,
        imageUrl = it.image_url,
        imageContentId = it.image_content_id,
        videoContentId = it.video_content_id,
        audioContentId = it.audio_content_id,
    )

class FeedRepository(
    private val api: EwDeskApi,
    private val db: MobileDatabase,
) {
    suspend fun loadFromCache(): List<FeedPostEntity> = db.feedDao().getAll()

    fun observePosts(): Flow<List<FeedPostEntity>> = db.feedDao().observeAll()

    private fun dtoToEntity(it: EwDeskNewsPostDto): FeedPostEntity =
        FeedPostEntity(
            id = it.id,
            title = it.title,
            body = it.body,
            pinned = it.pinned,
            publishedAt = it.published_at,
            updatedAt = it.updated_at,
            imageUrl = it.image_url,
            imageContentId = it.image_content_id,
            videoContentId = it.video_content_id,
            audioContentId = it.audio_content_id,
        )

    suspend fun refresh(): List<FeedPostEntity> {
        val merged = mutableListOf<FeedPostEntity>()
        var cursor: String? = null
        do {
            val page = api.getNewsPage(limit = 200, cursor = cursor)
            merged += page.items.map(::ewDeskListItemToFeedEntity)
            cursor = page.next_cursor?.trim()?.takeIf { it.isNotEmpty() }
        } while (cursor != null)
        db.feedDao().deleteAll()
        if (merged.isNotEmpty()) {
            db.feedDao().upsertAll(merged)
        }
        return merged
    }

    suspend fun fetchAndUpsertNewsPost(postId: String): FeedPostEntity {
        val dto = api.getNewsPost(postId.trim())
        val entity = dtoToEntity(dto)
        db.feedDao().upsertAll(listOf(entity))
        return entity
    }
}
