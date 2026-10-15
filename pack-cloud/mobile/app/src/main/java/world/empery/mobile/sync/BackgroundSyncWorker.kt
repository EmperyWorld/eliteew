/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * WorkManager periodic and on-demand HTTP sync for feed, notifications, chat, friends.
 *
 * Invariants:
 * - Skips work without session; coalesces success within cooldown unless force=true.
 * - Private tunnel beta defers HTTP sync until WireGuard is CONNECTED via Result.retry()
 *   (bounded attempts); CONNECTED orchestrated resume force-flushes sync.
 * - Heavy scopes honor MobileSyncStormGuard (15s) to avoid overlapping UI refreshAllTabs.
 *
 * Related:
 * - MobileSyncScheduler, MobileFirebaseMessagingService, MobilePrivateTunnelRecoveryPolicy,
 *   MobileSyncStormGuard
 */
package world.empery.mobile.sync

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import world.empery.mobile.MobileApp
import world.empery.mobile.observability.MobileTelemetry
import world.empery.mobile.tunnel.MobilePrivateTunnelRecoveryPolicy
import world.empery.mobile.tunnel.MobilePrivateTunnelStartupGate
import java.util.concurrent.TimeUnit

class BackgroundSyncWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val force = inputData.getBoolean(INPUT_FORCE, false)
        if (!force && shouldSkipRecentSuccess()) {
            return@withContext Result.success()
        }
        val container = (applicationContext as? MobileApp)?.container
            ?: return@withContext Result.retry()
        if (MobilePrivateTunnelStartupGate.shouldDeferAuthenticatedNetwork(
                applicationContext,
                container.mobilePrivateTunnelManager,
            )
        ) {
            val attempt = runAttemptCount
            if (MobilePrivateTunnelRecoveryPolicy.shouldRetryBackgroundSyncWhenTunnelDeferred(attempt)) {
                MobileTelemetry.trackBusinessEvent(
                    "background_sync_retry_private_tunnel_deferred",
                    mapOf("attempt" to attempt.toString()),
                )
                return@withContext Result.retry()
            }
            MobileTelemetry.trackBusinessEvent(
                "background_sync_tunnel_defer_exhausted",
                mapOf("attempt" to attempt.toString()),
            )
            // Stop WM retry storm; MobilePrivateTunnelRecoveryCoordinator flushes on CONNECTED.
            return@withContext Result.success()
        }
        if (!container.authRepository.hasSession()) {
            MobileTelemetry.trackBusinessEvent("background_sync_skipped_no_session")
            return@withContext Result.success()
        }
        val scope = MobileSyncScope.fromWire(inputData.getString(INPUT_SYNC_SCOPE))
        val staggeredFollowUp = inputData.getBoolean(INPUT_STAGGERED_FOLLOW_UP, false)
        if (MobileSyncStormGuard.isHeavyScope(scope)) {
            if (!MobileSyncStormGuard.tryBeginSync(staggeredFollowUp = staggeredFollowUp)) {
                MobileTelemetry.trackBusinessEvent(
                    "background_sync_suppressed_sync_storm_guard",
                    mapOf(
                        "scope" to scope.wireName(),
                        "staggered" to staggeredFollowUp.toString(),
                    ),
                )
                return@withContext Result.success()
            }
        } else {
            MobileSyncStormGuard.markAttempt()
        }
        MobileSyncObservability.markAttempt(applicationContext, scope.wireName())
        return@withContext runCatching {
            runSyncScope(container, scope)
            markSyncSuccess()
            MobileSyncObservability.markSuccess(applicationContext, scope.wireName(), MIN_SUCCESS_COOLDOWN_MS)
            MobileTelemetry.trackBusinessEvent(
                "background_sync_ok",
                mapOf("scope" to scope.wireName()),
            )
            Result.success()
        }.getOrElse { error ->
            MobileTelemetry.reportError(error, "Background sync failed scope=${scope.wireName()}")
            MobileSyncObservability.markFailure(applicationContext, scope.wireName(), error.message, 30_000L)
            (applicationContext as? MobileApp)?.perimeterAccessCoordinator?.onSyncFailed(error)
            Result.retry()
        }
    }

    private suspend fun runSyncScope(container: world.empery.mobile.di.AppContainer, scope: MobileSyncScope) {
        when (scope) {
            MobileSyncScope.ALL -> {
                container.feedRepository.refresh()
                container.notificationRepository.refresh()
                container.chatRepository.refreshChatList()
                container.friendsUseCases.overview.refreshNetwork()
            }
            MobileSyncScope.LIGHT -> {
                container.feedRepository.refresh()
                container.notificationRepository.refresh()
                container.chatRepository.refreshChatList()
            }
            MobileSyncScope.CHAT -> container.chatRepository.refreshChatList()
            MobileSyncScope.NOTIFICATIONS -> container.notificationRepository.refresh()
            MobileSyncScope.FEED -> container.feedRepository.refresh()
            MobileSyncScope.FRIENDS -> container.friendsUseCases.overview.refreshNetwork()
        }
    }

    private fun shouldSkipRecentSuccess(): Boolean {
        val prefs = applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val last = prefs.getLong(KEY_LAST_SUCCESS_MS, 0L)
        if (last <= 0L) return false
        return System.currentTimeMillis() - last < MIN_SUCCESS_COOLDOWN_MS
    }

    private fun markSyncSuccess() {
        applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putLong(KEY_LAST_SUCCESS_MS, System.currentTimeMillis())
            .apply()
    }

    companion object {
        const val UNIQUE_PERIODIC_WORK_NAME = "mobile-periodic-sync"
        const val WORK_TAG_PERIODIC = "mobile-periodic-sync"
        const val WORK_TAG_IMMEDIATE = "mobile-immediate-sync"
        const val INPUT_SYNC_SCOPE = "sync_scope"
        const val INPUT_FORCE = "force"
        const val INPUT_STAGGERED_FOLLOW_UP = "staggered_follow_up"

        private const val PREFS_NAME = "world.empery.mobile.sync.worker"
        private const val KEY_LAST_SUCCESS_MS = "last_background_sync_success_ms"
        private const val MIN_SUCCESS_COOLDOWN_MS = 90_000L
        private const val PERIODIC_INTERVAL_MINUTES = 15L
        const val MEDIA_DOWNLOAD_INTERVAL_MINUTES = 30L

        fun defaultConstraints(): Constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .setRequiresBatteryNotLow(true)
            .build()

        fun lightweightSyncConstraints(): Constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        fun heavyMediaConstraints(): Constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.UNMETERED)
            .setRequiresBatteryNotLow(true)
            .setRequiresStorageNotLow(true)
            .build()

        fun buildDefaultPeriodicWorkRequest() = PeriodicWorkRequestBuilder<BackgroundSyncWorker>(
            PERIODIC_INTERVAL_MINUTES,
            TimeUnit.MINUTES,
        )
            .addTag(WORK_TAG_PERIODIC)
            .setConstraints(defaultConstraints())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()
    }
}
