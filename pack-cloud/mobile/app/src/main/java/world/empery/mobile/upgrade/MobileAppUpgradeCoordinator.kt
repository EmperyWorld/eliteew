/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Cold-start hook when installed versionCode changes: clears stale OTA/network/cache state and
 * reconciles SSO tokens so post-update launches do not require manual app-data wipe.
 *
 * Invariants:
 * - Runs synchronously in Application.onCreate for local cleanup only; session refresh is async via [MobileUpgradeSessionGate].
 * - In private-tunnel mode, session refresh waits until Secure Connection is ready (or a terminal gate).
 * - Never logs token values.
 *
 * Related:
 * - MobileApp, AuthRepository, MobileUpgradeSessionReconcilePolicy, MobileAppUpdatePrefs,
 *   MobileAppUpdateScheduler, MobileUpgradeSessionGate
 */
package world.empery.mobile.upgrade

import android.content.Context
import android.util.Log
import feature.profile.MobileAppUpdateDownloadSupport
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.withTimeoutOrNull
import world.empery.mobile.BuildConfig
import world.empery.mobile.MobileApp
import world.empery.mobile.MobileMemoryTrim
import world.empery.mobile.core.auth.SessionReconcileResult
import world.empery.mobile.di.AppContainer
import world.empery.mobile.observability.MobileTelemetry
import world.empery.mobile.tunnel.MobileConnectionMode
import world.empery.mobile.tunnel.MobileConnectionModeStore
import world.empery.mobile.update.MobileAppUpdateScheduler
import feature.profile.MobileAppUpdatePrefs

object MobileAppUpgradeCoordinator {
    private const val TAG = "MobileAppUpgrade"
    private const val PREFS_NAME = "world.empery.mobile.app_upgrade"
    private const val KEY_LAST_VERSION_CODE = "last_run_version_code"
    private const val APK_REPLACE_SLACK_MS = 60_000L
    private const val SESSION_RECONCILE_TIMEOUT_MS = 12_000L

    /**
     * Call once from [MobileApp.onCreate] immediately after [AppContainer] is constructed.
     */
    fun runOnColdStart(app: MobileApp) {
        val currentVersion = BuildConfig.VERSION_CODE
        val prefs = app.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val previousVersion = prefs.getInt(KEY_LAST_VERSION_CODE, -1)
        if (previousVersion == currentVersion) return

        val isVersionChange =
            when {
                previousVersion > 0 && previousVersion != currentVersion -> true
                previousVersion <= 0 && isLikelyApkReplaceWithoutTracker(app) -> true
                else -> false
            }
        if (isVersionChange) {
            val fromLabel = if (previousVersion > 0) previousVersion.toString() else "legacy"
            Log.i(TAG, "app upgrade detected previous=$fromLabel current=$currentVersion")
            runCatching {
                MobileTelemetry.trackBusinessEvent(
                    "app_upgrade_cleanup",
                    mapOf(
                        "from" to fromLabel,
                        "to" to currentVersion.toString(),
                    ),
                )
            }
            performUpgradeCleanup(app, app.container, currentVersion)
            scheduleSessionReconcileAfterUpgrade(app)
        } else if (previousVersion <= 0) {
            Log.i(TAG, "first tracked launch version=$currentVersion")
        }

        prefs.edit().putInt(KEY_LAST_VERSION_CODE, currentVersion).commit()
    }

    /** Installs before upgrade tracker shipped: detect APK replace via PackageManager timestamps. */
    private fun isLikelyApkReplaceWithoutTracker(app: MobileApp): Boolean {
        return runCatching {
            val info = app.packageManager.getPackageInfo(app.packageName, 0)
            val firstInstall = info.firstInstallTime
            val lastUpdate = info.lastUpdateTime
            lastUpdate > firstInstall + APK_REPLACE_SLACK_MS
        }.getOrDefault(false)
    }

