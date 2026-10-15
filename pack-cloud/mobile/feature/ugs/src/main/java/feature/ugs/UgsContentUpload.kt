/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Multipart upload helper for Unified Content API from device URIs (mobile content library).
 *
 * Invariants:
 * - Images pass through shared WebP compress pipeline; other types upload as-is.
 *
 * Related:
 * - UgsHubRepository, MobileContentLibraryScreen.kt, MobileImageUploadCompress.kt
 */
package feature.ugs

import android.content.ContentResolver
import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okio.BufferedSink
import okio.source
import world.empery.mobile.core.network.api.UnifiedContentApi
import world.empery.mobile.core.network.api.UnifiedContentUploadResponseDto
import world.empery.mobile.core.ui.ImageUploadDraft
import world.empery.mobile.core.ui.prepareMobileImageUploadWebp

suspend fun UnifiedContentApi.uploadFromDeviceUri(
    context: Context,
    uri: Uri,
): UnifiedContentUploadResponseDto =
    withContext(Dispatchers.IO) {
        val appContext = context.applicationContext
        val resolver = appContext.contentResolver
        val mime = resolver.getType(uri)?.takeIf { it.isNotBlank() } ?: "application/octet-stream"
        val displayName =
            queryOpenableDisplayName(resolver, uri)
                ?: "upload-${System.currentTimeMillis()}"

        val prepared =
            if (mime.startsWith("image/", ignoreCase = true)) {
                prepareMobileImageUploadWebp(
                    appContext,
                    ImageUploadDraft(
                        uri = uri.toString(),
                        displayName = displayName,
                        mimeType = mime,
                        sizeBytes = null,
                    ),
                )
            } else {
                null
            }

        try {
            val uploadUri = prepared?.uri ?: uri
            val uploadMime = prepared?.mimeType ?: mime
            val uploadName = prepared?.displayName ?: displayName
            val body =
                ContentUriUploadBody(
                    contentResolver = resolver,
                    uri = uploadUri,
                    mimeType = uploadMime,
                    knownLength = prepared?.sizeBytes,
                )
            val part = MultipartBody.Part.createFormData("file", uploadName, body)
            uploadContent(file = part, name = uploadName, folderItemId = null)
        } finally {
            prepared?.tempFile?.delete()
        }
    }

private fun queryOpenableDisplayName(
    resolver: ContentResolver,
    uri: Uri,
): String? =
    resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
        if (!cursor.moveToFirst()) return@use null
        val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
        if (index < 0) return@use null
        cursor.getString(index)?.trim()?.takeIf { it.isNotEmpty() }
    }

private class ContentUriUploadBody(
    private val contentResolver: ContentResolver,
    private val uri: Uri,
    private val mimeType: String,
    private val knownLength: Long?,
) : RequestBody() {
    override fun contentType() = mimeType.toMediaTypeOrNull()

    override fun contentLength(): Long = knownLength ?: -1L

    override fun writeTo(sink: BufferedSink) {
        contentResolver.openInputStream(uri)?.use { input ->
            sink.writeAll(input.source())
        } ?: error("Cannot open upload stream")
    }
}
