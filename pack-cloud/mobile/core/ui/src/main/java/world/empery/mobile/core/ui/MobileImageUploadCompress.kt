/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared raster downscale + WebP/JPEG re-encode before mobile uploads (chat attachments, profile avatar).
 *
 * Invariants:
 * - GIF/SVG and non-images pass through unchanged.
 * - Temp files live under cacheDir/gaf_upload_prep/ and must be deleted by caller after upload.
 *
 * Related:
 * - GafChatImageCompress.kt, ProfileRepository.uploadAvatar
 */
package world.empery.mobile.core.ui

import android.content.ContentResolver
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileOutputStream
import java.util.Locale
import kotlin.math.max
import kotlin.math.roundToInt

private const val MOBILE_IMAGE_MAX_EDGE_PX = 2048
private const val MOBILE_IMAGE_MIN_SIZE_BYTES = 96 * 1024
private const val MOBILE_IMAGE_WEBP_QUALITY = 82
private const val MOBILE_IMAGE_JPEG_QUALITY = 85
private const val MOBILE_IMAGE_UPLOAD_CACHE_DIR = "gaf_upload_prep"

data class ImageUploadDraft(
    val displayName: String,
    val uri: String,
    val mimeType: String,
    val sizeBytes: Long?,
)

data class PreparedImageUpload(
    val uri: Uri,
    val displayName: String,
    val mimeType: String,
    val sizeBytes: Long?,
    val tempFile: File?,
)

private fun fallbackOriginal(draft: ImageUploadDraft): PreparedImageUpload =
    PreparedImageUpload(
        uri = Uri.parse(draft.uri),
        displayName = draft.displayName,
        mimeType = draft.mimeType,
        sizeBytes = draft.sizeBytes,
        tempFile = null,
    )

private fun baseFileName(name: String): String {
    val i = name.lastIndexOf('.')
    if (i <= 0) return name.ifBlank { "image" }
    return name.substring(0, i).ifBlank { "image" }
}

private fun readImageBounds(resolver: ContentResolver, uri: Uri): Pair<Int, Int>? {
    val o = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, o) }
    if (o.outWidth < 1 || o.outHeight < 1) return null
    return o.outWidth to o.outHeight
}

private fun loadBitmapSubsampling(resolver: ContentResolver, uri: Uri): Bitmap? {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
    if (bounds.outWidth < 1 || bounds.outHeight < 1) return null
    var sample = 1
    while (max(bounds.outWidth, bounds.outHeight) / sample > MOBILE_IMAGE_MAX_EDGE_PX * 2) {
        sample *= 2
    }
    val opts = BitmapFactory.Options().apply { inSampleSize = sample }
    return resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, opts) }
}

private fun scaleBitmapIfNeeded(src: Bitmap, maxEdge: Int): Bitmap {
    val w = src.width
    val h = src.height
    val maxE = max(w, h)
    if (maxE <= maxEdge) return src
    val scale = maxEdge.toFloat() / maxE
    val nw = max(1, (w * scale).roundToInt())
    val nh = max(1, (h * scale).roundToInt())
    val out = Bitmap.createScaledBitmap(src, nw, nh, true)
    if (out != src) src.recycle()
    return out
}

private fun compressWebp(bitmap: Bitmap, out: File): Boolean =
    try {
        FileOutputStream(out).use { fos ->
            val ok =
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    bitmap.compress(Bitmap.CompressFormat.WEBP_LOSSY, MOBILE_IMAGE_WEBP_QUALITY, fos)
                } else {
                    @Suppress("DEPRECATION")
                    bitmap.compress(Bitmap.CompressFormat.WEBP, MOBILE_IMAGE_WEBP_QUALITY, fos)
                }
            ok && out.length() > 0L
        }
    } catch (_: Throwable) {
        false
    }

private fun compressJpeg(bitmap: Bitmap, out: File): Boolean =
    try {
        FileOutputStream(out).use { fos ->
            bitmap.compress(Bitmap.CompressFormat.JPEG, MOBILE_IMAGE_JPEG_QUALITY, fos) && out.length() > 0L
        }
    } catch (_: Throwable) {
        false
    }

fun prepareMobileImageUploadWebp(
    context: Context,
    draft: ImageUploadDraft,
): PreparedImageUpload {
    val mimeRaw = draft.mimeType.lowercase(Locale.ROOT)
    if (!mimeRaw.startsWith("image/")) return fallbackOriginal(draft)
    if (mimeRaw == "image/gif" || mimeRaw == "image/svg+xml") return fallbackOriginal(draft)

    val sourceUri = Uri.parse(draft.uri)
    val resolver = context.contentResolver
    val origSize =
        draft.sizeBytes ?: runCatching {
            resolver.openFileDescriptor(sourceUri, "r")?.use { fd ->
                fd.statSize.takeIf { it > 0 }
            }
        }.getOrNull()

    val bounds = readImageBounds(resolver, sourceUri) ?: return fallbackOriginal(draft)
    val maxE0 = max(bounds.first, bounds.second)
    val needsResize0 = maxE0 > MOBILE_IMAGE_MAX_EDGE_PX
    val needsCompress0 = needsResize0 || (origSize != null && origSize >= MOBILE_IMAGE_MIN_SIZE_BYTES)
    if (!needsCompress0) return fallbackOriginal(draft)

    val bmp = loadBitmapSubsampling(resolver, sourceUri) ?: return fallbackOriginal(draft)
    val scaled = scaleBitmapIfNeeded(bmp, MOBILE_IMAGE_MAX_EDGE_PX)
    try {
        val stem = baseFileName(draft.displayName)
        val dir = File(context.cacheDir, MOBILE_IMAGE_UPLOAD_CACHE_DIR).apply { mkdirs() }
        val webpOut = File(dir, "mob-up-${System.currentTimeMillis()}.webp")
        val webpOk = compressWebp(scaled, webpOut)
        if (webpOk) {
            if (origSize != null && webpOut.length() >= origSize * 97 / 100) {
                webpOut.delete()
                return fallbackOriginal(draft)
            }
            val fpUri =
                FileProvider.getUriForFile(
                    context,
                    "${context.packageName}.fileprovider",
                    webpOut,
                )
            return PreparedImageUpload(
                uri = fpUri,
                displayName = "$stem.webp",
                mimeType = "image/webp",
                sizeBytes = webpOut.length(),
                tempFile = webpOut,
            )
        }
        webpOut.delete()

        val jpgOut = File(dir, "mob-up-${System.currentTimeMillis()}.jpg")
        if (!compressJpeg(scaled, jpgOut)) {
            jpgOut.delete()
            return fallbackOriginal(draft)
        }
        if (origSize != null && jpgOut.length() >= origSize * 97 / 100) {
            jpgOut.delete()
            return fallbackOriginal(draft)
        }
        val fpUri2 =
            FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                jpgOut,
            )
        return PreparedImageUpload(
            uri = fpUri2,
            displayName = "$stem.jpg",
            mimeType = "image/jpeg",
            sizeBytes = jpgOut.length(),
            tempFile = jpgOut,
        )
    } finally {
        if (!scaled.isRecycled) scaled.recycle()
    }
}
