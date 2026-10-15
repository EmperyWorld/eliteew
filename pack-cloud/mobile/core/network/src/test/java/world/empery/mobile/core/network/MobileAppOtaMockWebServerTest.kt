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
import world.empery.mobile.core.network.api.MobileAppApi

/** MockWebServer test for OTA overview manifest contract (mobile-app/overview). */
class MobileAppOtaMockWebServerTest {
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
    fun overviewReturnsVersionAndShaForOtaCheck() = runBlocking {
        server.enqueue(
            MockResponse().setBody(
                """
                {
                  "download_page_url": "https://app.eliteew.ru/mobile-app/",
                  "download_api_path": "/api/v1/mobile-app/download",
                  "apk_available": true,
                  "apk_size_bytes": 50000000,
                  "version_code": 41,
                  "version_name": "0.2.31",
                  "apk_sha256": "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"
                }
                """.trimIndent(),
            ),
        )
        val api = retrofit().create(MobileAppApi::class.java)
        val overview = api.getOverview()
        assertTrue(overview.apkAvailable)
        assertEquals(41, overview.versionCode)
        assertEquals("0.2.31", overview.versionName)
        assertEquals("/api/v1/mobile-app/overview", server.takeRequest().path)
    }

    private fun retrofit(): Retrofit =
        Retrofit.Builder()
            .baseUrl(server.url("/api/v1/"))
            .addConverterFactory(GsonConverterFactory.create())
            .build()
}
