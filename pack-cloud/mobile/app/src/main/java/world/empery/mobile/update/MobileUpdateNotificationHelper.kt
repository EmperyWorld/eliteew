/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Foreground notification for in-app APK download (WorkManager worker).
 *
 * Invariants:
 * - Channel created once; progress updates reuse the same notification id.
 *
 * Related:
 * - MobileAppUpdateDownloadWorker
 */
package world.empery.mobile.update

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import world.empery.mobile.R

object MobileUpdateNotificationHelper {
    const val CHANNEL_ID = "mobile_app_update_download"
    private const val NOTIFICATION_ID = 4101

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        val channel =
            NotificationChannel(
                CHANNEL_ID,
                context.getString(R.string.mobile_update_notification_channel),
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = context.getString(R.string.mobile_update_notification_channel_desc)
                setShowBadge(false)
            }
        manager.createNotificationChannel(channel)
    }

    fun buildForegroundNotification(context: Context, progressPercent: Int?): Notification {
        ensureChannel(context)
        val builder =
            NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.logo)
                .setContentTitle(context.getString(R.string.mobile_update_notification_title))
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
        if (progressPercent != null) {
            builder
                .setContentText(context.getString(R.string.mobile_update_notification_progress, progressPercent))
                .setProgress(100, progressPercent.coerceIn(0, 100), false)
        } else {
            builder.setContentText(context.getString(R.string.mobile_update_notification_preparing))
        }
        return builder.build()
    }

    fun notificationId(): Int = NOTIFICATION_ID
}
