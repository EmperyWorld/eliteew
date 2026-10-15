package world.empery.mobile.core.network

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Test
import world.empery.mobile.core.network.api.UnifiedContentApi
import world.empery.mobile.core.network.api.UnifiedContentDto
import world.empery.mobile.core.network.api.UnifiedContentListResponse
import world.empery.mobile.core.network.api.listAllContent

class UnifiedContentListSupportTest {
    @Test
    fun listAllContent_stopsAtHasMoreAndCap() =
        runBlocking {
            val api =
                object : UnifiedContentApi {
                    var calls = 0

                    override suspend fun uploadContent(
                        file: okhttp3.MultipartBody.Part,
                        name: String?,
                        folderItemId: String?,
                    ) = error("unused")

                    override suspend fun listContent(
                        sourceService: String?,
                        contentType: String?,
                        search: String?,
                        ownerOnly: Boolean?,
                        listProfile: String?,
                        limit: Int,
                        offset: Int,
                        sortField: String,
                        sortOrder: String,
                    ): UnifiedContentListResponse {
                        calls += 1
                        return when (offset) {
                            0 ->
                                UnifiedContentListResponse(
                                    items = List(50) { idx -> item("a-$idx") },
                                    total = 120,
                                    page = 1,
                                    page_size = limit,
                                    has_more = true,
                                )
                            50 ->
                                UnifiedContentListResponse(
                                    items = List(50) { idx -> item("b-$idx") },
                                    total = 120,
                                    page = 2,
                                    page_size = limit,
                                    has_more = true,
                                )
                            else ->
                                UnifiedContentListResponse(
                                    items = emptyList(),
                                    total = 120,
                                    page = 3,
                                    page_size = limit,
                                    has_more = false,
                                )
                        }
                    }

                    override suspend fun deleteContent(id: String) = error("unused")

                    override suspend fun downloadContent(id: String) = error("unused")
                }

            val all = api.listAllContent(maxItems = 80, pageSize = 50)
            assertEquals(80, all.size)
            assertEquals(2, api.calls)
        }

    private fun item(id: String): UnifiedContentDto =
        UnifiedContentDto(
            id = id,
            name = id,
            mime_type = "audio/mpeg",
            created_at = null,
            file_size = 1L,
        )
}
