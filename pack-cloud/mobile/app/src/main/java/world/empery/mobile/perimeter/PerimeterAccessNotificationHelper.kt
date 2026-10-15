/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Notification channel and builder when perimeter is closed and auto-renew needs user tap.
 *
 * Invariants:
 * - Notification action opens MainActivity with renew intent extra only.
 *
 * Related:
 * - PerimeterAccessCoordinator, MainActivity
 */
package world.empery.mobile.perimeter

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import world.empery.mobile.MainActivity
import world.empery.mobile.R

object PerimeterAccessNotificationHelper {
    const val CHANNEL_ID = "perimeter_access"
    const val NOTIFICATION_ID = 4102
    const val ACTION_RENEW_PERIMETER = "world.empery.mobile.action.RENEW_PERIMETER"

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return
        val channel =
            NotificationChannel(
                CHANNEL_ID,
                context.getString(R.string.perimeter_notify_channel_name),
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = context.getString(R.string.perimeter_notify_channel_desc)
            }
        nm.createNotificationChannel(channel)
    }

    fun showRenewRequired(context: Context) {
        ensureChannel(context)
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val intent =
            Intent(context, MainActivity::class.java).apply {
                action = ACTION_RENEW_PERIMETER
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
        val pending =
            PendingIntent.getActivity(
                context,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        val notification =
            NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.logo)
                .setContentTitle(context.getString(R.string.perimeter_notify_title))
                .setContentText(context.getString(R.string.perimeter_notify_body))
                .setContentIntent(pending)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .addAction(
                    R.drawable.logo,
                    context.getString(R.string.perimeter_notify_action),
                    pending,
                )
                .build()
        nm.notify(NOTIFICATION_ID, notification)
    }

    fun cancel(context: Context) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.cancel(NOTIFICATION_ID)
    }
}
