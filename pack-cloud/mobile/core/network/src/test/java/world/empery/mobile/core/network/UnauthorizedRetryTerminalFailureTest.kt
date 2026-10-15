/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Verifies terminal 401 after failed refresh invokes [TokenRefresher.onTerminalAuthFailure].
 *
 * Invariants:
 * - Single retry only; second 401 must not loop refresh.
 *
 * Related:
 * - UnauthorizedRetryInterceptor, AuthRepository.onTerminalAuthFailure
 */
package world.empery.mobile.core.network

import java.util.concurrent.atomic.AtomicInteger
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class UnauthorizedRetryTerminalFailureTest {
    private lateinit var server: MockWebServer

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun second401AfterFailedRefresh_invokesTerminalAuthFailure() {
        server.enqueue(MockResponse().setResponseCode(401))
        server.enqueue(MockResponse().setResponseCode(401))

        val terminalCalls = AtomicInteger(0)
        val tokenProvider =
            object : AccessTokenProvider {
                override fun accessToken(): String? = "stale-access"
            }
        val refresher =
            object : TokenRefresher {
                override suspend fun refreshAccessToken(): String? = null

                override suspend fun refreshAccessTokenDetailed(): AccessTokenRefreshResult =
                    AccessTokenRefreshResult.FailedAuth

                override suspend fun onTerminalAuthFailure() {
                    terminalCalls.incrementAndGet()
                }
            }

        val client =
            AuthAwareHttp.configureAuthApplicationInterceptors(
                OkHttpClient.Builder(),
                tokenProvider = tokenProvider,
                expiryProvider =
                    object : TokenExpiryProvider {
                        override fun expiresAtEpochSeconds(): Long? = null
                    },
                tokenRefresher = refresher,
            ).build()

        val response =
            client.newCall(
                Request.Builder().url(server.url("/api/v1/mobile-app/ping")).build(),
            ).execute()

        assertEquals(401, response.code)
        assertTrue(response.authAwareTerminal() is AuthAwareTerminal.RefreshFailed)
        assertEquals(1, terminalCalls.get())
        assertEquals(2, server.requestCount)
    }

    @Test
    fun transientRefreshFailure_doesNotInvokeTerminalAuthFailure() {
        server.enqueue(MockResponse().setResponseCode(401))
        server.enqueue(MockResponse().setResponseCode(401))

        val terminalCalls = AtomicInteger(0)
        val transientCalls = AtomicInteger(0)
        val tokenProvider =
            object : AccessTokenProvider {
                override fun accessToken(): String? = "stale-access"
            }
        val refresher =
            object : TokenRefresher {
                override suspend fun refreshAccessToken(): String? = null

                override suspend fun refreshAccessTokenDetailed(): AccessTokenRefreshResult =
                    AccessTokenRefreshResult.FailedTransient

                override suspend fun onTerminalAuthFailure() {
                    terminalCalls.incrementAndGet()
                }

                override suspend fun onTransientNetworkDuringRefresh() {
                    transientCalls.incrementAndGet()
                }
            }

        val client =
            AuthAwareHttp.configureAuthApplicationInterceptors(
                OkHttpClient.Builder(),
                tokenProvider = tokenProvider,
                expiryProvider =
                    object : TokenExpiryProvider {
                        override fun expiresAtEpochSeconds(): Long? = null
                    },
                tokenRefresher = refresher,
            ).build()

        val response =
            client.newCall(
                Request.Builder().url(server.url("/api/v1/gaf-chat/chats")).build(),
            ).execute()

        assertEquals(401, response.code)
        assertTrue(response.authAwareTerminal() is AuthAwareTerminal.TransientNetworkDuringRefresh)
        assertEquals(0, terminalCalls.get())
        assertEquals(1, transientCalls.get())
        assertEquals(2, server.requestCount)
    }

    @Test
    fun second401OnNonSensitivePath_doesNotInvokeTerminalAuthFailure() {
        server.enqueue(MockResponse().setResponseCode(401))
        server.enqueue(MockResponse().setResponseCode(401))

        val terminalCalls = AtomicInteger(0)
        val tokenProvider =
            object : AccessTokenProvider {
                override fun accessToken(): String? = "stale-access"
            }
        val refresher =
            object : TokenRefresher {
                override suspend fun refreshAccessToken(): String? = null

                override suspend fun onTerminalAuthFailure() {
                    terminalCalls.incrementAndGet()
                }
            }

        val client =
            AuthAwareHttp.configureAuthApplicationInterceptors(
                OkHttpClient.Builder(),
                tokenProvider = tokenProvider,
                expiryProvider =
                    object : TokenExpiryProvider {
                        override fun expiresAtEpochSeconds(): Long? = null
                    },
                tokenRefresher = refresher,
            ).build()

        val response =
            client.newCall(
                Request.Builder().url(server.url("/assets/private-image")).build(),
            ).execute()

        assertEquals(401, response.code)
        assertEquals(null, response.authAwareTerminal())
        assertEquals(0, terminalCalls.get())
        assertEquals(2, server.requestCount)
    }
}
