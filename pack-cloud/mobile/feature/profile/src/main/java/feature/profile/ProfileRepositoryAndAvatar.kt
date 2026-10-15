/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Profile repository, avatar placeholder, and OTA banner/pill helpers (W1 C4).
 *
 * Invariants:
 * - Same package as ProfileFeature; ProfileScreen call sites unchanged.
 *
 * Related:
 * - ProfileFeature.kt, ProfileUiModels.kt, MobileProfileRepository
 */
package feature.profile

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.BorderStroke
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.outlined.CameraAlt
import androidx.compose.material.icons.outlined.OpenInBrowser
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Badge
import androidx.compose.material.icons.outlined.BlurOn
import androidx.compose.material.icons.outlined.BrightnessAuto
import androidx.compose.material.icons.outlined.Mail
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Image
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Palette
import androidx.compose.material.icons.outlined.PhotoLibrary
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.RestartAlt
import androidx.compose.material.icons.outlined.SystemUpdate
import androidx.compose.material.icons.outlined.SupportAgent
import androidx.compose.material.icons.outlined.Storage
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material.icons.outlined.PrivacyTip
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.VpnKey
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.LinearProgressIndicator
import java.io.File
import androidx.compose.material.icons.outlined.TextFields
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.LocalContext
import android.widget.Toast
import world.empery.mobile.core.network.FriendCirclesProvider
import world.empery.mobile.core.network.api.MobilePushTokenBody
import world.empery.mobile.core.network.api.FriendCircleItemDto
import world.empery.mobile.core.network.api.ProfileApi
import world.empery.mobile.core.network.api.ProfileMeResponse
import androidx.compose.material.icons.outlined.Download
import world.empery.mobile.core.network.api.ProfilePrivacyDto
import world.empery.mobile.core.ui.ScaledButton
import world.empery.mobile.core.ui.ScaledOutlinedButton
import world.empery.mobile.core.network.api.ProfilePrivacyUpdateBody
import world.empery.mobile.core.storage.MobileDatabase
import world.empery.mobile.core.storage.ProfileEntity
import okhttp3.MultipartBody
import world.empery.mobile.core.ui.prepareMobileImageUploadWebp
import world.empery.mobile.core.ui.PremiumGlassCard
import world.empery.mobile.core.ui.PremiumIconTile
import world.empery.mobile.core.ui.PremiumLoadingCard
import world.empery.mobile.core.ui.PremiumMetricPill
import world.empery.mobile.core.ui.PremiumRowSurface
import world.empery.mobile.core.ui.mobileMinimumTouchTarget
import world.empery.mobile.core.network.SocketLifecycleState
import world.empery.mobile.core.ui.LocalMobileWindowLayout
import world.empery.mobile.core.ui.ChatTypographySettings
import world.empery.mobile.core.ui.ChatVisualStyle
import world.empery.mobile.core.ui.MobileWindowWidthClass
import world.empery.mobile.core.ui.PremiumSectionCard
import world.empery.mobile.core.ui.PremiumStateCard
import world.empery.mobile.core.ui.rememberMobileScaleChromePolicy
import coil.request.ImageRequest
import world.empery.mobile.core.network.EwDeskLinkedMediaUrls
import world.empery.mobile.core.ui.LocalMobileApiBaseUrl
import world.empery.mobile.core.ui.MobileAvatarPlaceholder
import world.empery.mobile.core.ui.mobileAvatarInitials


