/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Persist downloaded APK path across process death for Profile → Updates install step.
 *
 * Invariants:
 * - Stored path must reference an existing file to be restored.
 *
 * Related:
 * - ProfileTabViewModel, MobileAppUpdateRepository
 */
package feature.profile

import android.content.Context
import java.io.File

object MobileAppUpdatePrefs {
    private const val PREFS_NAME = "world.empery.mobile.app_update"
    private const val KEY_DOWNLOADED_PATH = "downloaded_apk_path"
    private const val KEY_DOWNLOADED_VERSION = "downloaded_version_code"
    private const val KEY_EXPECTED_SHA256 = "expected_apk_sha256"
    private const val KEY_LAST_CHECK_EPOCH_MS = "last_update_check_epoch_ms"
    private const val KEY_PENDING_UPDATE_AVAILABLE = "pending_update_available"

    fun readDownloadedApk(context: Context): String? {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val path = prefs.getString(KEY_DOWNLOADED_PATH, null)?.trim().orEmpty()
        if (path.isEmpty()) return null
        val file = File(path)
        return path.takeIf { file.isFile && file.length() > 0L }
    }

    fun readDownloadedVersionCode(context: Context): Int? {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val version = prefs.getInt(KEY_DOWNLOADED_VERSION, -1)
        return version.takeIf { it > 0 }
    }

    fun saveExpectedSha256(context: Context, sha256: String?) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val normalized = sha256?.trim()?.lowercase().orEmpty()
        val editor = prefs.edit()
        if (normalized.length == 64) {
            editor.putString(KEY_EXPECTED_SHA256, normalized)
        } else {
            editor.remove(KEY_EXPECTED_SHA256)
        }
        editor.apply()
    }

    fun readExpectedSha256(context: Context): String? {
        val raw = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_EXPECTED_SHA256, null)
            ?.trim()
            ?.lowercase()
            .orEmpty()
        return raw.takeIf { it.length == 64 }
    }

    fun markUpdateCheck(context: Context, updateAvailable: Boolean) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putLong(KEY_LAST_CHECK_EPOCH_MS, System.currentTimeMillis())
            .putBoolean(KEY_PENDING_UPDATE_AVAILABLE, updateAvailable)
            .apply()
    }

    fun shouldAutoCheckUpdates(context: Context, minIntervalMs: Long): Boolean {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val last = prefs.getLong(KEY_LAST_CHECK_EPOCH_MS, 0L)
        if (last <= 0L) return true
        return System.currentTimeMillis() - last >= minIntervalMs
    }

    fun readPendingUpdateAvailable(context: Context): Boolean =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getBoolean(KEY_PENDING_UPDATE_AVAILABLE, false)

    fun saveDownloadedApk(context: Context, file: File, versionCode: Int) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_DOWNLOADED_PATH, file.absolutePath)
            .putInt(KEY_DOWNLOADED_VERSION, versionCode)
            .apply()
    }

    fun clearDownloadedApk(context: Context) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .remove(KEY_DOWNLOADED_PATH)
            .remove(KEY_DOWNLOADED_VERSION)
            .apply()
    }

    /** Drop stale OTA install pointers after APK replace; user can re-check updates in Profile. */
    fun clearStaleOtaStateAfterUpgrade(context: Context) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .remove(KEY_DOWNLOADED_PATH)
            .remove(KEY_DOWNLOADED_VERSION)
            .remove(KEY_EXPECTED_SHA256)
            .putBoolean(KEY_PENDING_UPDATE_AVAILABLE, false)
            .apply()
    }
}

fun formatApkSizeBytes(bytes: Long?): String? {
    if (bytes == null || bytes <= 0L) return null
    val mb = bytes.toDouble() / (1024.0 * 1024.0)
    return if (mb >= 100.0) {
        String.format("%.0f МБ", mb)
    } else {
        String.format("%.1f МБ", mb)
    }
}
