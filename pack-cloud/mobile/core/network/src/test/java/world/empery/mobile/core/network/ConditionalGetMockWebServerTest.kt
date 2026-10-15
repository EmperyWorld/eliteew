package world.empery.mobile.core.network

import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import world.empery.mobile.core.network.api.DesktopApi
import world.empery.mobile.core.network.api.FriendsApi
import world.empery.mobile.core.network.api.FriendsOverviewResponse

/** MockWebServer contract tests for ETag / 304 conditional GET branches. */
class ConditionalGetMockWebServerTest {
    private lateinit var server: MockWebServer

    @Before
    fun setup() {
        server = MockWebServer()
        server.start()
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun friendsOverviewConditional_sendsIfNoneMatchAndHandles304() = runBlocking {
        server.enqueue(MockResponse().setResponseCode(304))
        val api = retrofit().create(FriendsApi::class.java)
        val cached = FriendsOverviewResponse(
            friends = emptyList(),
            incoming_requests = emptyList(),
            sent_requests = emptyList(),
        )
        val etag = """"etag-friends""""
        val response = api.getOverviewConditional(ifNoneMatch = etag)
        assertTrue(HttpEtagSupport.isNotModified(response))
        val resolved = resolveConditionalGet(response, cached, onEtag = {})
        assertEquals(cached, resolved)
        val request = server.takeRequest()
        assertEquals(etag, request.getHeader("If-None-Match"))
    }

    @Test
    fun desktopConfigConditional_returnsBodyAndEtagOn200() = runBlocking {
        val body = """
            {"id":"cfg","user_id":"u","wallpaper":null,"icon_size":null,"theme":"dark","accent_color":null,"show_widget":true}
        """.trimIndent()
        val cfgEtag = """"cfg-etag""""
        server.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setHeader("ETag", cfgEtag)
                .setBody(body),
        )
        val api = retrofit().create(DesktopApi::class.java)
        val response = api.getConfigConditional(ifNoneMatch = null)
        var capturedEtag: String? = null
        val resolved = resolveConditionalGet(response, cached = null, onEtag = { capturedEtag = it })
        assertEquals("cfg", resolved.id)
        assertEquals("dark", resolved.theme)
        assertEquals(cfgEtag, capturedEtag)
    }

    @Test
    fun etagInterceptor_allowlistsProfileMeAndSendsIfNoneMatch() {
        val store = ETagMemoryStore()
        store.put(server.url("/api/v1/profile/me").toString(), """"me-1"""")
        server.enqueue(MockResponse().setResponseCode(304))
        val client =
            okhttp3.OkHttpClient.Builder()
                .addInterceptor(ConditionalGetEtagInterceptor(store = store))
                .build()
        val request =
            okhttp3.Request.Builder()
                .url(server.url("/api/v1/profile/me"))
                .get()
                .build()
        val response = client.newCall(request).execute()
        assertEquals(304, response.code)
        response.close()
        val recorded = server.takeRequest()
        assertEquals(""""me-1"""", recorded.getHeader("If-None-Match"))
    }

    @Test
    fun etagInterceptor_skipsWhenHeaderAlreadyPresent() {
        val store = ETagMemoryStore()
        store.put(server.url("/api/v1/friends/overview").toString(), """"store-etag"""")
        server.enqueue(MockResponse().setResponseCode(304))
        val client =
            okhttp3.OkHttpClient.Builder()
                .addInterceptor(ConditionalGetEtagInterceptor(store = store))
                .build()
        val request =
            okhttp3.Request.Builder()
                .url(server.url("/api/v1/friends/overview"))
                .header("If-None-Match", """"explicit"""")
                .get()
                .build()
        client.newCall(request).execute().close()
        val recorded = server.takeRequest()
        assertEquals(""""explicit"""", recorded.getHeader("If-None-Match"))
    }

    @Test
    fun profileMeConditional_304ReusesCachedDto() = runBlocking {
        server.enqueue(MockResponse().setResponseCode(304))
        val api = retrofit().create(world.empery.mobile.core.network.api.ProfileApi::class.java)
        val cached =
            world.empery.mobile.core.network.api.ProfileMeResponse(
                id = "u1",
                email = "a@b.c",
                username = "u",
                full_name = "N",
                avatar_url = null,
            )
        val response = api.getMeConditional(ifNoneMatch = """"p"""" )
        val resolved = resolveConditionalGet(response, cached, onEtag = {})
        assertEquals(cached, resolved)
    }

    private fun retrofit(): Retrofit =
        Retrofit.Builder()
            .baseUrl(server.url("/api/v1/"))
            .addConverterFactory(GsonConverterFactory.create())
            .build()
}
