/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * In-app update helpers: version compare, sideload install intent, unknown-sources settings.
 *
 * Invariants:
 * - Install intents use FileProvider authority `${packageName}.fileprovider`.
 *
 * Related:
 * - app/src/main/res/xml/file_paths.xml, feature.profile.MobileAppUpdateRepository
 */
package feature.profile

import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import java.io.File

object MobileApkInstaller {
    fun installedVersionCode(context: Context): Int {
        val packageInfo =
            context.packageManager.getPackageInfo(context.packageName, 0)
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            packageInfo.longVersionCode.toInt()
        } else {
            @Suppress("DEPRECATION")
            packageInfo.versionCode
        }
    }

    fun installedVersionName(context: Context): String {
        val packageInfo =
            context.packageManager.getPackageInfo(context.packageName, 0)
        return packageInfo.versionName.orEmpty()
    }

    fun isServerUpdateAvailable(
        installedVersionCode: Int,
        serverVersionCode: Int?,
    ): Boolean {
        val remote = serverVersionCode ?: return false
        return remote > installedVersionCode
    }

    fun canInstallPackages(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true
        return context.packageManager.canRequestPackageInstalls()
    }

    fun openInstallPermissionSettings(context: Context): Intent =
        Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
            data = Uri.parse("package:${context.packageName}")
        }

    fun buildInstallIntent(
        context: Context,
        apkFile: File,
    ): Intent {
        val authority = "${context.packageName}.fileprovider"
        val uri = FileProvider.getUriForFile(context, authority, apkFile)
        return Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            clipData = ClipData.newUri(context.contentResolver, apkFile.name, uri)
        }
    }

    fun canResolveInstallIntent(context: Context, apkFile: File): Boolean {
        if (!apkFile.isFile || apkFile.length() <= 0L) return false
        return context.packageManager.resolveActivity(buildInstallIntent(context, apkFile), 0) != null
    }

    /** Launch system package installer; returns false when no handler or launch failed. */
    fun launchInstall(context: Context, apkFile: File): Boolean {
        if (!canResolveInstallIntent(context, apkFile)) return false
        return runCatching {
            context.startActivity(buildInstallIntent(context, apkFile))
        }.isSuccess
    }
}
