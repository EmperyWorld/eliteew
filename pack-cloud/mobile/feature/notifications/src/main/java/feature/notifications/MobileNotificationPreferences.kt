/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Local notification preference center: per-category toggles, quiet hours, category mute.
 *
 * Invariants:
 * - Category mute flags stay device-local; enabled/quiet-hours sync via mobile profile API.
 *
 * Related:
 * - ProfileNotificationPreferencesSection, NotificationHelper, MobileApp push sync
 */
package feature.notifications

import android.content.Context
import java.time.LocalTime
import java.time.format.DateTimeFormatter

enum class NotificationPreferenceCategory {
    CHAT,
    FRIENDS,
    UGS,
    SYSTEM,
}

data class NotificationPreferencesSnapshot(
    val chatEnabled: Boolean = true,
    val friendsEnabled: Boolean = true,
    val ugsEnabled: Boolean = true,
    val systemEnabled: Boolean = true,
    val quietHoursEnabled: Boolean = false,
    val quietHoursStartMinute: Int = 22 * 60,
    val quietHoursEndMinute: Int = 8 * 60,
    val chatMuted: Boolean = false,
    val friendsMuted: Boolean = false,
    val ugsMuted: Boolean = false,
    val systemMuted: Boolean = false,
) {
    fun isCategoryEnabled(category: NotificationPreferenceCategory): Boolean =
        when (category) {
            NotificationPreferenceCategory.CHAT -> chatEnabled && !chatMuted
            NotificationPreferenceCategory.FRIENDS -> friendsEnabled && !friendsMuted
            NotificationPreferenceCategory.UGS -> ugsEnabled && !ugsMuted
            NotificationPreferenceCategory.SYSTEM -> systemEnabled && !systemMuted
        }

    fun withCategoryDelivering(
        category: NotificationPreferenceCategory,
        delivering: Boolean,
    ): NotificationPreferencesSnapshot =
        when (category) {
            NotificationPreferenceCategory.CHAT -> copy(chatEnabled = delivering, chatMuted = false)
            NotificationPreferenceCategory.FRIENDS -> copy(friendsEnabled = delivering, friendsMuted = false)
            NotificationPreferenceCategory.UGS -> copy(ugsEnabled = delivering, ugsMuted = false)
            NotificationPreferenceCategory.SYSTEM -> copy(systemEnabled = delivering, systemMuted = false)
        }

    fun isQuietNow(nowMinuteOfDay: Int = currentMinuteOfDay()): Boolean {
        if (!quietHoursEnabled) return false
        val start = quietHoursStartMinute.coerceIn(0, 23 * 60 + 59)
        val end = quietHoursEndMinute.coerceIn(0, 23 * 60 + 59)
        return if (start <= end) {
            nowMinuteOfDay in start until end
        } else {
            nowMinuteOfDay >= start || nowMinuteOfDay < end
        }
    }
}

object MobileNotificationPreferences {
    private const val PREFS = "empery_mobile_notification_prefs"
    private const val KEY_CHAT = "cat_chat_enabled"
    private const val KEY_FRIENDS = "cat_friends_enabled"
    private const val KEY_UGS = "cat_ugs_enabled"
    private const val KEY_SYSTEM = "cat_system_enabled"
    private const val KEY_QUIET_ENABLED = "quiet_hours_enabled"
    private const val KEY_QUIET_START = "quiet_hours_start_minute"
    private const val KEY_QUIET_END = "quiet_hours_end_minute"
    private const val KEY_MUTE_CHAT = "mute_chat"
    private const val KEY_MUTE_FRIENDS = "mute_friends"
    private const val KEY_MUTE_UGS = "mute_ugs"
    private const val KEY_MUTE_SYSTEM = "mute_system"
    private const val KEY_LAST_FCM = "diag_last_fcm_token"

