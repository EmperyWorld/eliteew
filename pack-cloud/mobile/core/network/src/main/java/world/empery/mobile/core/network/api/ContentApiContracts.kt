package world.empery.mobile.core.network.api

import okhttp3.MultipartBody
import okhttp3.ResponseBody
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query
import retrofit2.http.Streaming
import world.empery.mobile.core.network.UnifiedContentUrls

/** Subset of unified `Content` response used after multipart upload. */
data class UnifiedContentUploadResponseDto(
    val id: String,
    val name: String? = null,
    val mime_type: String? = null,
)

data class UnifiedContentDto(
    val id: String,
    val name: String,
    val mime_type: String?,
    val created_at: String?,
    val file_size: Long?,
    val metadata: Map<String, Any?>? = null,
    /** Present when API has a stored preview derivative (`GET .../thumbnail`). */
    val thumbnail_url: String? = null,
    /**
     * Optional integrity flag when present on the wire.
     * Default content lists exclude `broken_quarantined`; still gate client probes if the field appears.
     */
    val storage_integrity_status: String? = null,
)

/** True when the client may build a GET `/thumbnail` URL for this row. */
fun UnifiedContentDto.allowsStoredThumbnailFetch(): Boolean {
    val status = storage_integrity_status?.trim().orEmpty()
    if (status.equals("broken_quarantined", ignoreCase = true)) return false
    return !thumbnail_url.isNullOrBlank()
}

/** Absolute `/content/{id}/thumbnail` URL, or null when [allowsStoredThumbnailFetch] is false. */
fun UnifiedContentDto.storedThumbnailAbsoluteUrl(apiBaseUrl: String): String? {
    if (!allowsStoredThumbnailFetch()) return null
    return UnifiedContentUrls.thumbnailUrl(apiBaseUrl, id)
}

data class UnifiedContentListResponse(
    val items: List<UnifiedContentDto>,
    val total: Int,
    val page: Int,
    val page_size: Int,
    val has_more: Boolean,
)

interface UnifiedContentApi {
    @Multipart
    @POST("content")
    suspend fun uploadContent(
        @Part file: MultipartBody.Part,
        @Query("name") name: String? = null,
        @Query("folder_item_id") folderItemId: String? = null,
    ): UnifiedContentUploadResponseDto

    @GET("content")
    suspend fun listContent(
        @Query("source_service") sourceService: String? = null,
        @Query("content_type") contentType: String? = null,
        @Query("search") search: String? = null,
        @Query("owner_only") ownerOnly: Boolean? = null,
        @Query("list_profile") listProfile: String? = null,
        @Query("limit") limit: Int = 50,
        @Query("offset") offset: Int = 0,
        @Query("sort_field") sortField: String = "date",
        @Query("sort_order") sortOrder: String = "desc",
    ): UnifiedContentListResponse

    @DELETE("content/{id}")
    suspend fun deleteContent(@Path("id") id: String)

    @GET("content/{id}/download")
    @Streaming
    suspend fun downloadContent(@Path("id") id: String): ResponseBody
}
