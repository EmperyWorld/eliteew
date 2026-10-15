package world.empery.mobile.core.auth

import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import world.empery.mobile.core.network.api.AuthApi
import world.empery.mobile.core.network.api.SsoLogoutRequest
import world.empery.mobile.core.network.api.TokenRefreshRequest

/**
 * JVM contract test: refresh must hit `/api/auth/refresh` (host root), not under `/api/v1/`.
 * [SecureTokenStore] is not exercised here — EncryptedSharedPreferences is unreliable on Robolectric.
 */
class AuthApiRefreshPathTest {

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
    fun refresh_postsToApiAuthRefresh() = runBlocking {
        server.enqueue(
            MockResponse().setBody(
                """{"access_token":"new_access","refresh_token":"new_refresh","expires_in":3600,"token_type":"Bearer"}""",
            ),
        )

        val retrofit = Retrofit.Builder()
            .baseUrl(server.url("/"))
            .addConverterFactory(GsonConverterFactory.create())
            .build()
        val api = retrofit.create(AuthApi::class.java)
        api.refresh(TokenRefreshRequest(refresh_token = "refresh_tok"))
        assertEquals("/api/auth/refresh", server.takeRequest().path)
    }

    @Test
    fun ssoLogout_postsToApiV1AuthSsoLogout() = runBlocking {
        server.enqueue(
            MockResponse().setBody("{\"message\":\"Logout successful\"}"),
        )
        val retrofit = Retrofit.Builder()
            .baseUrl(server.url("/"))
            .addConverterFactory(GsonConverterFactory.create())
            .build()
        val api = retrofit.create(AuthApi::class.java)
        api.ssoLogout(SsoLogoutRequest(refresh_token = "refresh_tok"))
        val request = server.takeRequest()
        assertEquals("/api/v1/auth/sso/logout", request.path)
        assertEquals("""{"refresh_token":"refresh_tok"}""", request.body.readUtf8())
    }
}
