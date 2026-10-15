/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Enqueue one-time background HTTP sync (WorkManager) from FCM, network restore, or lifecycle hooks.
 *
 * Invariants:
 * - Uses ExistingWorkPolicy.KEEP to coalesce bursts without stacking duplicate full syncs.
 * - Immediate work uses exponential backoff so tunnel-defer Result.retry() respects recovery windows.
 * - Heavy scopes skip enqueue when MobileSyncStormGuard would suppress (in-flight / recent sync).
 *
 * Related:
 * - BackgroundSyncWorker, MobileFirebaseMessagingService, MobilePrivateTunnelRecoveryCoordinator,
 *   MobileSyncStormGuard
 */
package world.empery.mobile.sync

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import java.util.concurrent.TimeUnit

enum class MobileSyncScope {
    ALL,
    LIGHT,
    CHAT,
    NOTIFICATIONS,
    FEED,
    FRIENDS,
    ;

    internal fun wireName(): String = name.lowercase()

    companion object {
        fun fromWire(raw: String?): MobileSyncScope =
            when (raw?.trim()?.lowercase()) {
                "light" -> LIGHT
                "chat" -> CHAT
                "notifications" -> NOTIFICATIONS
                "feed" -> FEED
                "friends" -> FRIENDS
                "all", null, "" -> ALL
                else -> ALL
            }
    }
}

object MobileSyncScheduler {
    const val UNIQUE_IMMEDIATE_WORK_NAME = "mobile-immediate-sync"
    private const val UNIQUE_PUSH_SYNC_RETRY_PREFIX = "mobile-push-sync-retry"
    private val PUSH_SYNC_RETRY_DELAYS_MS = longArrayOf(20_000L, 60_000L)
    private const val TUNNEL_AWARE_BACKOFF_SECONDS = 15L

    fun enqueueImmediate(
        context: Context,
        scope: MobileSyncScope = MobileSyncScope.ALL,
        force: Boolean = false,
        staggeredFollowUp: Boolean = false,
    ) {
        if (MobileSyncStormGuard.isHeavyScope(scope) &&
            MobileSyncStormGuard.shouldSuppress(staggeredFollowUp = staggeredFollowUp)
        ) {
            return
        }
        val request =
            OneTimeWorkRequestBuilder<BackgroundSyncWorker>()
                .setInputData(
                    workDataOf(
                        BackgroundSyncWorker.INPUT_SYNC_SCOPE to scope.wireName(),
                        BackgroundSyncWorker.INPUT_FORCE to force,
                        BackgroundSyncWorker.INPUT_STAGGERED_FOLLOW_UP to staggeredFollowUp,
                    ),
                )
                .setConstraints(BackgroundSyncWorker.lightweightSyncConstraints())
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    TUNNEL_AWARE_BACKOFF_SECONDS,
                    TimeUnit.SECONDS,
                )
                .addTag(BackgroundSyncWorker.WORK_TAG_IMMEDIATE)
                .build()
        WorkManager.getInstance(context.applicationContext).enqueueUniqueWork(
            UNIQUE_IMMEDIATE_WORK_NAME,
            ExistingWorkPolicy.KEEP,
            request,
        )
    }

    fun enqueuePushSyncWithRetries(
        context: Context,
        scope: MobileSyncScope = MobileSyncScope.CHAT,
    ) {
        enqueueImmediate(context, scope, force = true)
        val appContext = context.applicationContext
        PUSH_SYNC_RETRY_DELAYS_MS.forEachIndexed { index, delayMs ->
            val request =
                OneTimeWorkRequestBuilder<BackgroundSyncWorker>()
                    .setInitialDelay(delayMs, TimeUnit.MILLISECONDS)
                    .setInputData(
                        workDataOf(
                            BackgroundSyncWorker.INPUT_SYNC_SCOPE to scope.wireName(),
                            BackgroundSyncWorker.INPUT_FORCE to true,
                        ),
                    )
                    .setConstraints(BackgroundSyncWorker.lightweightSyncConstraints())
                    .setBackoffCriteria(
                        BackoffPolicy.EXPONENTIAL,
                        TUNNEL_AWARE_BACKOFF_SECONDS,
                        TimeUnit.SECONDS,
                    )
                    .addTag(BackgroundSyncWorker.WORK_TAG_IMMEDIATE)
                    .build()
            WorkManager.getInstance(appContext).enqueueUniqueWork(
                "$UNIQUE_PUSH_SYNC_RETRY_PREFIX-${scope.wireName()}-$index",
                ExistingWorkPolicy.REPLACE,
                request,
            )
        }
    }
}
