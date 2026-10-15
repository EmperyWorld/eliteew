/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Retrofit contracts for EWDesk published news (`/api/v1/product-desktop/news`).
 *
 * Invariants:
 * - List endpoint returns paginated `CompanyNewsPostListPageOut` (items wrapper), not a bare array.
 *
 * Related:
 * - shared/api/routers/product_desktop_news.py, feature.feed.FeedRepository
 */
package world.empery.mobile.core.network.api

import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

/** Published EWDesk post; mirrors `CompanyNewsPostOut`. */
data class EwDeskNewsPostDto(
    val id: String,
    val title: String,
    val body: String,
    val pinned: Boolean = false,
    val published_at: String? = null,
    val created_at: String,
    val updated_at: String,
    val image_url: String? = null,
    val image_content_id: String? = null,
    val video_content_id: String? = null,
    val audio_content_id: String? = null,
)

/** Feed list row; mirrors `CompanyNewsPostListItemOut` (body is excerpt in list). */
data class EwDeskNewsListItemDto(
    val id: String,
    val title: String,
    val body_excerpt: String? = null,
    val pinned: Boolean = false,
    val published_at: String? = null,
    val created_at: String,
    val updated_at: String,
    val image_url: String? = null,
    val image_content_id: String? = null,
    val video_content_id: String? = null,
    val audio_content_id: String? = null,
)

/** Paginated EWDesk list; mirrors `CompanyNewsPostListPageOut`. */
data class EwDeskNewsListPageDto(
    val items: List<EwDeskNewsListItemDto> = emptyList(),
    val total: Int = 0,
    val limit: Int = 0,
    val offset: Int = 0,
    val next_cursor: String? = null,
)

interface EwDeskApi {
    @GET("product-desktop/news")
    suspend fun getNewsPage(
        @Query("limit") limit: Int = 200,
        @Query("cursor") cursor: String? = null,
    ): EwDeskNewsListPageDto

    @GET("product-desktop/news/{postId}")
    suspend fun getNewsPost(@Path("postId") postId: String): EwDeskNewsPostDto
}