class ProfileRepository(
    private val api: ProfileApi,
    private val db: MobileDatabase,
    private val appContext: android.content.Context,
    private val friendCirclesProvider: FriendCirclesProvider,
) {
    private val meEtagCache = ProfileMeEtagCache()

    suspend fun loadFromCache(): ProfileEntity? = db.profileDao().getCurrent()

    suspend fun registerMobilePushToken(token: String, deviceId: String? = null) {
        val trimmed = token.trim()
        require(trimmed.length >= 8) { "FCM token too short" }
        api.putMobilePushToken(
            MobilePushTokenBody(
                token = trimmed,
                device_id = deviceId?.trim()?.takeIf { it.isNotBlank() },
            ),
        )
    }

    suspend fun unregisterMobilePushToken(token: String, deviceId: String? = null) {
        val trimmed = token.trim()
        if (trimmed.length < 8) return
        api.deleteMobilePushToken(
            MobilePushTokenBody(
                token = trimmed,
                device_id = deviceId?.trim()?.takeIf { it.isNotBlank() },
            ),
        )
    }

    suspend fun refresh(): ProfileEntity {
        val cachedEntity = db.profileDao().getCurrent()
        val cachedDto =
            cachedEntity?.let {
                ProfileMeResponse(
                    id = it.id,
                    email = it.email.orEmpty(),
                    username = it.username.orEmpty(),
                    full_name = it.fullName,
                    avatar_url = it.avatarUrl,
                )
            }
        val response = api.getMeConditional(ifNoneMatch = meEtagCache.etag)
        val me =
            world.empery.mobile.core.network.resolveConditionalGet(
                response = response,
                cached = cachedDto,
                onEtag = { etag -> meEtagCache.remember(etag) },
            )
        if (world.empery.mobile.core.network.HttpEtagSupport.isNotModified(response) && cachedEntity != null) {
            android.util.Log.d("ProfileRepository", "profile/me 304 — reusing Room cache")
            return cachedEntity
        }
        val entity =
            ProfileEntity(
                id = me.id,
                email = me.email,
                username = me.username,
                fullName = me.full_name,
                avatarUrl = me.avatar_url,
                updatedAtEpochMs = System.currentTimeMillis(),
            )
        db.profileDao().upsert(entity)
        return entity
    }

    suspend fun getPrivacy(): ProfilePrivacyDto = api.getPrivacy()

    suspend fun loadPrivacyCircles(): List<FriendCircleItemDto> =
        friendCirclesProvider.loadFriendCircles()

    suspend fun uploadAvatar(pickedUri: Uri): ProfileEntity {
        val draft = buildProfileAvatarUploadDraft(appContext, pickedUri)
        val prepared = prepareMobileImageUploadWebp(appContext, draft)
        try {
            val uri = prepared.uri
            val contentResolver = appContext.contentResolver
            val contentLength =
                prepared.sizeBytes ?: runCatching {
                    contentResolver.openFileDescriptor(uri, "r")?.use { fd ->
                        fd.statSize.takeIf { it > 0 }
                    }
                }.getOrNull()
            if (contentLength != null && contentLength > PROFILE_AVATAR_MAX_BYTES) {
                throw IllegalArgumentException(
                    appContext.getString(R.string.profile_avatar_too_large),
                )
            }
            val requestBody =
                ProfileAvatarUriRequestBody(
                    contentResolver = contentResolver,
                    uri = uri,
                    mimeType = prepared.mimeType,
                    knownLength = contentLength,
                    streamOpenError = appContext.getString(R.string.profile_avatar_upload_stream_failed),
                )
            val multipartPart =
                MultipartBody.Part.createFormData(
                    "file",
                    prepared.displayName,
                    requestBody,
                )
            api.uploadAvatar(multipartPart)
            return refresh()
        } finally {
            prepared.tempFile?.delete()
        }
    }

    suspend fun deleteAvatar(): ProfileEntity {
        api.deleteAvatar()
        return refresh()
    }

    suspend fun updatePrivacy(
        discoverability: String,
        avatarVisibility: String,
        avatarCircleId: String?,
        fullNameVisibility: String,
        fullNameCircleId: String?,
        bioVisibility: String,
        bioCircleId: String?,
    ): ProfilePrivacyDto =
        api.updatePrivacy(
            ProfilePrivacyUpdateBody(
                discoverability = discoverability,
                avatar_visibility = avatarVisibility,
                avatar_circle_id = avatarCircleId,
                full_name_visibility = fullNameVisibility,
                full_name_circle_id = fullNameCircleId,
                bio_visibility = bioVisibility,
                bio_circle_id = bioCircleId,
            ),
        )
}

