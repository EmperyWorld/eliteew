/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Profile OTA/APK update check, WorkManager download, one-click install (W1 C4).
 *
 * Invariants:
 * - Mutates ProfileUiState only via ProfileSessionBag.uiState.
 * - Public API remains delegated from ProfileTabViewModel for shell/ProfileScreen stability.
 *
 * Related:
 * - ProfileTabViewModel, ProfileSessionBag, feature.profile.ProfileScreen
 */
package world.empery.mobile.profile

import android.app.Application
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.work.WorkInfo
import androidx.work.WorkManager
import coil.imageLoader
import feature.profile.ApkSha256VerificationState
import feature.profile.MobileApkInstaller
import feature.profile.MobileAppUpdateDownloadSupport
import feature.profile.MobileAppUpdateMessages
import feature.profile.MobileAppUpdatePrefs
import feature.profile.PartialApkDownload
import feature.profile.PrivateTunnelConnectionModeUi
import feature.profile.PrivateTunnelUiState
import feature.profile.PrivateTunnelUiStatus
import feature.profile.ProfileCategoryId
import feature.profile.ProfileDeviceSessionUiState
import feature.profile.ProfileStorageUiState
import feature.profile.ProfileSupportBundleInput
import feature.profile.ProfileUiState
import feature.profile.R
import feature.profile.buildProfileAvatarUploadDraft
import feature.profile.buildProfileSupportBundle
import feature.profile.canShowOtaInstallButton
import feature.profile.measureProfileLocalStorage
import feature.profile.parseDownloadedApkVersionCode
import feature.profile.readBuildFlavor
import feature.profile.resolveApkSha256VerificationState
import feature.profile.resolveOtaReleaseNotesForProfile
import feature.profile.resolveOtaUpdateUrgency
import feature.profile.resolveProfileCategoryFromSection
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONObject
import retrofit2.HttpException
import world.empery.mobile.MobileApp
import world.empery.mobile.connection.EmperyConnectionService
import world.empery.mobile.core.media.EmperyMediaPlayerHolder
import world.empery.mobile.core.media.EmperyMediaStreamCachePrefs
import world.empery.mobile.core.network.SocketLifecycleState
import world.empery.mobile.core.network.api.MobilePairingChallengeResolveBody
import world.empery.mobile.core.network.api.MobileTrustedDeviceBindBody
import world.empery.mobile.core.network.api.MobileTrustedDeviceDto
import world.empery.mobile.core.network.api.MobileTrustedDeviceRevokeBody
import world.empery.mobile.core.network.api.MobileTrustedDeviceRotateWgBody
import world.empery.mobile.core.ui.prepareMobileImageUploadWebp
import world.empery.mobile.observability.MobileTelemetry
import world.empery.mobile.tunnel.MobileConnectionMode
import world.empery.mobile.tunnel.MobileConnectionModeStore
import world.empery.mobile.tunnel.MobilePrivateTunnelSnapshot
import world.empery.mobile.tunnel.MobilePrivateTunnelStartupGate
import world.empery.mobile.tunnel.MobilePrivateTunnelStatus
import world.empery.mobile.trusteddevice.MobileTrustedDeviceTunnelMetadata
import world.empery.mobile.trusteddevice.PendingWireGuardKeyPair
import world.empery.mobile.trusteddevice.TrustedDeviceBindingSync
import world.empery.mobile.trusteddevice.TrustedDeviceServerBindingResolution
import world.empery.mobile.update.MobileAppUpdateDownloadWorker
import world.empery.mobile.update.MobileAppUpdateScheduler
import java.io.File

