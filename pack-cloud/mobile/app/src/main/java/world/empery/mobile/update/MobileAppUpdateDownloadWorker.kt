/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Background/resilient APK download with foreground notification and Range resume.
 *
 * Invariants:
 * - Requires authenticated session; coalesced via unique work name.
 *
 * Related:
 * - MobileAppUpdateScheduler, MobileAppUpdateRepository
 */
package world.empery.mobile.update

import android.content.Context
import android.content.pm.ServiceInfo
import android.os.Build
import androidx.work.CoroutineWorker
import androidx.work.ForegroundInfo
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import feature.profile.MobileAppUpdateDownloadSupport
import feature.profile.MobileAppUpdatePrefs
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import world.empery.mobile.MobileApp
import world.empery.mobile.observability.MobileTelemetry

class MobileAppUpdateDownloadWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result =
        withContext(Dispatchers.IO) {
            val container =
                (applicationContext as? MobileApp)?.container
                    ?: return@withContext Result.retry()
            if (!container.authRepository.hasSession()) {
                return@withContext Result.success()
            }

            val versionCode = inputData.getInt(KEY_VERSION_CODE, -1)
            if (versionCode <= 0) return@withContext Result.failure()

            val expectedTotal =
                inputData.getLong(KEY_EXPECTED_TOTAL, -1L).takeIf { it > 0L }
            val expectedSha256 = inputData.getString(KEY_EXPECTED_SHA256)?.trim()?.lowercase()

            setForeground(createForegroundInfo(null))

            return@withContext runCatching {
                val file =
                    container.mobileAppUpdateRepository.downloadApk(
                        context = applicationContext,
                        serverVersionCode = versionCode,
                        expectedTotalBytes = expectedTotal,
                        expectedSha256 = expectedSha256,
                    ) { downloaded, total ->
                        val progress =
                            MobileAppUpdateDownloadSupport.computeProgress(downloaded, total)
                        val percent = progress?.let { (it * 100f).toInt() }
                        setProgressAsync(
                            workDataOf(
                                KEY_PROGRESS to (progress ?: -1f),
                                KEY_DOWNLOADED_BYTES to downloaded,
                                KEY_TOTAL_BYTES to (total ?: -1L),
                            ),
                        )
                        setForegroundAsync(createForegroundInfo(percent))
                    }
                MobileAppUpdatePrefs.saveDownloadedApk(applicationContext, file, versionCode)
                MobileAppUpdatePrefs.saveExpectedSha256(applicationContext, expectedSha256)
                Result.success(
                    workDataOf(
                        KEY_OUTPUT_PATH to file.absolutePath,
                        KEY_VERSION_CODE to versionCode,
                    ),
                )
            }.getOrElse { error ->
                MobileTelemetry.reportError(error, "MobileAppUpdateDownloadWorker failed")
                Result.failure(workDataOf(KEY_ERROR to (error.message ?: "download failed")))
            }
        }

    private fun createForegroundInfo(progressPercent: Int?): ForegroundInfo {
        val notification =
            MobileUpdateNotificationHelper.buildForegroundNotification(
                applicationContext,
                progressPercent,
            )
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ForegroundInfo(
                MobileUpdateNotificationHelper.notificationId(),
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
            )
        } else {
            ForegroundInfo(MobileUpdateNotificationHelper.notificationId(), notification)
        }
    }

    companion object {
        const val WORK_TAG = "mobile_apk_download"
        const val UNIQUE_WORK_NAME = "mobile-apk-download"

        const val KEY_VERSION_CODE = "version_code"
        const val KEY_EXPECTED_TOTAL = "expected_total_bytes"
        const val KEY_EXPECTED_SHA256 = "expected_sha256"
        const val KEY_PROGRESS = "progress"
        const val KEY_DOWNLOADED_BYTES = "downloaded_bytes"
        const val KEY_TOTAL_BYTES = "total_bytes"
        const val KEY_OUTPUT_PATH = "output_path"
        const val KEY_ERROR = "error"
    }
}
