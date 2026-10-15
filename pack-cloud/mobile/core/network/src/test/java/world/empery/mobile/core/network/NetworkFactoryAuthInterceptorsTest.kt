package world.empery.mobile.core.network

import okhttp3.OkHttpClient
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NetworkFactoryAuthInterceptorsTest {
    private val tokenProvider =
        object : AccessTokenProvider, TokenExpiryProvider {
            override fun accessToken(): String? = "access-token"

            override fun expiresAtEpochSeconds(): Long? = null
        }

    private val refresher =
        object : TokenRefresher {
            override suspend fun refreshAccessToken(): String? = null
        }

    @Test
    fun createRetrofit_disablesAuthInterceptorsWhenRequested() {
        val retrofit =
            NetworkFactory.createRetrofit(
                baseUrl = "https://app.eliteew.ru/api/v1/",
                tokenProvider = tokenProvider,
                tokenRefresher = refresher,
                authInterceptorsEnabled = false,
            )
        val client = retrofit.callFactory() as OkHttpClient
        val names = client.interceptors.mapNotNull { it::class.simpleName }.toSet()

        assertFalse(names.contains("ProactiveTokenRefreshInterceptor"))
        assertFalse(names.contains("UnauthorizedRetryInterceptor"))
        assertFalse(names.contains("BearerTokenInterceptor"))
        assertTrue(names.contains("IdempotentGetRetryInterceptor"))
    }

    @Test
    fun createRetrofit_enablesAuthInterceptorsByDefault() {
        val retrofit =
            NetworkFactory.createRetrofit(
                baseUrl = "https://app.eliteew.ru/api/v1/",
                tokenProvider = tokenProvider,
                tokenRefresher = refresher,
            )
        val client = retrofit.callFactory() as OkHttpClient
        val names = client.interceptors.mapNotNull { it::class.simpleName }.toSet()

        assertTrue(names.contains("ProactiveTokenRefreshInterceptor"))
        assertTrue(names.contains("UnauthorizedRetryInterceptor"))
        assertTrue(names.contains("BearerTokenInterceptor"))
        assertTrue(names.contains("IdempotentGetRetryInterceptor"))
    }

    @Test
    fun createRetrofit_appliesCustomClientConfigurationBeforeAuthInterceptors() {
        val retrofit =
            NetworkFactory.createRetrofit(
                baseUrl = "https://app.eliteew.ru/api/v1/",
                tokenProvider = tokenProvider,
                tokenRefresher = refresher,
                configureClient = {
                    addInterceptor { chain -> chain.proceed(chain.request()) }
                },
            )
        val client = retrofit.callFactory() as OkHttpClient
        val names = client.interceptors.map { it::class.simpleName.orEmpty() }

        assertTrue(names.first().isEmpty())
        assertTrue(names.drop(1).contains("IdempotentGetRetryInterceptor"))
        assertTrue(names.drop(1).contains("ProactiveTokenRefreshInterceptor"))
    }
}
