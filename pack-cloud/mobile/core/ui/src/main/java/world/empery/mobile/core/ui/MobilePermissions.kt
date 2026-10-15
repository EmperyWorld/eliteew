/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Runtime permission catalog for Empery Mobile — camera, mic, notifications, media/storage.
 *
 * Invariants:
 * - Lists only permissions declared in app AndroidManifest.xml.
 * - Callers must still invoke Activity permission launchers; this module is logic-only.
 *
 * Related:
 * - MainActivity permission setup, MobileDownloadStorage.kt
 */
package world.empery.mobile.core.ui

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.core.content.ContextCompat

/** Invoked from feature screens when runtime permissions are still missing. */
val LocalMobilePermissionRequester = staticCompositionLocalOf<(() -> Unit)?> { null }

object MobilePermissions {
    fun postNotificationPermissions(): List<String> =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            listOf(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            emptyList()
        }

    /** Camera, mic, and storage — without POST_NOTIFICATIONS (requested in a dedicated flow). */
    fun coreRuntimePermissions(): List<String> =
        runtimePermissions().filter { permission ->
            permission != Manifest.permission.POST_NOTIFICATIONS
        }

    fun isPostNotificationGranted(context: Context): Boolean =
        missingPostNotificationPermissions(context).isEmpty()

    fun missingPostNotificationPermissions(context: Context): List<String> =
        missingPermissions(context, postNotificationPermissions())

    fun runtimePermissions(): List<String> {
        val permissions = mutableListOf<String>()
        permissions += Manifest.permission.CAMERA
        permissions += Manifest.permission.RECORD_AUDIO
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions += Manifest.permission.POST_NOTIFICATIONS
            permissions += Manifest.permission.READ_MEDIA_IMAGES
            permissions += Manifest.permission.READ_MEDIA_VIDEO
            permissions += Manifest.permission.READ_MEDIA_AUDIO
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            permissions += Manifest.permission.READ_EXTERNAL_STORAGE
        } else {
            permissions += Manifest.permission.READ_EXTERNAL_STORAGE
            permissions += Manifest.permission.WRITE_EXTERNAL_STORAGE
        }
        return permissions.distinct()
    }

    fun storagePermissions(): List<String> =
        when {
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ->
                listOf(
                    Manifest.permission.READ_MEDIA_IMAGES,
                    Manifest.permission.READ_MEDIA_VIDEO,
                    Manifest.permission.READ_MEDIA_AUDIO,
                )
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ->
                listOf(Manifest.permission.READ_EXTERNAL_STORAGE)
            else ->
                listOf(
                    Manifest.permission.READ_EXTERNAL_STORAGE,
                    Manifest.permission.WRITE_EXTERNAL_STORAGE,
                )
        }

    fun missingPermissions(
        context: Context,
        permissions: List<String> = runtimePermissions(),
    ): List<String> =
        permissions.filter {
            ContextCompat.checkSelfPermission(context, it) != PackageManager.PERMISSION_GRANTED
        }

    fun allRuntimeGranted(context: Context): Boolean = missingPermissions(context).isEmpty()

    fun missingStoragePermissions(context: Context): List<String> =
        missingPermissions(context, storagePermissions())

    fun canSaveToPublicDownloads(context: Context): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            return true
        }
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.WRITE_EXTERNAL_STORAGE,
        ) == PackageManager.PERMISSION_GRANTED
    }
}