    private fun prefs(context: Context) =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun read(context: Context): NotificationPreferencesSnapshot {
        val p = prefs(context)
        return NotificationPreferencesSnapshot(
            chatEnabled = p.getBoolean(KEY_CHAT, true),
            friendsEnabled = p.getBoolean(KEY_FRIENDS, true),
            ugsEnabled = p.getBoolean(KEY_UGS, true),
            systemEnabled = p.getBoolean(KEY_SYSTEM, true),
            quietHoursEnabled = p.getBoolean(KEY_QUIET_ENABLED, false),
            quietHoursStartMinute = p.getInt(KEY_QUIET_START, 22 * 60),
            quietHoursEndMinute = p.getInt(KEY_QUIET_END, 8 * 60),
            chatMuted = p.getBoolean(KEY_MUTE_CHAT, false),
            friendsMuted = p.getBoolean(KEY_MUTE_FRIENDS, false),
            ugsMuted = p.getBoolean(KEY_MUTE_UGS, false),
            systemMuted = p.getBoolean(KEY_MUTE_SYSTEM, false),
        )
    }

    fun write(context: Context, snapshot: NotificationPreferencesSnapshot) {
        prefs(context).edit()
            .putBoolean(KEY_CHAT, snapshot.chatEnabled)
            .putBoolean(KEY_FRIENDS, snapshot.friendsEnabled)
            .putBoolean(KEY_UGS, snapshot.ugsEnabled)
            .putBoolean(KEY_SYSTEM, snapshot.systemEnabled)
            .putBoolean(KEY_QUIET_ENABLED, snapshot.quietHoursEnabled)
            .putInt(KEY_QUIET_START, snapshot.quietHoursStartMinute)
            .putInt(KEY_QUIET_END, snapshot.quietHoursEndMinute)
            .putBoolean(KEY_MUTE_CHAT, snapshot.chatMuted)
            .putBoolean(KEY_MUTE_FRIENDS, snapshot.friendsMuted)
            .putBoolean(KEY_MUTE_UGS, snapshot.ugsMuted)
            .putBoolean(KEY_MUTE_SYSTEM, snapshot.systemMuted)
            .apply()
    }

    fun setCategoryEnabled(context: Context, category: NotificationPreferenceCategory, enabled: Boolean) {
        val current = read(context)
        val next =
            when (category) {
                NotificationPreferenceCategory.CHAT -> current.copy(chatEnabled = enabled)
                NotificationPreferenceCategory.FRIENDS -> current.copy(friendsEnabled = enabled)
                NotificationPreferenceCategory.UGS -> current.copy(ugsEnabled = enabled)
                NotificationPreferenceCategory.SYSTEM -> current.copy(systemEnabled = enabled)
            }
        write(context, next)
    }

    fun setCategoryMuted(context: Context, category: NotificationPreferenceCategory, muted: Boolean) {
        val current = read(context)
        val next =
            when (category) {
                NotificationPreferenceCategory.CHAT -> current.copy(chatMuted = muted)
                NotificationPreferenceCategory.FRIENDS -> current.copy(friendsMuted = muted)
                NotificationPreferenceCategory.UGS -> current.copy(ugsMuted = muted)
                NotificationPreferenceCategory.SYSTEM -> current.copy(systemMuted = muted)
            }
        write(context, next)
    }

    fun setQuietHours(
        context: Context,
        enabled: Boolean,
        startMinute: Int,
        endMinute: Int,
    ) {
        write(
            context,
            read(context).copy(
                quietHoursEnabled = enabled,
                quietHoursStartMinute = startMinute,
                quietHoursEndMinute = endMinute,
            ),
        )
    }

    fun cacheFcmToken(context: Context, token: String?) {
        prefs(context).edit().putString(KEY_LAST_FCM, token?.trim().orEmpty()).apply()
    }

    fun readCachedFcmToken(context: Context): String? =
        prefs(context).getString(KEY_LAST_FCM, null)?.trim()?.takeIf { it.isNotEmpty() }

    fun formatMinuteOfDay(minute: Int): String {
        val h = (minute / 60).coerceIn(0, 23)
        val m = (minute % 60).coerceIn(0, 59)
        return LocalTime.of(h, m).format(DateTimeFormatter.ofPattern("HH:mm"))
    }
}

fun currentMinuteOfDay(): Int {
    val now = LocalTime.now()
    return now.hour * 60 + now.minute
}

fun maskFcmToken(token: String?): String {
    val t = token?.trim().orEmpty()
    if (t.length <= 12) return if (t.isEmpty()) "—" else "••••"
    return t.take(6) + "…" + t.takeLast(4)
}
