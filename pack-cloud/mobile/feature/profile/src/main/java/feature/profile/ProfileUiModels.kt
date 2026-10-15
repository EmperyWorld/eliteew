/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Profile tab UI state models (OTA, tunnel, trusted-device, screen).
 *
 * Invariants:
 * - Same package as ProfileFeature; call sites stay stable without import churn.
 *
 * Related:
 * - ProfileFeature.kt, ProfileTabViewModel, ProfileScreen
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


data class AppUpdateUiState(
    val installedVersionCode: Int = 0,
    val installedVersionName: String = "",
    val isChecking: Boolean = false,
    val isDownloading: Boolean = false,
    val downloadProgress: Float? = null,
    val serverVersionCode: Int? = null,
    val serverVersionName: String? = null,
    val apkAvailable: Boolean = false,
    val apkSizeBytes: Long? = null,
    val apkSha256: String? = null,
    val updateAvailable: Boolean = false,
    val statusMessage: String? = null,
    val error: String? = null,
    val downloadedApkPath: String? = null,
    val downloadedVersionCode: Int? = null,
    val partialDownloadBytes: Long? = null,
    val canResumeDownload: Boolean = false,
    val serverHostLabel: String? = null,
    val releaseNotes: String? = null,
    val updateUrgency: OtaUpdateUrgency = OtaUpdateUrgency.NONE,
    val sha256Verification: ApkSha256VerificationState = ApkSha256VerificationState.UNKNOWN,
    val isDownloadPaused: Boolean = false,
    /** Bumped to trigger sideload install intent from ProfileOtaUpdateSection (one-click OTA). */
    val installRequestNonce: Long = 0L,
)

enum class PrivateTunnelUiStatus {
    NOT_CONFIGURED,
    DISCONNECTED,
    PERMISSION_REQUIRED,
    VPN_CONFLICT,
    CONNECTING,
    WAITING_EDGE,
    RETRYING,
    CONNECTED,
    STOPPING,
    ERROR,
}

enum class PrivateTunnelConnectionModeUi {
    PUBLIC_STABLE,
    PRIVATE_TUNNEL_BETA,
}

data class PrivateTunnelUiState(
    val status: PrivateTunnelUiStatus = PrivateTunnelUiStatus.NOT_CONFIGURED,
    val connectionMode: PrivateTunnelConnectionModeUi = PrivateTunnelConnectionModeUi.PUBLIC_STABLE,
    val restartRequired: Boolean = false,
    val configImported: Boolean = false,
    val peerAddress: String? = null,
    val endpoint: String? = null,
    val dns: String? = null,
    val message: String? = null,
    val error: String? = null,
) {
    val isBusy: Boolean
        get() =
            status == PrivateTunnelUiStatus.CONNECTING ||
                status == PrivateTunnelUiStatus.WAITING_EDGE ||
                status == PrivateTunnelUiStatus.RETRYING ||
                status == PrivateTunnelUiStatus.STOPPING

    val blocksEliteEwTraffic: Boolean
        get() = connectionMode == PrivateTunnelConnectionModeUi.PRIVATE_TUNNEL_BETA &&
            status != PrivateTunnelUiStatus.CONNECTED
}

data class TrustedDeviceBindingUiState(
    val pairingPayload: String = "",
    val prepareGafE2ee: Boolean = true,
    val isBinding: Boolean = false,
    val isSyncing: Boolean = false,
    val isRevoking: Boolean = false,
    val serverBound: Boolean = false,
    val configReceived: Boolean = false,
    val activeDeviceId: String? = null,
    val boundDeviceLabel: String? = null,
    /** Local WG/keys remain while server has no active bind (e.g. revoked from desktop, no SSO on phone). */
    val localTunnelOnly: Boolean = false,
    val pendingSecureConnectionConsent: Boolean = false,
    val message: String? = null,
    val error: String? = null,
)

data class ProfileUiState(
    val profile: ProfileEntity? = null,
    val privacy: ProfilePrivacyDto? = null,
    val privacyCircles: List<FriendCircleItemDto> = emptyList(),
    val isLoading: Boolean = false,
    val isAvatarUploading: Boolean = false,
    val avatarUploadError: String? = null,
    val error: String? = null,
    val isPrivacySaving: Boolean = false,
    val privacyError: String? = null,
    val isCallTargetSaving: Boolean = false,
    val callTargetError: String? = null,
    val appUpdate: AppUpdateUiState = AppUpdateUiState(),
    val trustedDeviceBinding: TrustedDeviceBindingUiState = TrustedDeviceBindingUiState(),
    val privateTunnel: PrivateTunnelUiState = PrivateTunnelUiState(),
    val perimeterAccess: PerimeterAccessUiState = PerimeterAccessUiState(),
    val sessionHealth: SessionHealthUiState = SessionHealthUiState(),
    val supportMode: Boolean = false,
    val storage: ProfileStorageUiState = ProfileStorageUiState(),
    val deviceSession: ProfileDeviceSessionUiState = ProfileDeviceSessionUiState(),
    val supportBundleText: String = "",
    val supportReportSubmitting: Boolean = false,
    val supportReportFeedback: String? = null,
    val avatarPreviewUri: Uri? = null,
    val avatarCompressInfo: String? = null,
    /** Deeplink: expand this category once when Profile tab opens. */
    val expandCategoryId: ProfileCategoryId? = null,
)

