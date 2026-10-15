/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Fetch mobile-app overview and download authenticated production APK for sideload update.
 *
 * Invariants:
 * - Download uses the same Bearer-authenticated OkHttp stack as Retrofit API calls.
 * - Interrupted downloads keep `.part` and resume via HTTP Range when supported.
 *
 * Related:
 * - world.empery.mobile.core.network.api.MobileAppApi, MobileApkInstaller
 */
package feature.profile

import android.content.Context
import android.os.Environment
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import world.empery.mobile.core.network.api.MobileAppApi
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit

class MobileAppUpdateRepository(
    private val api: MobileAppApi,
    private val okHttpClient: OkHttpClient,
    private val apiRoot: String,
) {
    suspend fun fetchOverview(installedVersionCode: Int? = null) =
        api.getOverview(installedVersionCode = installedVersionCode)

    suspend fun submitSupportReport(
        bundleText: String,
        category: String = "general",
        appVersionName: String?,
        appVersionCode: Int?,
        deviceModel: String?,
    ) = api.submitSupportReport(
        world.empery.mobile.core.network.api.MobileSupportReportCreateBody(
            bundleText = bundleText,
            category = category,
            appVersionName = appVersionName,
            appVersionCode = appVersionCode,
            deviceModel = deviceModel,
        ),
    )

    fun findPartialDownload(updatesDir: File, versionCode: Int): PartialApkDownload? {
        if (!updatesDir.isDirectory) return null
        val finalFile = MobileAppUpdateDownloadSupport.finalApkFile(updatesDir, versionCode)
        if (finalFile.isFile && finalFile.length() > 0L) return null
        val part = MobileAppUpdateDownloadSupport.partialApkFile(updatesDir, versionCode)
        if (!part.isFile || part.length() <= 0L) return null
        return PartialApkDownload(
            versionCode = versionCode,
            partFile = part,
            downloadedBytes = part.length(),
        )
    }

    fun updatesDir(context: Context): File? =
        context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)?.resolve("updates")

    fun verifyApkFile(file: File, expectedSha256: String?): Boolean {
        if (!file.isFile || file.length() <= 0L) return false
        val expected = expectedSha256?.trim()?.lowercase().orEmpty()
        if (expected.length != 64) return true
        return MobileAppUpdateHash.matchesExpected(MobileAppUpdateHash.sha256Hex(file), expected)
    }

    suspend fun downloadApk(
        context: Context,
        serverVersionCode: Int,
        expectedTotalBytes: Long? = null,
        expectedSha256: String? = null,
        onProgress: (downloadedBytes: Long, totalBytes: Long?) -> Unit,
    ): File =
        withContext(Dispatchers.IO) {
            val updatesDir =
                updatesDir(context)
                    ?: throw IllegalStateException("External downloads dir unavailable")
            if (!updatesDir.exists()) {
                updatesDir.mkdirs()
            }
            val target = MobileAppUpdateDownloadSupport.finalApkFile(updatesDir, serverVersionCode)
            val part = MobileAppUpdateDownloadSupport.partialApkFile(updatesDir, serverVersionCode)

            if (target.isFile && target.length() > 0L) {
                val sizeOk = expectedTotalBytes == null || target.length() >= expectedTotalBytes
                val hashOk = verifyApkFile(target, expectedSha256)
                if (sizeOk && hashOk) {
                    onProgress(target.length(), expectedTotalBytes ?: target.length())
                    part.delete()
                    return@withContext target
                }
                target.delete()
            }

            val downloadUrl = apiRoot.trimEnd('/') + "/mobile-app/download"
            require(MobileAppUpdateDownloadSupport.isProtectedMobileAppDownloadAllowed(apiRoot, "/mobile-app/download")) {
                "Refusing unprotected APK download URL"
            }
            val client =
                okHttpClient.newBuilder()
                    .connectTimeout(3, TimeUnit.MINUTES)
                    .readTimeout(15, TimeUnit.MINUTES)
                    .writeTimeout(15, TimeUnit.MINUTES)
                    .callTimeout(20, TimeUnit.MINUTES)
                    .build()

            var attempt = 0
            var lastError: Throwable? = null
            while (attempt < MobileAppUpdateDownloadSupport.MAX_DOWNLOAD_ATTEMPTS) {
                attempt += 1
                val existingBytes = if (part.isFile) part.length().coerceAtLeast(0L) else 0L
                if (existingBytes > 0L) {
                    onProgress(existingBytes, expectedTotalBytes)
                }
                try {
                    downloadAttempt(
                        client = client,
                        downloadUrl = downloadUrl,
                        target = target,
                        part = part,
                        existingBytes = existingBytes,
                        expectedTotalBytes = expectedTotalBytes,
                        onProgress = onProgress,
                    )
                    lastError = null
                    break
                } catch (err: Throwable) {
                    lastError = err
                    val partialBytes = if (part.isFile) part.length() else 0L
                    Log.w(
                        TAG,
                        "APK download attempt $attempt failed at $partialBytes bytes: ${err.message}",
                        err,
                    )
                    if (!MobileAppUpdateDownloadSupport.isRetryableDownloadFailure(err)) {
                        throw err
                    }
                    if (attempt >= MobileAppUpdateDownloadSupport.MAX_DOWNLOAD_ATTEMPTS) {
                        break
                    }
                    delay(MobileAppUpdateDownloadSupport.retryDelayMs(attempt - 1))
                }
            }

            lastError?.let { throw it }

            if (!target.isFile || target.length() <= 0L) {
                throw IllegalStateException("Downloaded APK is empty")
            }
            if (!verifyApkFile(target, expectedSha256)) {
                target.delete()
                part.delete()
                throw IllegalStateException("APK hash mismatch — файл повреждён или подменён")
            }
            target
        }

    private fun downloadAttempt(
        client: OkHttpClient,
        downloadUrl: String,
        target: File,
        part: File,
        existingBytes: Long,
        expectedTotalBytes: Long?,
        onProgress: (downloadedBytes: Long, totalBytes: Long?) -> Unit,
    ) {
        var offset = existingBytes.coerceAtLeast(0L)
        var totalBytes = expectedTotalBytes?.takeIf { it > 0L }
        var chunkIndex = 0
        var finished = false

        while (!finished) {
            if (totalBytes != null && offset >= totalBytes) break

            val chunkEndExclusive =
                if (totalBytes != null) {
                    minOf(offset + MobileAppUpdateDownloadSupport.DOWNLOAD_CHUNK_BYTES, totalBytes)
                } else {
                    offset + MobileAppUpdateDownloadSupport.DOWNLOAD_CHUNK_BYTES
                }
            val rangeEndInclusive = chunkEndExclusive - 1L
            if (rangeEndInclusive < offset) break

            val request =
                Request.Builder()
                    .url(downloadUrl)
                    .header(
                        "Range",
                        MobileAppUpdateDownloadSupport.buildRangeHeader(offset, rangeEndInclusive),
                    )
                    .get()
                    .build()

            client.newCall(request).execute().use { response ->
                when (response.code) {
                    416 -> {
                        if (offset <= 0L) {
                            part.delete()
                            throw IOException("APK download range not satisfiable (HTTP 416)")
                        }
                        Log.w(TAG, "APK range 416 at offset $offset; restarting from byte 0")
                        part.delete()
                        offset = 0L
                        totalBytes = expectedTotalBytes
                        chunkIndex = 0
                        return@use
                    }
                    200, 206 -> Unit
                    else ->
                        throw IllegalStateException("APK download failed: HTTP ${response.code}")
                }

                val body = response.body ?: throw IllegalStateException("APK download body empty")
                val append = response.code == 206 && offset > 0L
                if (response.code == 200) {
                    if (offset > 0L) {
                        Log.i(TAG, "Server returned full file (HTTP 200); restarting APK download from byte 0")
                        part.delete()
                        offset = 0L
                    }
                    totalBytes =
                        MobileAppUpdateDownloadSupport.resolveTotalBytes(
                            contentRange = response.header("Content-Range"),
                            contentLength = body.contentLength(),
                            existingBytes = 0L,
                            statusCode = response.code,
                        ) ?: totalBytes
                    writeResponseBodyToPart(body, part, append = false, onChunk = { written ->
                        onProgress(written, totalBytes)
                    })
                    offset = part.length()
                    finished = true
                    return@use
                }

                totalBytes =
                    MobileAppUpdateDownloadSupport.resolveTotalBytes(
                        contentRange = response.header("Content-Range"),
                        contentLength = body.contentLength(),
                        existingBytes = offset,
                        statusCode = response.code,
                    ) ?: totalBytes

                val bytesBefore = part.length()
                writeResponseBodyToPart(body, part, append = append) { written ->
                    onProgress(written, totalBytes)
                }
                val bytesAfter = part.length()
                if (bytesAfter <= bytesBefore) {
                    throw IOException("APK chunk $chunkIndex produced no bytes at offset $offset")
                }
                offset = bytesAfter
            }

            chunkIndex += 1
            val resolvedTotalBytes = totalBytes
            if (resolvedTotalBytes != null && offset >= resolvedTotalBytes) break
        }

        if (part.length() <= 0L) {
            part.delete()
            throw IllegalStateException("Downloaded APK is empty")
        }

        val resolvedTotalBytes = totalBytes
        if (resolvedTotalBytes != null && resolvedTotalBytes > 0L && part.length() > resolvedTotalBytes) {
            part.delete()
            throw IllegalStateException("Downloaded APK exceeds expected size")
        }

        if (target.exists() && !target.delete()) {
            throw IllegalStateException("Cannot replace previous APK file")
        }
        if (!part.renameTo(target)) {
            part.copyTo(target, overwrite = true)
            part.delete()
        }
    }

    private fun writeResponseBodyToPart(
        body: okhttp3.ResponseBody,
        part: File,
        append: Boolean,
        onChunk: (downloadedBytes: Long) -> Unit,
    ) {
        body.byteStream().use { input ->
            java.io.FileOutputStream(part, append).use { output ->
                val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                while (true) {
                    val read = input.read(buffer)
                    if (read <= 0) break
                    output.write(buffer, 0, read)
                    onChunk(part.length())
                }
                output.flush()
            }
        }
    }

    companion object {
        private const val TAG = "MobileAppUpdateRepo"
    }
}

data class PartialApkDownload(
    val versionCode: Int,
    val partFile: File,
    val downloadedBytes: Long,
)
