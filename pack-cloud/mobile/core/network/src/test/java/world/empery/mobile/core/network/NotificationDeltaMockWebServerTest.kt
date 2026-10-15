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
import world.empery.mobile.core.network.api.ProfileApi

/** MockWebServer test for notification-center delta refresh path. */
class NotificationDeltaMockWebServerTest {
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
    fun deltaEndpointReturnsUnchangedFlag() = runBlocking {
        server.enqueue(
            MockResponse().setBody(
                """{"items":[],"updated_at":"2026-06-02T10:00:00+00:00","unchanged":true}""",
            ),
        )
        val api = retrofit().create(ProfileApi::class.java)
        val delta = api.getNotificationCenterDelta(since = "2026-06-02T09:00:00+00:00")
        assertTrue(delta.unchanged)
        val request = server.takeRequest()
        assertTrue(request.path!!.contains("profile/notification-center/delta"))
        assertTrue(request.path!!.contains("since="))
    }

    @Test
    fun deltaEndpointReturnsNewItemsWhenChanged() = runBlocking {
        server.enqueue(
            MockResponse().setBody(
                """
                {
                  "items": [{"id":"n-1","source":"system","type":"info","title":"Hi","message":"Hello","timestamp":"2026-06-02T10:01:00+00:00"}],
                  "updated_at": "2026-06-02T10:01:00+00:00",
                  "unchanged": false
                }
                """.trimIndent(),
            ),
        )
        val api = retrofit().create(ProfileApi::class.java)
        val delta = api.getNotificationCenterDelta(since = "2026-06-02T10:00:00+00:00")
        assertEquals(1, delta.items.size)
        assertEquals(false, delta.unchanged)
    }

    private fun retrofit(): Retrofit =
        Retrofit.Builder()
            .baseUrl(server.url("/api/v1/"))
            .addConverterFactory(GsonConverterFactory.create())
            .build()
}