    private fun performUpgradeCleanup(app: MobileApp, container: AppContainer, installedVersionCode: Int) {
        val ctx = app.applicationContext
        MobileAppUpdateScheduler.cancelDownload(ctx)
        MobileAppUpdatePrefs.clearStaleOtaStateAfterUpgrade(ctx)
        pruneOtaDownloadArtifacts(container, ctx, installedVersionCode)
        container.invalidateHttpConnectionsAfterUpgrade()
        container.invalidateConditionalGetCachesAfterUpgrade()
        MobileMemoryTrim.trimImageCaches(ctx, aggressive = true)
        runCatching { container.chatRepository.clearAttachmentDiskCache() }
    }

    private fun scheduleSessionReconcileAfterUpgrade(app: MobileApp) {
        if (!app.container.authRepository.hasSession()) return
        MobileUpgradeSessionGate.onUpgradeReconcileScheduled()
        app.launchBackgroundWork {
            val outcome =
                runCatching {
                    awaitPrivateTunnelReadyForReconcile(app)
                    withTimeout(SESSION_RECONCILE_TIMEOUT_MS) {
                        app.container.authRepository.reconcileSessionAfterAppUpgrade()
                    }
                }.getOrElse { err ->
                    Log.w(TAG, "session reconcile failed (${err.javaClass.simpleName})", err)
                    SessionReconcileResult.KeptDespiteTransientFailure
                }
            Log.i(TAG, "session reconcile outcome=$outcome")
            MobileUpgradeSessionGate.onUpgradeReconcileFinished()
        }
    }

    private suspend fun awaitPrivateTunnelReadyForReconcile(app: MobileApp) {
        val privateMode =
            MobileConnectionModeStore.read(app) == MobileConnectionMode.PRIVATE_TUNNEL_BETA
        if (!MobileUpgradeSessionReconcilePolicy.shouldWaitForPrivateTunnel(privateMode)) {
            return
        }
        val manager = app.container.mobilePrivateTunnelManager
        val already = manager.state.value
        if (
            MobileUpgradeSessionReconcilePolicy.isPrivateTunnelReadyForSessionReconcile(
                status = already.status,
                shellAutoHealSuppressed = already.shellAutoHealSuppressed,
            )
        ) {
            return
        }
        Log.i(TAG, "upgrade session reconcile waiting for private tunnel (status=${already.status})")
        val ready =
            withTimeoutOrNull(MobileUpgradeSessionReconcilePolicy.PRIVATE_TUNNEL_READY_TIMEOUT_MS) {
                manager.state.first { snap ->
                    MobileUpgradeSessionReconcilePolicy.isPrivateTunnelReadyForSessionReconcile(
                        status = snap.status,
                        shellAutoHealSuppressed = snap.shellAutoHealSuppressed,
                    )
                }
            }
        if (ready == null) {
            Log.w(TAG, "upgrade session reconcile: private tunnel wait timed out; refreshing anyway")
        } else {
            Log.i(TAG, "upgrade session reconcile: private tunnel ready status=${ready.status}")
        }
    }

    private fun pruneOtaDownloadArtifacts(
        container: AppContainer,
        context: Context,
        installedVersionCode: Int,
    ) {
        val updatesDir = container.mobileAppUpdateRepository.updatesDir(context) ?: return
        if (!updatesDir.isDirectory) return
        updatesDir.listFiles()?.forEach { file ->
            if (!file.isFile) return@forEach
            val name = file.name
            when {
                name.endsWith(MobileAppUpdateDownloadSupport.PART_SUFFIX) -> {
                    val version = parseOtaVersionFromFileName(name.removeSuffix(MobileAppUpdateDownloadSupport.PART_SUFFIX))
                    if (version == null || version <= installedVersionCode) {
                        file.delete()
                    }
                }
                name.startsWith("empery-mobile-v") && name.endsWith(".apk") -> {
                    val version = parseOtaVersionFromFileName(name)
                    if (version == null || version <= installedVersionCode) {
                        file.delete()
                    }
                }
            }
        }
    }

    private fun parseOtaVersionFromFileName(fileName: String): Int? {
        val prefix = "empery-mobile-v"
        if (!fileName.startsWith(prefix) || !fileName.endsWith(".apk")) return null
        val token = fileName.removePrefix(prefix).removeSuffix(".apk")
        return token.toIntOrNull()
    }
}
