/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lightweight unauthenticated probe for EliteEW perimeter reachability via public /api/health.
 *
 * Invariants:
 * - No Bearer token; short timeout; does not log response bodies.
 *
 * Related:
 * - feature.profile.PerimeterAccessRepository, documentation/product/mobile/MOBILE-PERIMETER-ACCESS.md
 */
package world.empery.mobile.core.network

import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.IOException
import java.net.SocketTimeoutException
import java.util.concurrent.TimeUnit

enum class PerimeterProbeOutcome {
    Open,
    Closed,
    NoNetwork,
    Error,
}

data class PerimeterProbeResult(
    val outcome: PerimeterProbeOutcome,
    val httpStatus: Int? = null,
)

class PerimeterAccessProbe(
    private val healthUrl: String,
    client: OkHttpClient? = null,
) {
    private val httpClient: OkHttpClient =
        client
            ?: OkHttpClient.Builder()
                .connectTimeout(PROBE_TIMEOUT_SEC, TimeUnit.SECONDS)
                .readTimeout(PROBE_TIMEOUT_SEC, TimeUnit.SECONDS)
                .writeTimeout(PROBE_TIMEOUT_SEC, TimeUnit.SECONDS)
                .callTimeout(PROBE_TIMEOUT_SEC, TimeUnit.SECONDS)
                .followRedirects(true)
                .build()

    fun probeSync(networkValidated: Boolean): PerimeterProbeResult {
        if (!networkValidated) {
            return PerimeterProbeResult(PerimeterProbeOutcome.NoNetwork)
        }
        val request =
            Request.Builder()
                .url(healthUrl)
                .get()
                .header("Accept", "application/json")
                .build()
        return try {
            httpClient.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    PerimeterProbeResult(PerimeterProbeOutcome.Open, response.code)
                } else {
                    PerimeterProbeResult(PerimeterProbeOutcome.Closed, response.code)
                }
            }
        } catch (_: SocketTimeoutException) {
            PerimeterProbeResult(PerimeterProbeOutcome.Closed)
        } catch (_: IOException) {
            PerimeterProbeResult(PerimeterProbeOutcome.Closed)
        } catch (_: Throwable) {
            PerimeterProbeResult(PerimeterProbeOutcome.Error)
        }
    }

    companion object {
        private const val PROBE_TIMEOUT_SEC = 5L

        fun healthUrlFromApiBase(apiBase: String): String {
            val trimmed = apiBase.trim().trimEnd('/')
            val root =
                trimmed.substringBeforeLast("/api/")
                    .ifBlank { trimmed.removeSuffix("/api/v1").removeSuffix("/api") }
                    .trimEnd('/')
            return "$root/api/health"
        }
    }
}
