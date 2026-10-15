/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * HTTP sync for the mobile-only profile blob (`users.preferences.mobile`): pull, push, wallpaper upload/download.
 *
 * Invariants:
 * - Separate from web UserPreferences; maps to MobileProfileResponse on API.
 * - Remote wins when server updated_at differs from local server watermark.
 * - call_target is refreshed from GET mobile-app/profile; writes go to profile/preferences.
 *
 * Related:
 * - MobileProfileLocalStore.kt, MobileProfileSync.kt, api/services/mobile_profile_service.py
 */
package feature.profile

import android.content.Context
import android.net.Uri
import android.util.Log
import feature.notifications.MobileNotificationPreferences
import feature.notifications.NotificationPreferencesSnapshot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import world.empery.mobile.core.network.api.MobileAppApi
import world.empery.mobile.core.network.api.MobileNotificationProfileDto
import world.empery.mobile.core.network.api.MobileProfileResponse
import world.empery.mobile.core.network.api.MobileProfileUpdateBody
import world.empery.mobile.core.network.api.ProfileApi
import world.empery.mobile.core.network.api.UnifiedContentApi
import world.empery.mobile.core.network.api.UserPreferencesUpdateBody
import world.empery.mobile.core.network.api.VideoCallsPreferencesDto
import world.empery.mobile.core.ui.ImageUploadDraft
import world.empery.mobile.core.ui.MobileUiScale
import world.empery.mobile.core.ui.prepareMobileImageUploadWebp
import java.io.File

