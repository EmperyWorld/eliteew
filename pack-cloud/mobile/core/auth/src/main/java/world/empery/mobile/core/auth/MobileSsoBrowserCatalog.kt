/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Discover and rank installed browsers that can open the Keycloak authorization URL (DEBT-X-03).
 *
 * Invariants:
 * - Never returns the hosting app package; labels are for user-facing picker rows only.
 *
 * Related:
 * - MobileSsoLaunchPlanner, MobileSsoBrowserChoiceContracts
 */
package world.empery.mobile.core.auth

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.browser.customtabs.CustomTabsClient
import androidx.browser.customtabs.CustomTabsService
import java.util.Locale

data class MobileSsoBrowserOption(
    val packageName: String,
    val label: String,
    val supportsCustomTabs: Boolean,
)

object MobileSsoBrowserCatalog {
    private val preferredChromePackages =
        listOf(
            "com.android.chrome",
            "com.google.android.apps.chrome",
            "com.chrome.beta",
            "com.chrome.dev",
        )

    fun listBrowsersForAuthorizationUrl(
        context: Context,
        authorizationUrl: String,
        excludePackageName: String = context.packageName,
    ): List<MobileSsoBrowserOption> {
        val trimmedUrl = authorizationUrl.trim()
        if (trimmedUrl.isEmpty()) return emptyList()
        val viewIntent =
            Intent(Intent.ACTION_VIEW, Uri.parse(trimmedUrl)).apply {
                addCategory(Intent.CATEGORY_BROWSABLE)
            }
        val resolveInfos = queryBrowsers(context.packageManager, viewIntent)
        val packageManager = context.packageManager
        return rankBrowserOptions(
            resolveInfos
                .asSequence()
                .filterNot { ri -> ri.activityInfo.packageName == excludePackageName }
                .map { ri ->
                    val packageName = ri.activityInfo.packageName
                    MobileSsoBrowserOption(
                        packageName = packageName,
                        label = ri.loadLabel(packageManager).toString().trim(),
                        supportsCustomTabs = supportsCustomTabs(packageManager, packageName),
                    )
                }
                .distinctBy { it.packageName }
                .toList(),
        )
    }

    fun rankBrowserOptions(options: List<MobileSsoBrowserOption>): List<MobileSsoBrowserOption> =
        options.sortedWith(
            compareBy<MobileSsoBrowserOption> { option ->
                when {
                    preferredChromePackages.contains(option.packageName) -> 0
                    option.supportsCustomTabs -> 1
                    else -> 2
                }
            }.thenBy { it.label.lowercase(Locale.ROOT) },
        )

    fun resolveDefaultCustomTabsPackage(context: Context): String? =
        CustomTabsClient.getPackageName(context, null)?.takeIf { it.isNotBlank() }

    fun supportsCustomTabs(
        packageManager: PackageManager,
        packageName: String,
    ): Boolean {
        val serviceIntent =
            Intent(CustomTabsService.ACTION_CUSTOM_TABS_CONNECTION).apply {
                setPackage(packageName)
            }
        return packageManager.resolveService(serviceIntent, PackageManager.MATCH_DEFAULT_ONLY) != null
    }

    private fun queryBrowsers(
        packageManager: PackageManager,
        viewIntent: Intent,
    ) =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            packageManager.queryIntentActivities(
                viewIntent,
                PackageManager.ResolveInfoFlags.of(PackageManager.MATCH_ALL.toLong()),
            )
        } else {
            @Suppress("DEPRECATION")
            packageManager.queryIntentActivities(viewIntent, PackageManager.MATCH_ALL)
        }
}
