/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Retry transient transport failures for idempotent HTTP GET up to [maxRetries] times.
 *
 * Invariants:
 * - Only GET; never retries mutating methods.
 * - Only [MobileNetworkFailureSupport.isTransientNetworkFailure] IOExceptions are retried.
 *
 * Related:
 * - NetworkFactory, MobileNetworkFailureSupport, AuthAwareHttp
 */
package world.empery.mobile.core.network

import java.io.IOException
import okhttp3.Interceptor
import okhttp3.Response

/**
 * Global OkHttp application interceptor: up to [maxRetries] extra attempts on transient GET failures.
 */
class IdempotentGetRetryInterceptor(
    private val maxRetries: Int = DEFAULT_MAX_RETRIES,
    private val baseDelayMs: Long = DEFAULT_BASE_DELAY_MS,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        if (!request.method.equals("GET", ignoreCase = true)) {
            return chain.proceed(request)
        }
        var attempt = 0
        var lastError: IOException? = null
        while (attempt <= maxRetries) {
            try {
                return chain.proceed(request)
            } catch (error: IOException) {
                lastError = error
                val retryable =
                    MobileNetworkFailureSupport.isTransientNetworkFailure(error) &&
                        attempt < maxRetries
                if (!retryable) {
                    throw error
                }
                val sleepMs = baseDelayMs * (attempt + 1L)
                try {
                    Thread.sleep(sleepMs.coerceAtMost(MAX_SLEEP_MS))
                } catch (_: InterruptedException) {
                    Thread.currentThread().interrupt()
                    throw error
                }
                attempt += 1
            }
        }
        throw lastError ?: IOException("GET retry exhausted without exception")
    }

    companion object {
        const val DEFAULT_MAX_RETRIES: Int = 2
        const val DEFAULT_BASE_DELAY_MS: Long = 300L
        private const val MAX_SLEEP_MS: Long = 2_000L
    }
}
