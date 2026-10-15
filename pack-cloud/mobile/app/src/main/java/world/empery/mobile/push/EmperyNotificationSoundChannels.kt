/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Branded notification channels: custom message sound; calls use the system default ringtone.
 *
 * Invariants:
 * - Bump channel suffix when sound source changes; migrate deletes stale channels once per install.
 * - Calls channel sound is immutable after create — bump CALLS_CHANNEL_ID when ringtone policy changes.
 *
 * Related:
 * - NotificationHelper.kt, IncomingCallRingtoneService.kt, MobileFirebaseMessagingService.kt
 */
package world.empery.mobile.push

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import world.empery.mobile.R

object EmperyNotificationSoundChannels {
    /** v4 — soft-tap notification (2026-07-15). */
    const val PUSH_CHANNEL_ID = "empery_push_v4"

    /** v5 — system default phone ringtone (2026-07-17). */
    const val CALLS_CHANNEL_ID = "empery_calls_v5"

    /** Legacy ids — deleted on migration. */
    const val LEGACY_PUSH_CHANNEL_ID = "fcm_default"
    const val LEGACY_CALLS_CHANNEL_ID = "incoming_calls"
    private const val PREVIOUS_PUSH_CHANNEL_ID_V1 = "empery_push_v1"
    private const val PREVIOUS_CALLS_CHANNEL_ID_V1 = "empery_calls_v1"
    private const val PREVIOUS_PUSH_CHANNEL_ID_V2 = "empery_push_v2"
    private const val PREVIOUS_CALLS_CHANNEL_ID_V2 = "empery_calls_v2"
    private const val PREVIOUS_PUSH_CHANNEL_ID_V3 = "empery_push_v3"
    private const val PREVIOUS_CALLS_CHANNEL_ID_V3 = "empery_calls_v3"
    private const val PREVIOUS_CALLS_CHANNEL_ID_V4 = "empery_calls_v4"

    private const val PREFS_NAME = "empery_notification_channels"
    private const val PREFS_MIGRATION_KEY = "migrated_sound_channels_v5_calls"

    fun pushSoundUri(context: Context): Uri =
        Uri.parse("android.resource://${context.packageName}/${R.raw.empery_notification_message}")

    /** System default phone ringtone (Settings → Sound → Phone ringtone). */
    fun callsSoundUri(context: Context): Uri {
        val default =
            RingtoneManager.getActualDefaultRingtoneUri(context, RingtoneManager.TYPE_RINGTONE)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
        return default ?: Uri.EMPTY
    }

    fun ensurePushChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(PUSH_CHANNEL_ID) != null) return
        val audioAttributes =
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
        val channel =
            NotificationChannel(
                PUSH_CHANNEL_ID,
                context.getString(R.string.app_push_channel_name),
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply {
                description = context.getString(R.string.app_push_channel_desc)
                setShowBadge(true)
                setSound(pushSoundUri(context), audioAttributes)
            }
        nm.createNotificationChannel(channel)
    }

    fun ensureCallsChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(CALLS_CHANNEL_ID) != null) return
        val audioAttributes =
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
        val channel =
            NotificationChannel(
                CALLS_CHANNEL_ID,
                context.getString(R.string.app_calls_channel_name),
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = context.getString(R.string.app_calls_channel_desc)
                setShowBadge(true)
                setSound(callsSoundUri(context), audioAttributes)
            }
        nm.createNotificationChannel(channel)
    }

    fun migrateIfNeeded(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val appContext = context.applicationContext
        val prefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        if (prefs.getBoolean(PREFS_MIGRATION_KEY, false)) {
            ensureAll(appContext)
            return
        }
        val nm = appContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        listOf(
            LEGACY_PUSH_CHANNEL_ID,
            LEGACY_CALLS_CHANNEL_ID,
            PREVIOUS_PUSH_CHANNEL_ID_V1,
            PREVIOUS_CALLS_CHANNEL_ID_V1,
            PREVIOUS_PUSH_CHANNEL_ID_V2,
            PREVIOUS_CALLS_CHANNEL_ID_V2,
            PREVIOUS_PUSH_CHANNEL_ID_V3,
            PREVIOUS_CALLS_CHANNEL_ID_V3,
            PREVIOUS_CALLS_CHANNEL_ID_V4,
        ).forEach { channelId ->
            runCatching { nm.deleteNotificationChannel(channelId) }
        }
        ensureAll(appContext)
        prefs.edit().putBoolean(PREFS_MIGRATION_KEY, true).apply()
    }

    fun ensureAll(context: Context) {
        ensurePushChannel(context)
        ensureCallsChannel(context)
    }
}
