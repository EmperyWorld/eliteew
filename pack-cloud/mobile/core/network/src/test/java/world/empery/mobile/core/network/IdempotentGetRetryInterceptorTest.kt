/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Verifies IdempotentGetRetryInterceptor retries transient GET IOExceptions.
 *
 * Invariants:
 * - Non-GET methods are never retried.
 *
 * Related:
 * - IdempotentGetRetryInterceptor, MobileNetworkFailureSupport
 */
package world.empery.mobile.core.network

import java.io.IOException
import java.net.SocketTimeoutException
import java.util.concurrent.atomic.AtomicInteger
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test

class IdempotentGetRetryInterceptorTest {
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
    fun getRetriesTransientIoThenSucceeds() {
        val attempts = AtomicInteger(0)
        val flaky =
            Interceptor { chain ->
                val n = attempts.incrementAndGet()
                if (n < 3) {
                    throw SocketTimeoutException("simulated timeout #$n")
                }
                chain.proceed(chain.request())
            }
        server.enqueue(MockResponse().setBody("ok").setResponseCode(200))

        val client =
            OkHttpClient.Builder()
                .addInterceptor(IdempotentGetRetryInterceptor(maxRetries = 2, baseDelayMs = 1L))
                .addInterceptor(flaky)
                .build()

        val response =
            client.newCall(Request.Builder().url(server.url("/v1/ping")).get().build()).execute()
        assertEquals(200, response.code)
        assertEquals(3, attempts.get())
        response.close()
    }

    @Test
    fun postIsNotRetried() {
        val attempts = AtomicInteger(0)
        val flaky =
            Interceptor { chain ->
                attempts.incrementAndGet()
                throw SocketTimeoutException("post should not retry")
            }
        val client =
            OkHttpClient.Builder()
                .addInterceptor(IdempotentGetRetryInterceptor(maxRetries = 2, baseDelayMs = 1L))
                .addInterceptor(flaky)
                .build()

        try {
            client.newCall(
                Request.Builder()
                    .url(server.url("/v1/ping"))
                    .post(ByteArray(0).toRequestBody("application/octet-stream".toMediaTypeOrNull()))
                    .build(),
            ).execute()
            fail("expected IOException")
        } catch (error: IOException) {
            assertTrue(error is SocketTimeoutException)
        }
        assertEquals(1, attempts.get())
    }
}