private fun profileInitials(entity: ProfileEntity?): String =
    mobileAvatarInitials(displayName = entity?.fullName, username = entity?.username)

@Composable
fun ProfileAvatarPlaceholder(
    entity: ProfileEntity?,
    modifier: Modifier = Modifier.size(72.dp),
    onClick: (() -> Unit)? = null,
    isUploading: Boolean = false,
    apiBaseUrl: String = LocalMobileApiBaseUrl.current,
) {
    val initials = profileInitials(entity)
    val rawUrl = entity?.avatarUrl.orEmpty()
    val absoluteUrl =
        remember(rawUrl, apiBaseUrl, entity?.updatedAtEpochMs) {
            if (rawUrl.isBlank()) {
                null
            } else if (apiBaseUrl.isNotBlank()) {
                EwDeskLinkedMediaUrls.resolveApiMediaUrl(apiBaseUrl, rawUrl)
            } else {
                rawUrl.takeIf {
                    it.startsWith("http://", ignoreCase = true) || it.startsWith("https://", ignoreCase = true)
                }
            }
        }
    val hasPhotoUrl = !absoluteUrl.isNullOrBlank()
    val desc =
        if (hasPhotoUrl) {
            stringResource(R.string.profile_avatar_cd_photo, initials)
        } else {
            stringResource(R.string.profile_avatar_cd_initials, initials)
        }
    Box(modifier = modifier) {
        MobileAvatarPlaceholder(
            initials = initials,
            imageUrl = absoluteUrl,
            contentDescription = desc,
            modifier = Modifier.fillMaxSize(),
            onClick = onClick,
            isUploading = false,
            cacheKeySuffix = entity?.updatedAtEpochMs ?: 0L,
        )
        if (isUploading) {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .clip(CircleShape)
                        .background(Color.Black.copy(alpha = 0.45f)),
                contentAlignment = Alignment.Center,
            ) {
                CircularProgressIndicator(
                    modifier = Modifier.size(28.dp),
                    strokeWidth = 2.dp,
                    color = MaterialTheme.colorScheme.onPrimary,
                )
            }
        } else if (onClick != null) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.BottomEnd)
                        .padding(4.dp)
                        .size(26.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.92f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Outlined.CameraAlt,
                    contentDescription = null,
                    modifier = Modifier.size(14.dp),
                    tint = MaterialTheme.colorScheme.onPrimary,
                )
            }
        }
    }
}


@Composable
internal fun AppUpdateVersionPill(
    label: String,
    versionName: String?,
    versionCode: Int?,
    emphasized: Boolean,
    modifier: Modifier = Modifier,
) {
    val versionLine =
        when {
            versionCode == null -> stringResource(R.string.profile_updates_pill_unknown)
            !versionName.isNullOrBlank() -> "$versionName ($versionCode)"
            else -> stringResource(R.string.profile_updates_code_label, versionCode)
        }
    PremiumMetricPill(
        label = label,
        value = versionLine,
        modifier = modifier,
        icon = if (emphasized) Icons.Outlined.SystemUpdate else null,
    )
}

@Composable
internal fun AppUpdateBanner(
    title: String,
    message: String?,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    isError: Boolean = false,
    isSuccess: Boolean = false,
) {
    val accentColor =
        when {
            isError -> MaterialTheme.colorScheme.error
            isSuccess -> MaterialTheme.colorScheme.tertiary
            else -> MaterialTheme.colorScheme.primary
        }
    val containerColor =
        when {
            isError -> MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.86f)
            isSuccess -> MaterialTheme.colorScheme.tertiaryContainer.copy(alpha = 0.82f)
            else -> MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.84f)
        }
    PremiumRowSurface(
        modifier = modifier,
        containerColor = containerColor,
        borderColor = accentColor.copy(alpha = 0.24f),
        tonalElevation = 2.dp,
        verticalAlignment = Alignment.Top,
    ) {
        Icon(
            icon,
            contentDescription = null,
            tint = accentColor,
            modifier = Modifier.padding(top = 2.dp),
        )
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
            )
            if (!message.isNullOrBlank()) {
                Text(
                    text = message,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

