/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Build image upload draft from gallery picker URI and stream it for profile avatar multipart POST.
 *
 * Invariants:
 * - Only image MIME types; max 5 MiB after WebP compression (server limit).
 *
 * Related:
 * - ProfileRepository.uploadAvatar, MobileImageUploadCompress.kt
 */
package feature.profile

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody
import okio.BufferedSink
import okio.source
import world.empery.mobile.core.ui.ImageUploadDraft

const val PROFILE_AVATAR_MAX_BYTES = 5L * 1024L * 1024L

fun buildProfileAvatarUploadDraft(context: Context, uri: Uri): ImageUploadDraft {
    val resolver = context.contentResolver
    var mimeType = resolver.getType(uri).orEmpty()
    val displayName = queryDisplayName(context, uri)
    if (mimeType.isBlank()) {
        mimeType = inferImageMimeFromName(displayName)
    }
    require(mimeType.startsWith("image/")) { context.getString(R.string.profile_avatar_mime_unsupported) }
    val sizeBytes = querySize(context, uri)
    return ImageUploadDraft(
        displayName = displayName,
        uri = uri.toString(),
        mimeType = mimeType,
        sizeBytes = sizeBytes,
    )
}

internal class ProfileAvatarUriRequestBody(
    private val contentResolver: android.content.ContentResolver,
    private val uri: Uri,
    private val mimeType: String,
    private val knownLength: Long?,
    private val streamOpenError: String,
) : RequestBody() {
    override fun contentType() = mimeType.toMediaTypeOrNull()

    override fun contentLength(): Long = knownLength ?: -1L

    override fun writeTo(sink: BufferedSink) {
        val stream =
            contentResolver.openInputStream(uri)
                ?: throw IllegalStateException(streamOpenError)
        stream.source().use { source -> sink.writeAll(source) }
    }
}

private fun queryDisplayName(context: Context, uri: Uri): String {
    context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
        ?.use { cursor ->
            val idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (idx >= 0 && cursor.moveToFirst()) {
                val value = cursor.getString(idx)
                if (!value.isNullOrBlank()) return value
            }
        }
    return "avatar-${System.currentTimeMillis()}.jpg"
}

private fun querySize(context: Context, uri: Uri): Long? =
    runCatching {
        context.contentResolver.openFileDescriptor(uri, "r")?.use { fd ->
            fd.statSize.takeIf { it > 0 }
        }
    }.getOrNull()

private fun inferImageMimeFromName(name: String): String {
    val lower = name.lowercase()
    return when {
        lower.endsWith(".webp") -> "image/webp"
        lower.endsWith(".png") -> "image/png"
        lower.endsWith(".gif") -> "image/gif"
        lower.endsWith(".heic") || lower.endsWith(".heif") -> "image/heic"
        else -> "image/jpeg"
    }
}
