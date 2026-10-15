/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Super Roadmap profile-001…010 helpers: control-center sections, storage stats, support bundle,
 * appearance copy, accessibility prefs, OTA urgency, SHA verification state.
 *
 * Invariants:
 * - Support bundle must never include tokens, refresh secrets, or raw FCM tokens.
 *
 * Related:
 * - ProfileFeature.kt, ProfileTabViewModel, MobileAppUpdateRepository
 */
package feature.profile

import android.content.Context
import android.os.Build
import coil.imageLoader
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import kotlin.math.ln
import kotlin.math.pow
import world.empery.mobile.core.network.SocketLifecycleState

/** profile-001: ordered control-center sections for Profile home. */
enum class ProfileControlSection(val order: Int) {
    ACCOUNT(0),
    APPEARANCE(1),
    NOTIFICATIONS(2),
    PRIVACY(3),
    DEVICE(4),
    STORAGE(5),
    ACCESSIBILITY(6),
    PERIMETER(7),
    DIAGNOSTICS(8),
    UPDATES(9),
}

fun mobileUiStyleDescriptionRes(style: MobileUiStyle): Int =
    when (style) {
        MobileUiStyle.SYSTEM -> R.string.profile_theme_desc_system
        MobileUiStyle.GLASS -> R.string.profile_theme_desc_glass
        MobileUiStyle.PREMIUM -> R.string.profile_theme_desc_premium
        MobileUiStyle.EMERALD -> R.string.profile_theme_desc_emerald
        MobileUiStyle.MIDNIGHT -> R.string.profile_theme_desc_midnight
        MobileUiStyle.OBSIDIAN -> R.string.profile_theme_desc_obsidian
    }

fun chatVisualStyleLabelRes(style: world.empery.mobile.core.ui.ChatVisualStyle): Int =
    when (style) {
        world.empery.mobile.core.ui.ChatVisualStyle.STANDARD -> R.string.profile_chat_visual_standard
        world.empery.mobile.core.ui.ChatVisualStyle.ELITE -> R.string.profile_chat_visual_elite
    }

fun chatVisualStyleDescriptionRes(style: world.empery.mobile.core.ui.ChatVisualStyle): Int =
    when (style) {
        world.empery.mobile.core.ui.ChatVisualStyle.STANDARD -> R.string.profile_chat_visual_desc_standard
        world.empery.mobile.core.ui.ChatVisualStyle.ELITE -> R.string.profile_chat_visual_desc_elite
    }

fun chatTypographyPresetLabelRes(preset: world.empery.mobile.core.ui.ChatTypographyPreset): Int =
    when (preset) {
        world.empery.mobile.core.ui.ChatTypographyPreset.BASE -> R.string.profile_chat_typo_preset_base
        world.empery.mobile.core.ui.ChatTypographyPreset.COMPACT -> R.string.profile_chat_typo_preset_compact
        world.empery.mobile.core.ui.ChatTypographyPreset.READING -> R.string.profile_chat_typo_preset_reading
        world.empery.mobile.core.ui.ChatTypographyPreset.EMPHASIS -> R.string.profile_chat_typo_preset_emphasis
        world.empery.mobile.core.ui.ChatTypographyPreset.SERIF_READ -> R.string.profile_chat_typo_preset_serif
        world.empery.mobile.core.ui.ChatTypographyPreset.HIGH_CONTRAST ->
            R.string.profile_chat_typo_preset_high_contrast
    }

fun chatFontFamilyLabelRes(family: world.empery.mobile.core.ui.ChatFontFamilyOption): Int =
    when (family) {
        world.empery.mobile.core.ui.ChatFontFamilyOption.DEFAULT -> R.string.profile_chat_typo_family_default
        world.empery.mobile.core.ui.ChatFontFamilyOption.SERIF -> R.string.profile_chat_typo_family_serif
        world.empery.mobile.core.ui.ChatFontFamilyOption.MONOSPACE -> R.string.profile_chat_typo_family_mono
    }

fun chatFontSizeLabelRes(size: world.empery.mobile.core.ui.ChatFontSizeOption): Int =
    when (size) {
        world.empery.mobile.core.ui.ChatFontSizeOption.SM -> R.string.profile_chat_typo_size_sm
        world.empery.mobile.core.ui.ChatFontSizeOption.MD -> R.string.profile_chat_typo_size_md
        world.empery.mobile.core.ui.ChatFontSizeOption.LG -> R.string.profile_chat_typo_size_lg
        world.empery.mobile.core.ui.ChatFontSizeOption.XL -> R.string.profile_chat_typo_size_xl
    }

