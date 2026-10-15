/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Local snapshot of mobile-customizable prefs for server sync (appearance, a11y, notifications).
 *
 * Invariants:
 * - Separate from web UserPreferences; maps 1:1 to users.preferences.mobile on API.
 * - callTarget caches users.preferences.video_calls.call_target (PATCH via profile/preferences).
 *
 * Related:
 * - MobileProfileRepository.kt, MobileUiStylePreferences, ProfileAccessibilityPreferences
 */
package feature.profile

import android.content.Context
import feature.notifications.MobileNotificationPreferences
import feature.notifications.NotificationPreferencesSnapshot
import world.empery.mobile.core.media.EmperyMediaStreamCachePrefs
import world.empery.mobile.core.ui.MobileUiScale

/** Server call-routing preference (web Связи → Телефон and mobile Profile → Видеозвонки). */
object VideoCallTarget {
    const val BOTH = "both"
    const val DESKTOP_ONLY = "desktop_only"
    const val MOBILE_ONLY = "mobile_only"

    fun normalize(raw: String?): String =
        when (raw?.trim()?.lowercase()) {
            DESKTOP_ONLY -> DESKTOP_ONLY
            MOBILE_ONLY -> MOBILE_ONLY
            else -> BOTH
        }

    fun shouldRingMobile(callTarget: String?): Boolean =
        normalize(callTarget) != DESKTOP_ONLY
}

data class MobileProfileSnapshot(
    val uiStyle: MobileUiStyle = MobileUiStyle.SYSTEM,
    val colorMode: MobileColorMode = MobileColorMode.SYSTEM,
    val uiScale: MobileUiScale = MobileUiScale.COMPACT,
    val notificationsEnabled: Boolean = true,
    val reduceMotion: Boolean = false,
    val highContrastHint: Boolean = false,
    val streamCacheWifiOnly: Boolean = false,
    val backgroundContentId: String? = null,
    val serverUpdatedAt: String? = null,
    val notificationPrefs: NotificationPreferencesSnapshot = NotificationPreferencesSnapshot(),
    val callTarget: String = VideoCallTarget.BOTH,
)

object MobileProfileLocalStore {
    private const val PREFS = "empery_mobile_profile_sync"
    private const val KEY_BACKGROUND_CONTENT_ID = "background_content_id"
    private const val KEY_SERVER_UPDATED_AT = "server_updated_at"
    private const val KEY_CALL_TARGET = "call_target"

    fun read(context: Context): MobileProfileSnapshot =
        MobileProfileSnapshot(
            uiStyle = MobileUiStylePreferences.get(context),
            colorMode = MobileUiStylePreferences.getColorMode(context),
            uiScale = MobileUiScalePreferences.get(context),
            notificationsEnabled = MobileUiStylePreferences.getNotificationsEnabled(context),
            reduceMotion = ProfileAccessibilityPreferences.isReduceMotion(context),
            highContrastHint = ProfileAccessibilityPreferences.isHighContrastHint(context),
            streamCacheWifiOnly = EmperyMediaStreamCachePrefs.isWifiOnlyPrefetch(context),
            backgroundContentId = getBackgroundContentId(context),
            serverUpdatedAt = getServerUpdatedAt(context),
            notificationPrefs = MobileNotificationPreferences.read(context),
            callTarget = getCallTarget(context),
        )

    fun apply(
        context: Context,
        snapshot: MobileProfileSnapshot,
    ) {
        MobileUiStylePreferences.set(context, snapshot.uiStyle)
        MobileUiStylePreferences.setColorMode(context, snapshot.colorMode)
        MobileUiScalePreferences.set(context, snapshot.uiScale)
        MobileUiStylePreferences.setNotificationsEnabled(context, snapshot.notificationsEnabled)
        ProfileAccessibilityPreferences.setReduceMotion(context, snapshot.reduceMotion)
        ProfileAccessibilityPreferences.setHighContrastHint(context, snapshot.highContrastHint)
        EmperyMediaStreamCachePrefs.setWifiOnlyPrefetch(context, snapshot.streamCacheWifiOnly)
        MobileNotificationPreferences.write(context, snapshot.notificationPrefs)
        setBackgroundContentId(context, snapshot.backgroundContentId)
        setServerUpdatedAt(context, snapshot.serverUpdatedAt)
        setCallTarget(context, snapshot.callTarget)
    }

    fun getCallTarget(context: Context): String =
        VideoCallTarget.normalize(prefs(context).getString(KEY_CALL_TARGET, VideoCallTarget.BOTH))

    fun setCallTarget(
        context: Context,
        callTarget: String?,
    ) {
        prefs(context)
            .edit()
            .putString(KEY_CALL_TARGET, VideoCallTarget.normalize(callTarget))
            .apply()
    }

    fun getBackgroundContentId(context: Context): String? =
        prefs(context).getString(KEY_BACKGROUND_CONTENT_ID, null)?.trim()?.takeIf { it.isNotEmpty() }

    fun setBackgroundContentId(
        context: Context,
        contentId: String?,
    ) {
        val editor = prefs(context).edit()
        if (contentId.isNullOrBlank()) {
            editor.remove(KEY_BACKGROUND_CONTENT_ID)
        } else {
            editor.putString(KEY_BACKGROUND_CONTENT_ID, contentId)
        }
        editor.apply()
    }

    fun getServerUpdatedAt(context: Context): String? =
        prefs(context).getString(KEY_SERVER_UPDATED_AT, null)?.trim()?.takeIf { it.isNotEmpty() }

    fun setServerUpdatedAt(
        context: Context,
        updatedAt: String?,
    ) {
        val editor = prefs(context).edit()
        if (updatedAt.isNullOrBlank()) {
            editor.remove(KEY_SERVER_UPDATED_AT)
        } else {
            editor.putString(KEY_SERVER_UPDATED_AT, updatedAt)
        }
        editor.apply()
    }

    private fun prefs(context: Context) =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
