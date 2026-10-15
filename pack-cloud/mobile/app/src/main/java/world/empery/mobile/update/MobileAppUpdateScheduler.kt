/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Enqueue and observe WorkManager jobs for OTA APK download.
 *
 * Invariants:
 * - Download uses ExistingWorkPolicy.KEEP to avoid parallel APK writers.
 * - User-initiated OTA uses CONNECTED (not UNMETERED) so metered Wi‑Fi does not stall ENQUEUED forever.
 *
 * Related:
 * - MobileAppUpdateDownloadWorker, ProfileTabViewModel
 */
package world.empery.mobile.update

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType.CONNECTED
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkInfo
import androidx.work.WorkManager
import androidx.work.workDataOf
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

object MobileAppUpdateScheduler {
    fun enqueueDownload(
        context: Context,
        versionCode: Int,
        expectedTotalBytes: Long?,
        expectedSha256: String?,
        replaceExisting: Boolean = false,
    ) {
        val request =
            OneTimeWorkRequestBuilder<MobileAppUpdateDownloadWorker>()
                .setInputData(
                    workDataOf(
                        MobileAppUpdateDownloadWorker.KEY_VERSION_CODE to versionCode,
                        MobileAppUpdateDownloadWorker.KEY_EXPECTED_TOTAL to (expectedTotalBytes ?: -1L),
                        MobileAppUpdateDownloadWorker.KEY_EXPECTED_SHA256 to (expectedSha256 ?: ""),
                    ),
                )
                .setConstraints(otaDownloadConstraints())
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .addTag(MobileAppUpdateDownloadWorker.WORK_TAG)
                .build()
        WorkManager.getInstance(context.applicationContext).enqueueUniqueWork(
            MobileAppUpdateDownloadWorker.UNIQUE_WORK_NAME,
            if (replaceExisting) ExistingWorkPolicy.REPLACE else ExistingWorkPolicy.KEEP,
            request,
        )
    }

    fun observeDownloadWork(context: Context): Flow<WorkInfo?> =
        WorkManager.getInstance(context.applicationContext)
            .getWorkInfosForUniqueWorkFlow(MobileAppUpdateDownloadWorker.UNIQUE_WORK_NAME)
            .map { infos -> infos.firstOrNull() }

    fun cancelDownload(context: Context) {
        WorkManager.getInstance(context.applicationContext)
            .cancelUniqueWork(MobileAppUpdateDownloadWorker.UNIQUE_WORK_NAME)
    }

    /** Explicit user OTA — any validated internet (including metered Wi‑Fi / private tunnel). */
    fun otaDownloadConstraints(): Constraints =
        Constraints.Builder()
            .setRequiredNetworkType(CONNECTED)
            .setRequiresStorageNotLow(true)
            .build()
}