class ProfileOtaUpdateController(
    private val bag: ProfileSessionBag,
) {
    fun bootstrap() {
        restoreDownloadedApk()
        restorePartialDownload()
        observeDownloadWork()
    }

    fun checkForUpdatesIfStale() {
        if (bag.shouldDeferNetworkForPrivateTunnel()) return
        // Always refresh server version when Profile opens (operator may publish between 6h polls).
        checkForUpdates()
    }

    private fun observeDownloadWork() {
        val ctx = bag.application
        bag.scope.launch {
            reconcileStuckOtaDownloadOnStart(ctx)
            MobileAppUpdateScheduler.observeDownloadWork(ctx).collect { workInfo ->
                if (workInfo == null) {
                    if (bag.uiState.value.appUpdate.isDownloading) {
                        bag.uiState.update { state ->
                            state.copy(appUpdate = state.appUpdate.copy(isDownloading = false))
                        }
                    }
                    return@collect
                }
                when (workInfo.state) {
                    WorkInfo.State.RUNNING -> {
                        val progress =
                            workInfo.progress.getFloat(MobileAppUpdateDownloadWorker.KEY_PROGRESS, -1f)
                                .takeIf { it >= 0f }
                        val downloaded =
                            workInfo.progress.getLong(MobileAppUpdateDownloadWorker.KEY_DOWNLOADED_BYTES, -1L)
                                .takeIf { it >= 0L }
                        val total =
                            workInfo.progress.getLong(MobileAppUpdateDownloadWorker.KEY_TOTAL_BYTES, -1L)
                                .takeIf { it > 0L }
                        bag.uiState.update { state ->
                            val computedProgress =
                                progress
                                    ?: MobileAppUpdateDownloadSupport.computeProgress(
                                        downloaded ?: state.appUpdate.partialDownloadBytes ?: 0L,
                                        total ?: state.appUpdate.apkSizeBytes,
                                    )
                            state.copy(
                                appUpdate =
                                    state.appUpdate.copy(
                                        isDownloading = true,
                                        downloadProgress = computedProgress ?: state.appUpdate.downloadProgress,
                                        partialDownloadBytes = downloaded ?: state.appUpdate.partialDownloadBytes,
                                        canResumeDownload = (downloaded ?: 0L) > 0L,
                                        error = null,
                                        statusMessage =
                                            if ((downloaded ?: 0L) > 0L) {
                                                MobileAppUpdateMessages.partialProgress(
                                                    ctx,
                                                    downloaded ?: 0L,
                                                    total ?: state.appUpdate.apkSizeBytes,
                                                )
                                            } else {
                                                MobileAppUpdateMessages.downloading(ctx)
                                            },
                                    ),
                            )
                        }
                    }
                    WorkInfo.State.ENQUEUED -> {
                        scheduleOtaEnqueuedStallWatch(ctx, workInfo.id.toString())
                    }
                    WorkInfo.State.SUCCEEDED -> {
                        val path = workInfo.outputData.getString(MobileAppUpdateDownloadWorker.KEY_OUTPUT_PATH)
                        val versionCode = workInfo.outputData.getInt(MobileAppUpdateDownloadWorker.KEY_VERSION_CODE, -1)
                        val sha = MobileAppUpdatePrefs.readExpectedSha256(ctx)
                        bag.uiState.update { state ->
                            state.copy(
                                appUpdate =
                                    state.appUpdate.copy(
                                        isDownloading = false,
                                        downloadProgress = 1f,
                                        downloadedApkPath = path,
                                        downloadedVersionCode = versionCode.takeIf { it > 0 },
                                        apkSha256 = sha ?: state.appUpdate.apkSha256,
                                        partialDownloadBytes = null,
                                        canResumeDownload = false,
                                        statusMessage = MobileAppUpdateMessages.downloadReady(ctx),
                                        error = null,
                                    ),
                            )
                        }
                        applyShaVerification(path, sha)
                    }
                    WorkInfo.State.FAILED -> {
                        bag.oneClickInstallPending = false
                        val err = workInfo.outputData.getString(MobileAppUpdateDownloadWorker.KEY_ERROR)
                        bag.uiState.update { state ->
                            state.copy(
                                appUpdate =
                                    state.appUpdate.copy(
                                        isDownloading = false,
                                        error = err ?: MobileAppUpdateMessages.downloadFailed(ctx),
                                    ),
                            )
                        }
                        val serverCode = bag.uiState.value.appUpdate.serverVersionCode
                        if (serverCode != null) {
                            val partial =
                                bag.updateRepository.updatesDir(ctx)?.let { dir ->
                                    bag.updateRepository.findPartialDownload(dir, serverCode)
                                }
                            applyPartialDownloadState(partial, bag.uiState.value.appUpdate.apkSizeBytes)
                        }
                    }
                    WorkInfo.State.CANCELLED -> {
                        bag.uiState.update { state ->
                            state.copy(
                                appUpdate =
                                    state.appUpdate.copy(
                                        isDownloading = false,
                                        statusMessage = MobileAppUpdateMessages.downloadCancelled(ctx),
                                    ),
                            )
                        }
                        val serverCode = bag.uiState.value.appUpdate.serverVersionCode
                        if (serverCode != null) {
                            val partial =
                                bag.updateRepository.updatesDir(ctx)?.let { dir ->
                                    bag.updateRepository.findPartialDownload(dir, serverCode)
                                }
                            applyPartialDownloadState(partial, bag.uiState.value.appUpdate.apkSizeBytes)
                        }
                    }
                    else -> Unit
                }
            }
        }
    }

    private fun restorePartialDownload() {
        val ctx = bag.application
        val updatesDir = bag.updateRepository.updatesDir(ctx) ?: return
        val serverCode = bag.uiState.value.appUpdate.serverVersionCode
        val partial =
            serverCode?.let { bag.updateRepository.findPartialDownload(updatesDir, it) }
                ?: findLatestPartialDownload(updatesDir)
                ?: return
        val total = bag.uiState.value.appUpdate.apkSizeBytes
        val progress = MobileAppUpdateDownloadSupport.computeProgress(partial.downloadedBytes, total)
        bag.uiState.update {
            it.copy(
                appUpdate =
                    it.appUpdate.copy(
                        partialDownloadBytes = partial.downloadedBytes,
                        canResumeDownload = true,
                        downloadProgress = progress,
                        statusMessage =
                            MobileAppUpdateMessages.partialProgress(
                                ctx,
                                partial.downloadedBytes,
                                total,
                            ),
                    ),
            )
        }
    }

    private fun findLatestPartialDownload(updatesDir: File): PartialApkDownload? {
        val parts =
            updatesDir.listFiles { file ->
                file.isFile && file.name.endsWith(MobileAppUpdateDownloadSupport.PART_SUFFIX)
            }?.toList().orEmpty()
        val latest = parts.maxByOrNull { it.lastModified() } ?: return null
        val versionToken = latest.name.removePrefix("empery-mobile-v").substringBefore(".apk")
        val versionCode = versionToken.toIntOrNull() ?: return null
        return PartialApkDownload(
            versionCode = versionCode,
            partFile = latest,
            downloadedBytes = latest.length(),
        )
    }

    private fun applyPartialDownloadState(
        partial: PartialApkDownload?,
        totalBytes: Long?,
    ) {
        if (partial == null) return
        val progress = MobileAppUpdateDownloadSupport.computeProgress(partial.downloadedBytes, totalBytes)
        bag.uiState.update {
            it.copy(
                appUpdate =
                    it.appUpdate.copy(
                        partialDownloadBytes = partial.downloadedBytes,
                        canResumeDownload = true,
                        downloadProgress = progress,
                        statusMessage =
                            MobileAppUpdateMessages.partialProgress(
                                bag.application,
                                partial.downloadedBytes,
                                totalBytes,
                            ),
                    ),
            )
        }
    }

    private fun restoreDownloadedApk() {
        val ctx = bag.application
        val path = MobileAppUpdatePrefs.readDownloadedApk(ctx) ?: return
        val file = File(path)
        val expectedSha = MobileAppUpdatePrefs.readExpectedSha256(ctx)
        val downloadedVersion = MobileAppUpdatePrefs.readDownloadedVersionCode(ctx)
        if (!file.isFile || !bag.updateRepository.verifyApkFile(file, expectedSha)) {
            MobileAppUpdatePrefs.clearDownloadedApk(ctx)
            file.delete()
            return
        }
        bag.uiState.update {
            it.copy(
                appUpdate =
                    it.appUpdate.copy(
                        downloadedApkPath = path,
                        downloadedVersionCode = downloadedVersion ?: parseDownloadedApkVersionCode(path),
                        apkSha256 = expectedSha,
                        statusMessage = MobileAppUpdateMessages.downloadReadyRestored(ctx),
                    ),
            )
        }
    }

    fun checkForUpdates() = bag.scope.launch {
        if (!bag.hasSession()) return@launch
        if (bag.shouldDeferNetworkForPrivateTunnel()) return@launch
        runUpdateCheck(continueOneClickAfterCheck = false)
    }

    fun updateAppOneClick() = bag.scope.launch {
        if (!bag.hasSession()) return@launch
        if (bag.shouldDeferNetworkForPrivateTunnel()) return@launch
        bag.oneClickInstallPending = true
        val checkOk = runUpdateCheck(continueOneClickAfterCheck = true)
        if (!checkOk) {
            bag.oneClickInstallPending = false
        }
    }

    private suspend fun runUpdateCheck(continueOneClickAfterCheck: Boolean): Boolean {
        val ctx = bag.application
        bag.uiState.update {
            it.copy(
                appUpdate =
                    it.appUpdate.copy(
                        isChecking = true,
                        error = null,
                        statusMessage = null,
                    ),
            )
        }
        return try {
            runCatching {
                val installedCode = MobileApkInstaller.installedVersionCode(ctx)
                bag.updateRepository.fetchOverview(installedVersionCode = installedCode)
            }
                .onSuccess { overview ->
                val installedCode = MobileApkInstaller.installedVersionCode(ctx)
                val updateAvailable =
                    MobileApkInstaller.isServerUpdateAvailable(installedCode, overview.versionCode)
                bag.uiState.update {
                    it.copy(
                        appUpdate =
                            it.appUpdate.copy(
                                isChecking = false,
                                installedVersionCode = installedCode,
                                installedVersionName = MobileApkInstaller.installedVersionName(ctx),
                                serverVersionCode = overview.versionCode,
                                serverVersionName = overview.versionName,
                                apkAvailable = overview.apkAvailable,
                                apkSizeBytes = overview.apkSizeBytes,
                                apkSha256 = overview.apkSha256,
                                updateAvailable = updateAvailable,
                                serverHostLabel = bag.resolveApiHostLabel(),
                                releaseNotes =
                                    resolveOtaReleaseNotesForProfile(
                                        installedVersionCode = installedCode,
                                        overview = overview,
                                    )
                                        ?: overview.versionName?.let { version -> "Обновление версии $version" },
                                updateUrgency = resolveOtaUpdateUrgency(
                                    updateAvailable = updateAvailable,
                                    apkAvailable = overview.apkAvailable,
                                    versionDelta = overview.versionCode?.minus(installedCode),
                                    installedVersionCode = installedCode,
                                    minSupportedVersionCode = overview.minSupportedVersionCode,
                                ),
                                downloadedApkPath =
                                    if (updateAvailable) {
                                        it.appUpdate.downloadedApkPath
                                    } else {
                                        null
                                    },
                                statusMessage =
                                    MobileAppUpdateMessages.formatUpdateStatusMessage(
                                        ctx,
                                        installedCode = installedCode,
                                        installedName = MobileApkInstaller.installedVersionName(ctx),
                                        serverCode = overview.versionCode,
                                        serverName = overview.versionName,
                                        apkAvailable = overview.apkAvailable,
                                        updateAvailable = updateAvailable,
                                        apkSizeBytes = overview.apkSizeBytes,
                                    ),
                                partialDownloadBytes = null,
                                canResumeDownload = false,
                            ),
                    )
                }
                MobileAppUpdatePrefs.saveExpectedSha256(ctx, overview.apkSha256)
                MobileAppUpdatePrefs.markUpdateCheck(ctx, updateAvailable)
                overview.versionCode?.let { code ->
                    reconcileDownloadedApkForServer(code)
                    val partial =
                        bag.updateRepository.updatesDir(ctx)?.let { dir ->
                            bag.updateRepository.findPartialDownload(dir, code)
                        }
                    applyPartialDownloadState(partial, overview.apkSizeBytes)
                }
                val restoredPath = bag.uiState.value.appUpdate.downloadedApkPath
                if (!restoredPath.isNullOrBlank()) {
                    applyShaVerification(restoredPath, overview.apkSha256)
                }
                if (continueOneClickAfterCheck) {
                    continueOneClickUpdateAfterCheck()
                }
            }
                .onFailure { err ->
                    if (err is CancellationException || err.cause is CancellationException) throw err
                    MobileTelemetry.reportError(err, "checkForUpdates failed")
                    bag.uiState.update {
                        it.copy(
                            appUpdate =
                                it.appUpdate.copy(
                                    isChecking = false,
                                    error = err.message ?: MobileAppUpdateMessages.checkFailed(ctx),
                                ),
                        )
                    }
                }
                .isSuccess
        } catch (err: CancellationException) {
            bag.uiState.update {
                it.copy(appUpdate = it.appUpdate.copy(isChecking = false))
            }
            throw err
        }
    }

    private fun continueOneClickUpdateAfterCheck() {
        if (!bag.oneClickInstallPending) return
        val update = bag.uiState.value.appUpdate
        if (!update.updateAvailable || !update.apkAvailable) {
            bag.oneClickInstallPending = false
            return
        }
        if (canShowOtaInstallButton(update)) {
            requestAutoInstall()
            bag.oneClickInstallPending = false
            return
        }
        downloadUpdate()
    }

    private fun maybeCompleteOneClickInstall() {
        if (!bag.oneClickInstallPending) return
        val update = bag.uiState.value.appUpdate
        if (!canShowOtaInstallButton(update)) return
        requestAutoInstall()
        bag.oneClickInstallPending = false
    }

    private fun requestAutoInstall() {
        val ctx = bag.application
        val update = bag.uiState.value.appUpdate
        if (!canShowOtaInstallButton(update)) {
            handleOtaInstallAborted(retryDownload = true)
            return
        }
        bag.uiState.update {
            it.copy(
                appUpdate =
                    it.appUpdate.copy(
                        installRequestNonce = System.currentTimeMillis(),
                        statusMessage = MobileAppUpdateMessages.launchingInstall(ctx),
                    ),
            )
        }
    }

    fun handleOtaInstallAborted(retryDownload: Boolean = false) {
        val ctx = bag.application
        bag.oneClickInstallPending = false
        val update = bag.uiState.value.appUpdate
        val path = update.downloadedApkPath
        val fileMissing =
            !path.isNullOrBlank() && !File(path).isFile
        if (fileMissing) {
            MobileAppUpdatePrefs.clearDownloadedApk(ctx)
            path?.let { File(it).delete() }
        }
        bag.uiState.update {
            it.copy(
                appUpdate =
                    it.appUpdate.copy(
                        installRequestNonce = 0L,
                        statusMessage = null,
                        downloadedApkPath = if (fileMissing) null else it.appUpdate.downloadedApkPath,
                        downloadedVersionCode = if (fileMissing) null else it.appUpdate.downloadedVersionCode,
                        sha256Verification =
                            if (fileMissing) {
                                ApkSha256VerificationState.UNKNOWN
                            } else {
                                it.appUpdate.sha256Verification
                            },
                        error =
                            if (fileMissing) {
                                MobileAppUpdateMessages.apkFileMissing(ctx)
                            } else {
                                it.appUpdate.error
                            },
                    ),
            )
        }
        if (retryDownload && update.updateAvailable && update.apkAvailable && !update.isDownloading) {
            bag.oneClickInstallPending = true
            downloadUpdate()
        }
    }

    fun downloadUpdate() {
        if (!bag.hasSession()) return
        val update = bag.uiState.value.appUpdate
        val serverCode = update.serverVersionCode ?: return
        if (!update.updateAvailable || !update.apkAvailable) return
        val ctx = bag.application
        val resumeBytes = update.partialDownloadBytes
        MobileAppUpdatePrefs.saveExpectedSha256(ctx, update.apkSha256)
        bag.uiState.update {
            it.copy(
                appUpdate =
                    it.appUpdate.copy(
                        isDownloading = true,
                        downloadProgress =
                            MobileAppUpdateDownloadSupport.computeProgress(
                                resumeBytes ?: 0L,
                                update.apkSizeBytes,
                            ),
                        error = null,
                        statusMessage =
                            if (resumeBytes != null && resumeBytes > 0L) {
                                MobileAppUpdateMessages.resumeDownloading(ctx)
                            } else {
                                MobileAppUpdateMessages.downloading(ctx)
                            },
                        downloadedApkPath = null,
                        downloadedVersionCode = null,
                    ),
            )
        }
        MobileAppUpdateScheduler.enqueueDownload(
            context = ctx,
            versionCode = serverCode,
            expectedTotalBytes = update.apkSizeBytes,
            expectedSha256 = update.apkSha256,
            replaceExisting = update.canResumeDownload || (resumeBytes != null && resumeBytes > 0L),
        )
    }
    private suspend fun reconcileStuckOtaDownloadOnStart(ctx: Application) {
        val workInfo =
            withContext(Dispatchers.IO) {
                WorkManager.getInstance(ctx.applicationContext)
                    .getWorkInfosForUniqueWork(MobileAppUpdateDownloadWorker.UNIQUE_WORK_NAME)
                    .get()
                    .firstOrNull()
            } ?: return
        if (workInfo.state != WorkInfo.State.ENQUEUED) return
        Log.w(ProfileSessionBag.TAG, "[STEP] ota_download_stuck_enqueued_reset workId=${workInfo.id}")
        resetStuckOtaDownload(ctx, MobileAppUpdateMessages.downloadStalled(ctx))
    }

    private fun scheduleOtaEnqueuedStallWatch(ctx: Application, workId: String) {
        if (bag.otaEnqueuedWatchWorkId == workId) return
        bag.otaEnqueuedWatchWorkId = workId
        bag.scope.launch {
            delay(ProfileSessionBag.OTA_ENQUEUED_STALL_MS)
            val workInfo =
                withContext(Dispatchers.IO) {
                    WorkManager.getInstance(ctx.applicationContext)
                        .getWorkInfosForUniqueWork(MobileAppUpdateDownloadWorker.UNIQUE_WORK_NAME)
                        .get()
                        .firstOrNull()
                }
            if (workInfo?.id?.toString() != workId || workInfo.state != WorkInfo.State.ENQUEUED) {
                bag.otaEnqueuedWatchWorkId = null
                return@launch
            }
            Log.w(ProfileSessionBag.TAG, "[STEP] ota_download_enqueued_timeout workId=$workId")
            resetStuckOtaDownload(ctx, MobileAppUpdateMessages.downloadStalled(ctx))
            bag.otaEnqueuedWatchWorkId = null
        }
    }

    private fun resetStuckOtaDownload(ctx: Application, message: String) {
        bag.oneClickInstallPending = false
        MobileAppUpdateScheduler.cancelDownload(ctx)
        bag.uiState.update {
            it.copy(
                appUpdate =
                    it.appUpdate.copy(
                        isDownloading = false,
                        isDownloadPaused = false,
                        downloadProgress = null,
                        error = message,
                        statusMessage = null,
                    ),
            )
        }
    }

    fun cancelDownload() {
        val ctx = bag.application
        MobileAppUpdateScheduler.cancelDownload(ctx)
        bag.uiState.update {
            it.copy(appUpdate = it.appUpdate.copy(isDownloading = false, isDownloadPaused = false))
        }
    }

    fun pauseDownload() {
        cancelDownload()
        bag.uiState.update { it.copy(appUpdate = it.appUpdate.copy(isDownloadPaused = true)) }
    }

    private fun applyShaVerification(path: String?, sha: String?) {
        val verified = path?.let { p ->
            val file = File(p)
            if (!file.isFile) null else bag.updateRepository.verifyApkFile(file, sha)
        }
        val state = resolveApkSha256VerificationState(path, sha, verified)
        bag.uiState.update { it.copy(appUpdate = it.appUpdate.copy(sha256Verification = state)) }
        maybeCompleteOneClickInstall()
    }

    private fun reconcileDownloadedApkForServer(serverVersionCode: Int) {
        val ctx = bag.application
        val update = bag.uiState.value.appUpdate
        val downloadedCode =
            update.downloadedVersionCode
                ?: parseDownloadedApkVersionCode(update.downloadedApkPath)
                ?: MobileAppUpdatePrefs.readDownloadedVersionCode(ctx)
        if (downloadedCode == null || downloadedCode == serverVersionCode) return
        val path = update.downloadedApkPath
        MobileAppUpdatePrefs.clearDownloadedApk(ctx)
        path?.let { File(it).delete() }
        bag.uiState.update {
            it.copy(
                appUpdate =
                    it.appUpdate.copy(
                        downloadedApkPath = null,
                        downloadedVersionCode = null,
                        sha256Verification = ApkSha256VerificationState.UNKNOWN,
                        installRequestNonce = 0L,
                        statusMessage = null,
                    ),
            )
        }
    }

}

