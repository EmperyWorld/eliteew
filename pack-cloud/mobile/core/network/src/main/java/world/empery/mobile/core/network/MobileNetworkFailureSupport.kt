/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Classify transient transport failures (VPN/tunnel flap, SOCKS proxy, timeouts) for graceful degrade.
 *
 * Invariants:
 * - CancellationException is never treated as a transient network failure.
 *
 * Related:
 * - MobileApp.installGlobalUncaughtExceptionHandler, PerimeterAccessCoordinator, MainViewModel
 */
package world.empery.mobile.core.network

import java.io.IOException
import java.io.InterruptedIOException
import java.net.SocketException
import java.net.SocketTimeoutException
import java.net.UnknownHostException

object MobileNetworkFailureSupport {
    fun isTransientNetworkFailure(throwable: Throwable?): Boolean {
        if (throwable == null) return false
        var current: Throwable? = throwable
        var depth = 0
        while (current != null && depth < 8) {
            if (isCoroutineCancellation(current)) return false
            when (current) {
                is UnknownHostException -> return true
                is SocketTimeoutException -> return true
                is InterruptedIOException -> return true
                is SocketException -> return true
                is IOException -> {
                    val io = current
                    val combined =
                        buildString {
                            append(io.message.orEmpty())
                            io.cause?.message?.let { cause ->
                                if (cause.isNotBlank()) {
                                    append(' ')
                                    append(cause)
                                }
                            }
                        }.lowercase()
                    if (
                        combined.contains("timeout") ||
                        combined.contains("socket closed") ||
                        combined.contains("connection reset") ||
                        combined.contains("broken pipe") ||
                        combined.contains("failed to connect")
                    ) {
                        return true
                    }
                }
            }
            current = current.cause
            depth += 1
        }
        return false
    }

    private fun isCoroutineCancellation(throwable: Throwable): Boolean {
        var current: Throwable? = throwable
        var depth = 0
        while (current != null && depth < 4) {
            val name = current.javaClass.name
            if (name == "kotlinx.coroutines.CancellationException" || name.endsWith(".CancellationException")) {
                return true
            }
            current = current.cause
            depth += 1
        }
        return false
    }
}
