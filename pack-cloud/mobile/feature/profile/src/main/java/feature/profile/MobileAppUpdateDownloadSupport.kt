/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for resumable mobile APK downloads (Range headers, progress, retry backoff).
 *
 * Invariants:
 * - Partial files use suffix `.part`; completed APK has no suffix.
 *
 * Related:
 * - MobileAppUpdateRepository, ProfileTabViewModel
 */
package feature.profile

import java.io.File
import kotlin.math.min
import kotlin.math.pow

object MobileAppUpdateDownloadSupport {

    /** security-002: only HTTPS API-root mobile-app download path is allowed. */
    fun isProtectedMobileAppDownloadAllowed(apiRoot: String, downloadPath: String = "/mobile-app/download"): Boolean {
        val root = apiRoot.trim().lowercase()
        val path = downloadPath.trim()
        if (!root.startsWith("https://")) return false
        if (!path.startsWith("/mobile-app/")) return false
        if (root.contains("@") || root.contains(" ")) return false
        return true
    }


    const val PART_SUFFIX = ".part"
    const val MAX_DOWNLOAD_ATTEMPTS = 5
    const val INITIAL_RETRY_DELAY_MS = 1_500L
    /** Single HTTP request size — survives edge/tunnel idle limits; resume uses the next Range. */
    const val DOWNLOAD_CHUNK_BYTES = 1_048_576L

    fun apkFileName(versionCode: Int): String = "empery-mobile-v$versionCode.apk"

    fun partialFileName(versionCode: Int): String = "${apkFileName(versionCode)}$PART_SUFFIX"

    fun finalApkFile(updatesDir: File, versionCode: Int): File =
        File(updatesDir, apkFileName(versionCode))

    fun partialApkFile(updatesDir: File, versionCode: Int): File =
        File(updatesDir, partialFileName(versionCode))

    fun buildRangeHeader(fromByte: Long, toByteInclusive: Long? = null): String =
        if (toByteInclusive != null) {
            "bytes=$fromByte-$toByteInclusive"
        } else {
            "bytes=$fromByte-"
        }

    fun parseTotalBytesFromContentRange(contentRange: String?): Long? {
        val raw = contentRange?.trim().orEmpty()
        if (raw.isEmpty()) return null
        val slash = raw.lastIndexOf('/')
        if (slash < 0 || slash >= raw.length - 1) return null
        val totalToken = raw.substring(slash + 1).trim()
        if (totalToken == "*") return null
        return totalToken.toLongOrNull()?.takeIf { it > 0L }
    }

    fun resolveTotalBytes(
        contentRange: String?,
        contentLength: Long,
        existingBytes: Long,
        statusCode: Int,
    ): Long? {
        parseTotalBytesFromContentRange(contentRange)?.let { return it }
        if (contentLength <= 0L) return null
        return when (statusCode) {
            206 -> existingBytes + contentLength
            200 -> contentLength
            else -> null
        }
    }

    fun computeProgress(downloadedBytes: Long, totalBytes: Long?): Float? {
        if (totalBytes == null || totalBytes <= 0L) return null
        return (downloadedBytes.toFloat() / totalBytes.toFloat()).coerceIn(0f, 1f)
    }

    fun retryDelayMs(attemptIndex: Int): Long {
        val capped = min(attemptIndex, 4)
        return (INITIAL_RETRY_DELAY_MS * 2.0.pow(capped.toDouble())).toLong()
    }

    fun isRetryableDownloadFailure(error: Throwable): Boolean {
        if (error is java.util.concurrent.CancellationException) return false
        if (error is IllegalStateException) {
            val msg = error.message.orEmpty()
            if (msg.startsWith("APK download failed: HTTP")) return false
            if (msg.contains("empty", ignoreCase = true)) return false
            if (msg.contains("exceeds expected size", ignoreCase = true)) return false
        }
        return true
    }
}
