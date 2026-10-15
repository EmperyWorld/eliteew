/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Localized user-facing strings for in-app APK update lifecycle (Profile tab).
 *
 * Invariants:
 * - All OTA status text shown in UI must go through this helper (not hardcoded in ViewModel).
 * - User-facing copy avoids technical fields (versionCode pairs, SHA-256, host labels).
 *
 * Related:
 * - ProfileTabViewModel, MobileAppUpdateDownloadSupport, ProfileOtaUpdateSection
 */
package feature.profile

import android.content.Context

object MobileAppUpdateMessages {
    fun downloading(context: Context): String =
        context.getString(R.string.profile_updates_status_downloading)

    fun resumeDownloading(context: Context): String =
        context.getString(R.string.profile_updates_status_resume_downloading)

    fun downloadReady(context: Context): String =
        context.getString(R.string.profile_updates_status_ready_install)

    fun launchingInstall(context: Context): String =
        context.getString(R.string.profile_updates_status_launching_install)

    fun installLaunchFailed(context: Context): String =
        context.getString(R.string.profile_updates_install_launch_failed)

    fun apkFileMissing(context: Context): String =
        context.getString(R.string.profile_updates_apk_file_missing)

    fun downloadReadyRestored(context: Context): String =
        context.getString(R.string.profile_updates_status_ready_restored)

    fun downloadCancelled(context: Context): String =
        context.getString(R.string.profile_updates_status_cancelled)

    fun downloadFailed(context: Context): String =
        context.getString(R.string.profile_updates_status_download_failed)

    fun downloadStalled(context: Context): String =
        context.getString(R.string.profile_updates_status_download_stalled)

    fun checkFailed(context: Context): String =
        context.getString(R.string.profile_updates_status_check_failed)

    fun partialProgress(context: Context, downloadedBytes: Long, totalBytes: Long?): String {
        val progress =
            MobileAppUpdateDownloadSupport.computeProgress(downloadedBytes, totalBytes)
        return if (progress != null) {
            context.getString(
                R.string.profile_updates_status_partial_progress,
                (progress.coerceIn(0f, 1f) * 100f).toInt(),
            )
        } else {
            context.getString(R.string.profile_updates_resume_hint)
        }
    }

    fun formatUpdateStatusMessage(
        context: Context,
        installedCode: Int,
        installedName: String,
        serverCode: Int?,
        serverName: String?,
        apkAvailable: Boolean,
        updateAvailable: Boolean,
        apkSizeBytes: Long? = null,
    ): String? {
        return when {
            !apkAvailable -> context.getString(R.string.profile_updates_status_no_apk_simple)
            updateAvailable -> context.getString(R.string.profile_updates_status_update_available_simple)
            serverCode == null -> context.getString(R.string.profile_updates_status_no_server_code_simple)
            else -> null
        }
    }
}