fun chatFontColorLabelRes(color: world.empery.mobile.core.ui.ChatFontColorOption): Int =
    when (color) {
        world.empery.mobile.core.ui.ChatFontColorOption.DEFAULT -> R.string.profile_chat_typo_color_default
        world.empery.mobile.core.ui.ChatFontColorOption.MUTED -> R.string.profile_chat_typo_color_muted
        world.empery.mobile.core.ui.ChatFontColorOption.PRIMARY -> R.string.profile_chat_typo_color_primary
        world.empery.mobile.core.ui.ChatFontColorOption.HIGH_CONTRAST ->
            R.string.profile_chat_typo_color_high_contrast
    }

enum class OtaUpdateUrgency {
    NONE,
    OPTIONAL,
    RECOMMENDED,
    CRITICAL,
}

fun resolveOtaUpdateUrgency(
    updateAvailable: Boolean,
    apkAvailable: Boolean,
    versionDelta: Int?,
    installedVersionCode: Int? = null,
    minSupportedVersionCode: Int? = null,
): OtaUpdateUrgency {
    if (!updateAvailable || !apkAvailable) return OtaUpdateUrgency.NONE
    if (
        installedVersionCode != null &&
        minSupportedVersionCode != null &&
        installedVersionCode < minSupportedVersionCode
    ) {
        return OtaUpdateUrgency.CRITICAL
    }
    val delta = versionDelta ?: return OtaUpdateUrgency.OPTIONAL
    return when {
        delta >= 10 -> OtaUpdateUrgency.CRITICAL
        delta >= 3 -> OtaUpdateUrgency.RECOMMENDED
        else -> OtaUpdateUrgency.OPTIONAL
    }
}

/** Parse `empery-mobile-v{code}.apk` from a stored download path. */
fun parseDownloadedApkVersionCode(path: String?): Int? {
    val name = path?.substringAfterLast('/')?.trim().orEmpty()
    if (!name.startsWith("empery-mobile-v") || !name.endsWith(".apk")) return null
    return name.removePrefix("empery-mobile-v").removeSuffix(".apk").toIntOrNull()
}

/**
 * Show sideload install only when a newer APK is available, verified on disk, and matches server versionCode.
 */
fun canShowOtaInstallButton(update: AppUpdateUiState): Boolean {
    if (!update.updateAvailable || !update.apkAvailable) return false
    val path = update.downloadedApkPath?.trim().orEmpty()
    if (path.isEmpty()) return false
    if (update.sha256Verification == ApkSha256VerificationState.FAILED) return false
    val serverCode = update.serverVersionCode ?: return false
    val downloadedCode =
        update.downloadedVersionCode
            ?: parseDownloadedApkVersionCode(path)
            ?: return false
    if (downloadedCode != serverCode) return false
    val file = File(path)
    return file.isFile && file.length() > 0L
}

enum class ApkSha256VerificationState {
    UNKNOWN,
    PENDING,
    VERIFIED,
    FAILED,
}

fun resolveApkSha256VerificationState(
    downloadedApkPath: String?,
    expectedSha256: String?,
    verified: Boolean?,
): ApkSha256VerificationState {
    if (downloadedApkPath.isNullOrBlank()) return ApkSha256VerificationState.UNKNOWN
    val expected = expectedSha256?.trim()?.lowercase().orEmpty()
    if (expected.length != 64) return ApkSha256VerificationState.UNKNOWN
    return when (verified) {
        true -> ApkSha256VerificationState.VERIFIED
        false -> ApkSha256VerificationState.FAILED
        null -> ApkSha256VerificationState.PENDING
    }
}

data class ProfileLocalStorageStats(
    val coilCacheBytes: Long = 0L,
    val chatAttachmentBytes: Long = 0L,
    val offlineFeedBytesEstimate: Long = 0L,
    val apkUpdatesBytes: Long = 0L,
    val streamCacheBytes: Long = 0L,
    val streamCacheTrackCount: Int = 0,
) {
    val totalBytes: Long
        get() =
            coilCacheBytes +
                chatAttachmentBytes +
                offlineFeedBytesEstimate +
                apkUpdatesBytes +
                streamCacheBytes
}

fun formatStorageBytes(bytes: Long): String {
    if (bytes <= 0L) return "0 B"
    val units = arrayOf("B", "KB", "MB", "GB")
    val digitGroups = (ln(bytes.toDouble()) / ln(1024.0)).toInt().coerceIn(0, units.lastIndex)
    val value = bytes / 1024.0.pow(digitGroups.toDouble())
    return if (digitGroups == 0) {
        "$bytes B"
    } else {
        String.format(Locale.US, "%.1f %s", value, units[digitGroups])
    }
}

