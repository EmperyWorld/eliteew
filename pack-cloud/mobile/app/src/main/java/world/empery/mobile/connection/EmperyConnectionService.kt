/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Low-priority foreground service while the app is foreground or an active/incoming GAF call needs
 * realtime — not held 24/7 in background (push + WorkManager cover idle sync).
 *
 * Invariants:
 * - startForeground() runs in onCreate before any slow work (Android FGS start deadline).
 * - Started only when authenticated and (foreground or active call); stopped on logout and background idle.
 *
 * Related:
 * - MainViewModel.connectRealtimeIfAllowed, RealtimeChatBridge, PerimeterTrustedDeviceSuppression
 */
package world.empery.mobile.connection

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import world.empery.mobile.MainActivity
import world.empery.mobile.R
import world.empery.mobile.perimeter.PerimeterTrustedDeviceSuppression

class EmperyConnectionService : Service() {
    private val mainHandler = Handler(Looper.getMainLooper())

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        ensureChannel()
        promoteToForeground(buildForegroundNotification(bound = null))
        isRunning = true
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        promoteToForeground(buildForegroundNotification(bound = null))
        mainHandler.post { refreshForegroundNotificationBody() }
        return START_STICKY
    }

    override fun onDestroy() {
        isRunning = false
        mainHandler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }

    private fun promoteToForeground(notification: Notification) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
            )
        } else {
            @Suppress("DEPRECATION")
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun refreshForegroundNotificationBody() {
        val bound = runCatching { PerimeterTrustedDeviceSuppression.isSuppressed(this) }.getOrDefault(false)
        val notification = buildForegroundNotification(bound = bound)
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIFICATION_ID, notification)
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return
        nm.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                getString(R.string.connection_service_channel_name),
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = getString(R.string.connection_service_channel_desc)
                setShowBadge(false)
            },
        )
    }

    private fun buildForegroundNotification(bound: Boolean?): Notification {
        val launchIntent =
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
        val pending =
            PendingIntent.getActivity(
                this,
                0,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        val icon = applicationInfo.icon.takeIf { it != 0 } ?: android.R.drawable.stat_notify_sync
        val bodyRes =
            when (bound) {
                true -> R.string.connection_service_body_bound
                false -> R.string.connection_service_body_unbound
                null -> R.string.connection_service_body_unbound
            }
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(icon)
            .setContentTitle(getString(R.string.connection_service_title))
            .setContentText(getString(bodyRes))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(pending)
            .build()
    }

    companion object {
        private const val CHANNEL_ID = "empery_connection"
        private const val NOTIFICATION_ID = 61001

        @Volatile
        private var isRunning: Boolean = false

        fun ensureRunning(context: Context) {
            val appContext = context.applicationContext
            val intent = Intent(appContext, EmperyConnectionService::class.java)
            if (isRunning) {
                appContext.startService(intent)
                return
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                appContext.startForegroundService(intent)
            } else {
                appContext.startService(intent)
            }
        }

        /** Rebuild foreground notification text (e.g. after trusted-device bind/revoke). */
        fun refreshIfRunning(context: Context) {
            if (!isRunning) return
            context.applicationContext.startService(
                Intent(context.applicationContext, EmperyConnectionService::class.java),
            )
        }

        fun stop(context: Context) {
            isRunning = false
            val appContext = context.applicationContext
            appContext.stopService(
                Intent(appContext, EmperyConnectionService::class.java),
            )
        }
    }
}