class MobileProfileRepository(
    private val appContext: Context,
    private val mobileAppApi: MobileAppApi,
    private val contentUploadApi: UnifiedContentApi,
    private val contentDownloadApi: UnifiedContentApi,
    private val profileApi: ProfileApi,
) {
    suspend fun pullAndApply(): MobileProfileSnapshot? =
        withContext(Dispatchers.IO) {
            runCatching {
                val remote = mobileAppApi.getMobileProfile()
                // Refresh call_target (may change via web Связи without mobile.updated_at).
                MobileProfileLocalStore.setCallTarget(appContext, remote.callTarget)
                val localWatermark = MobileProfileLocalStore.getServerUpdatedAt(appContext)
                when {
                    remote.updatedAt != null && remote.updatedAt == localWatermark ->
                        MobileProfileLocalStore.read(appContext)
                    remote.updatedAt == null && localWatermark == null -> {
                        pushLocalSnapshotInternal()
                        MobileProfileLocalStore.read(appContext)
                    }
                    remote.updatedAt != null -> {
                        val localNotif = MobileNotificationPreferences.read(appContext)
                        val snapshot = remote.toSnapshot(localNotif)
                        val resolved = resolveWallpaper(snapshot)
                        MobileProfileLocalStore.apply(appContext, resolved)
                        resolved
                    }
                    else -> {
                        pushLocalSnapshotInternal()
                        MobileProfileLocalStore.read(appContext)
                    }
                }
            }.onFailure { err ->
                Log.w(TAG, "mobile profile pull failed: ${err.message}")
            }.getOrNull()
        }

    suspend fun pushLocalSnapshot() =
        withContext(Dispatchers.IO) {
            pushLocalSnapshotInternal()
        }

    /**
     * Persist [callTarget] via `PATCH profile/preferences` and update the local mirror.
     * @return normalized value from the server response
     */
    suspend fun updateCallTarget(callTarget: String): String =
        withContext(Dispatchers.IO) {
            val next = VideoCallTarget.normalize(callTarget)
            val updated =
                profileApi.updatePreferences(
                    UserPreferencesUpdateBody(
                        video_calls = VideoCallsPreferencesDto(call_target = next),
                    ),
                )
            val saved =
                VideoCallTarget.normalize(updated.video_calls?.call_target ?: next)
            MobileProfileLocalStore.setCallTarget(appContext, saved)
            saved
        }

    suspend fun syncBackgroundWallpaper() =
        withContext(Dispatchers.IO) {
            runCatching {
                val uriString = MobileUiStylePreferences.getBackgroundImage(appContext)
                if (uriString.isNullOrBlank()) {
                    clearBackgroundOnServer()
                    return@withContext
                }
                val contentId = uploadWallpaperContent(uriString)
                MobileProfileLocalStore.setBackgroundContentId(appContext, contentId)
                val response =
                    mobileAppApi.patchMobileProfile(
                        MobileProfileUpdateBody(backgroundContentId = contentId),
                    )
                MobileProfileLocalStore.setServerUpdatedAt(appContext, response.updatedAt)
            }.onFailure { err ->
                Log.w(TAG, "mobile profile wallpaper sync failed: ${err.message}")
            }
        }

    private suspend fun pushLocalSnapshotInternal() {
        runCatching {
            val local = MobileProfileLocalStore.read(appContext)
            val response = mobileAppApi.patchMobileProfile(local.toUpdateBody())
            MobileProfileLocalStore.setServerUpdatedAt(appContext, response.updatedAt)
        }.onFailure { err ->
            Log.w(TAG, "mobile profile push failed: ${err.message}")
        }
    }

    private suspend fun clearBackgroundOnServer() {
        mobileAppApi.patchMobileProfile(MobileProfileUpdateBody(backgroundContentId = ""))
        MobileProfileLocalStore.setBackgroundContentId(appContext, null)
    }

    private suspend fun resolveWallpaper(snapshot: MobileProfileSnapshot): MobileProfileSnapshot {
        val contentId = snapshot.backgroundContentId?.trim()?.takeIf { it.isNotEmpty() }
        if (contentId == null) {
            MobileUiStylePreferences.setBackgroundImage(appContext, null)
            return snapshot
        }
        val cachedId = MobileProfileLocalStore.getBackgroundContentId(appContext)
        val existingUri = MobileUiStylePreferences.getBackgroundImage(appContext)
        if (contentId == cachedId && !existingUri.isNullOrBlank()) {
            return snapshot
        }
        val localUri = downloadWallpaper(contentId)
        if (localUri != null) {
            MobileUiStylePreferences.setBackgroundImage(appContext, localUri)
        }
        return snapshot
    }

    private suspend fun downloadWallpaper(contentId: String): String? {
        val dir = File(appContext.filesDir, WALLPAPER_DIR).apply { mkdirs() }
        val out = File(dir, "wallpaper-$contentId.bin")
        if (out.exists() && out.length() > 0L) {
            return Uri.fromFile(out).toString()
        }
        val body = contentDownloadApi.downloadContent(contentId)
        body.byteStream().use { input ->
            out.outputStream().use { output -> input.copyTo(output) }
        }
        return if (out.length() > 0L) Uri.fromFile(out).toString() else null
    }

    private suspend fun uploadWallpaperContent(uriString: String): String {
        val uri = Uri.parse(uriString)
        val mime =
            appContext.contentResolver.getType(uri)?.takeIf { it.startsWith("image/") }
                ?: "image/jpeg"
        val draft =
            ImageUploadDraft(
                uri = uriString,
                displayName = "mobile-wallpaper-${System.currentTimeMillis()}.webp",
                mimeType = mime,
                sizeBytes = null,
            )
        val prepared = prepareMobileImageUploadWebp(appContext, draft)
        try {
            val uploadUri = prepared.uri
            val fileBody =
                prepared.tempFile?.asRequestBody(prepared.mimeType.toMediaTypeOrNull())
                    ?: appContext.contentResolver.openInputStream(uploadUri)?.use { stream ->
                        stream.readBytes().toRequestBody(prepared.mimeType.toMediaTypeOrNull())
                    }
                    ?: error("Cannot read wallpaper bytes")
            val part =
                MultipartBody.Part.createFormData(
                    "file",
                    prepared.displayName,
                    fileBody,
                )
            val created =
                contentUploadApi.uploadContent(
                    file = part,
                    name = prepared.displayName,
                    folderItemId = null,
                )
            return created.id
        } finally {
            prepared.tempFile?.delete()
        }
    }

    private fun MobileProfileResponse.toSnapshot(
        preserveMuted: NotificationPreferencesSnapshot,
    ): MobileProfileSnapshot {
        val notifDto = notifications ?: MobileNotificationProfileDto()
        return MobileProfileSnapshot(
            uiStyle = MobileUiStyle.fromStorage(uiStyle),
            colorMode = MobileColorMode.fromStorage(colorMode),
            uiScale = MobileUiScale.fromStorage(uiScale),
            notificationsEnabled = notificationsEnabled,
            reduceMotion = reduceMotion,
            highContrastHint = highContrastHint,
            streamCacheWifiOnly = streamCacheWifiOnly,
            backgroundContentId = backgroundContentId?.trim()?.takeIf { it.isNotEmpty() },
            serverUpdatedAt = updatedAt,
            notificationPrefs =
                preserveMuted.copy(
                    chatEnabled = notifDto.chatEnabled,
                    friendsEnabled = notifDto.friendsEnabled,
                    ugsEnabled = notifDto.ugsEnabled,
                    systemEnabled = notifDto.systemEnabled,
                    quietHoursEnabled = notifDto.quietHoursEnabled,
                    quietHoursStartMinute = notifDto.quietHoursStartMinute,
                    quietHoursEndMinute = notifDto.quietHoursEndMinute,
                ),
            callTarget = VideoCallTarget.normalize(callTarget),
        )
    }

    private fun MobileProfileSnapshot.toUpdateBody(): MobileProfileUpdateBody {
        val notif = notificationPrefs
        return MobileProfileUpdateBody(
            uiStyle = MobileUiStyle.toStorage(uiStyle),
            colorMode = MobileColorMode.toStorage(colorMode),
            uiScale = MobileUiScale.toStorage(uiScale),
            notificationsEnabled = notificationsEnabled,
            reduceMotion = reduceMotion,
            highContrastHint = highContrastHint,
            streamCacheWifiOnly = streamCacheWifiOnly,
            backgroundContentId = backgroundContentId,
            notifications =
                MobileNotificationProfileDto(
                    chatEnabled = notif.chatEnabled,
                    friendsEnabled = notif.friendsEnabled,
                    ugsEnabled = notif.ugsEnabled,
                    systemEnabled = notif.systemEnabled,
                    quietHoursEnabled = notif.quietHoursEnabled,
                    quietHoursStartMinute = notif.quietHoursStartMinute,
                    quietHoursEndMinute = notif.quietHoursEndMinute,
                ),
        )
    }

    companion object {
        private const val TAG = "MobileProfileRepository"
        private const val WALLPAPER_DIR = "mobile_profile_wallpaper"
    }
}