fun measureProfileLocalStorage(
    context: Context,
    offlineFeedEstimateBytes: Long = 0L,
    updateRepository: MobileAppUpdateRepository,
): ProfileLocalStorageStats {
    val appContext = context.applicationContext
    val coilDirFile = appContext.imageLoader.diskCache?.directory?.toString()?.let { File(it) }
    val coilBytes = directorySize(coilDirFile)
    val chatBytes = directorySize(File(appContext.filesDir, "gaf_attachment_cache"))
    val feedEstimate = offlineFeedEstimateBytes.coerceAtLeast(0L)
    val apkDir = updateRepository.updatesDir(appContext)
    val apkBytes = directorySize(apkDir)
    return ProfileLocalStorageStats(
        coilCacheBytes = coilBytes,
        chatAttachmentBytes = chatBytes,
        offlineFeedBytesEstimate = feedEstimate,
        apkUpdatesBytes = apkBytes,
    )
}

private fun directorySize(dir: File?): Long {
    if (dir == null || !dir.exists()) return 0L
    if (dir.isFile) return dir.length().coerceAtLeast(0L)
    return dir.walkTopDown().filter { it.isFile }.sumOf { it.length() }
}

object ProfileAccessibilityPreferences {
    private const val PREFS = "empery_mobile_a11y"
    private const val KEY_REDUCE_MOTION = "reduce_motion"
    private const val KEY_HIGH_CONTRAST = "high_contrast_hint"
    /** Must match PremiumSplashGate KEY_INTRO_ENABLED / PREFS_NAME in app module. */
    private const val UI_PREFS = "empery_mobile_ui"
    private const val KEY_INTRO_SPLASH = "premium_splash_intro_enabled_v1"

    fun isReduceMotion(context: Context): Boolean =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getBoolean(KEY_REDUCE_MOTION, false)

    fun setReduceMotion(context: Context, enabled: Boolean) {
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_REDUCE_MOTION, enabled)
            .apply()
    }

    fun isHighContrastHint(context: Context): Boolean =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getBoolean(KEY_HIGH_CONTRAST, false)

    fun setHighContrastHint(context: Context, enabled: Boolean) {
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_HIGH_CONTRAST, enabled)
            .apply()
    }

    /** Framed cold-start intro video (default on). Shared with [PremiumSplashGate]. */
    fun isIntroSplashEnabled(context: Context): Boolean =
        context.applicationContext
            .getSharedPreferences(UI_PREFS, Context.MODE_PRIVATE)
            .getBoolean(KEY_INTRO_SPLASH, true)

    fun setIntroSplashEnabled(context: Context, enabled: Boolean) {
        context.applicationContext
            .getSharedPreferences(UI_PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_INTRO_SPLASH, enabled)
            .apply()
    }
}

data class ProfileSupportBundleInput(
    val appVersionName: String,
    val appVersionCode: Int,
    val buildFlavor: String,
    val apiHost: String,
    val sessionSignedIn: Boolean,
    val accessTokenExpiresAtEpochSec: Long? = null,
    val socketState: SocketLifecycleState,
    val fcmRegistered: Boolean,
    val deviceModel: String = Build.MODEL,
    val androidRelease: String = Build.VERSION.RELEASE,
    val userId: String? = null,
    val supportMode: Boolean = false,
)

fun buildProfileSupportBundle(input: ProfileSupportBundleInput): String {
    val ts =
        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
            .apply { timeZone = TimeZone.getTimeZone("UTC") }
            .format(Date())
    val nowEpoch = System.currentTimeMillis() / 1000L
    val tokenTtlSec = input.accessTokenExpiresAtEpochSec?.minus(nowEpoch)
    return buildString {
        appendLine("EliteEW Mobile support bundle")
        appendLine("generated_at=$ts")
        appendLine("app_version=${input.appVersionName} (${input.appVersionCode})")
        appendLine("build_flavor=${input.buildFlavor}")
        appendLine("api_host=${input.apiHost}")
        appendLine("device=${input.deviceModel}")
        appendLine("android=${input.androidRelease} (sdk ${Build.VERSION.SDK_INT})")
        appendLine("session_signed_in=${input.sessionSignedIn}")
        appendLine("access_token_expires_at_epoch_sec=${input.accessTokenExpiresAtEpochSec ?: "unknown"}")
        appendLine("access_token_ttl_sec=${tokenTtlSec ?: "unknown"}")
        appendLine("socket=${input.socketState.name.lowercase()}")
        appendLine("fcm_registered=${input.fcmRegistered}")
        if (input.supportMode && !input.userId.isNullOrBlank()) {
            appendLine("user_id=${input.userId}")
        }
        appendLine("secrets=redacted")
    }
}

fun truncateSha256ForDisplay(sha256: String?): String? {
    val normalized = sha256?.trim()?.lowercase().orEmpty()
    if (normalized.length != 64) return null
    return "${normalized.take(8)}…${normalized.takeLast(8)}"
}

fun readBuildFlavor(context: Context): String =
    runCatching {
        when {
            context.packageName.endsWith(".dev") -> "dev"
            context.packageName.endsWith(".prod") -> "prod"
            else -> "prod"
        }
    }.getOrDefault("unknown")
