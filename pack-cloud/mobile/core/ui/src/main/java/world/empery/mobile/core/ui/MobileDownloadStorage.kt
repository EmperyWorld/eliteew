/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Save downloaded streams into Downloads/Empery via MediaStore (Q+) or legacy external storage.
 *
 * Invariants:
 * - Q+ writes use IS_PENDING and always clear pending on success.
 * - SecurityException maps to caller-provided accessDenied message.
 *
 * Related:
 * - UgsHubRepository, MainViewModel chat attachment save, file_paths.xml
 */
package world.empery.mobile.core.ui

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream

class MobileDownloadSaveException(
    message: String,
    cause: Throwable? = null,
) : IllegalStateException(message, cause)

object MobileDownloadStorage {
    data class ErrorMessages(
        val createFailed: String,
        val openFailed: String,
        val writeFailed: String,
        val accessDenied: String,
        val folderUnavailable: String,
    )

    fun saveStreamToDownloads(
        context: Context,
        input: InputStream,
        fileName: String,
        mimeType: String,
        errors: ErrorMessages,
        relativeSubdir: String = "Empery",
    ): Uri {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            return saveViaMediaStore(
                context = context,
                input = input,
                fileName = fileName,
                mimeType = mimeType,
                errors = errors,
                relativeSubdir = relativeSubdir,
            )
        }
        return saveLegacy(context, input, fileName, mimeType, errors, relativeSubdir)
    }

    private fun saveViaMediaStore(
        context: Context,
        input: InputStream,
        fileName: String,
        mimeType: String,
        errors: ErrorMessages,
        relativeSubdir: String,
    ): Uri {
        val resolver = context.contentResolver
        val values =
            ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
                put(MediaStore.MediaColumns.MIME_TYPE, mimeType)
                put(
                    MediaStore.MediaColumns.RELATIVE_PATH,
                    "${Environment.DIRECTORY_DOWNLOADS}/$relativeSubdir",
                )
                put(MediaStore.Downloads.IS_PENDING, 1)
            }
        val targetUri =
            resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                ?: throw MobileDownloadSaveException(errors.createFailed)

        try {
            input.use { stream ->
                val output =
                    resolver.openOutputStream(targetUri)
                        ?: resolver.openOutputStream(targetUri, "w")
                            ?: throw MobileDownloadSaveException(errors.openFailed)
                output.use { out -> stream.copyTo(out) }
            }
        } catch (err: Throwable) {
            runCatching { resolver.delete(targetUri, null, null) }
            val hint =
                if (err is SecurityException) {
                    errors.accessDenied
                } else {
                    err.message ?: errors.writeFailed
                }
            throw MobileDownloadSaveException(hint, err)
        }

        values.clear()
        values.put(MediaStore.Downloads.IS_PENDING, 0)
        resolver.update(targetUri, values, null, null)
        return targetUri
    }

    private fun saveLegacy(
        context: Context,
        input: InputStream,
        fileName: String,
        mimeType: String,
        errors: ErrorMessages,
        relativeSubdir: String,
    ): Uri {
        if (MobilePermissions.canSaveToPublicDownloads(context)) {
            val publicRoot =
                Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            val targetDir = File(publicRoot, relativeSubdir)
            if (!targetDir.exists() && !targetDir.mkdirs()) {
                throw MobileDownloadSaveException(errors.folderUnavailable)
            }
            val targetFile = File(targetDir, fileName)
            try {
                FileOutputStream(targetFile).use { output ->
                    input.use { it.copyTo(output) }
                }
            } catch (err: Throwable) {
                val hint =
                    if (err is SecurityException) errors.accessDenied else err.message ?: errors.writeFailed
                throw MobileDownloadSaveException(hint, err)
            }
            return FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                targetFile,
            )
        }

        val targetDir =
            context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
                ?: throw MobileDownloadSaveException(errors.folderUnavailable)
        val targetFile = File(targetDir, fileName)
        try {
            FileOutputStream(targetFile).use { output ->
                input.use { it.copyTo(output) }
            }
        } catch (err: Throwable) {
            val hint =
                if (err is SecurityException) errors.accessDenied else err.message ?: errors.writeFailed
            throw MobileDownloadSaveException(hint, err)
        }
        return FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            targetFile,
        )
    }
}
