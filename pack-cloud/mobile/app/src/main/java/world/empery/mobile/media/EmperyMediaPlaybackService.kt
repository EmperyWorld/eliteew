/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Foreground service + notification while Empery media is playing (background-safe playback).
 *
 * Invariants:
 * - Started only when a track is active; stopped when playback stops or user dismisses via Stop.
 * - Queue prev/next actions appear only when the controller has a multi-track queue.
 *
 * Related:
 * - EmperyMediaPlayerHolder, EmperyMediaPlayerController
 */
package world.empery.mobile.media

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.media.app.NotificationCompat.MediaStyle
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import world.empery.mobile.MainActivity
import world.empery.mobile.R
import world.empery.mobile.core.media.EmperyMediaPlaybackState
import world.empery.mobile.core.media.EmperyMediaPlayerHolder

class EmperyMediaPlaybackService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var stateJob: Job? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        ensureChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_TOGGLE -> EmperyMediaPlayerHolder.controller.togglePlayPause()
            ACTION_STOP -> EmperyMediaPlayerHolder.controller.stop()
            ACTION_PREVIOUS -> EmperyMediaPlayerHolder.controller.skipToPrevious()
            ACTION_NEXT -> EmperyMediaPlayerHolder.controller.skipToNext()
            else -> Unit
        }
        val state = EmperyMediaPlayerHolder.controller.state.value
        if (!state.hasActiveTrack) {
            stopForegroundCompat()
            stopSelf()
            return START_NOT_STICKY
        }
        startForegroundCompat(buildNotification(state))
        if (stateJob?.isActive != true) {
            stateJob =
                scope.launch {
                    EmperyMediaPlayerHolder.controller.state.collectLatest { next ->
                        if (!next.hasActiveTrack) {
                            stopForegroundCompat()
                            stopSelf()
                        } else {
                            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                            nm.notify(NOTIFICATION_ID, buildNotification(next))
                        }
                    }
                }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        stateJob?.cancel()
        scope.cancel()
        super.onDestroy()
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return
        nm.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                getString(R.string.media_playback_channel_name),
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = getString(R.string.media_playback_channel_desc)
                setShowBadge(false)
            },
        )
    }

    private fun buildNotification(state: EmperyMediaPlaybackState): Notification {
        val track = state.track
        val title = track?.title?.ifBlank { getString(R.string.media_playback_notification_title) }
            ?: getString(R.string.media_playback_notification_title)
        val statusText =
            when {
                state.errorMessage != null -> getString(R.string.media_playback_notification_error)
                state.isLoading -> getString(R.string.media_playback_notification_loading)
                state.isPlaying -> getString(R.string.media_playback_notification_playing)
                else -> getString(R.string.media_playback_notification_paused)
            }
        val body =
            if (state.hasQueue) {
                getString(
                    R.string.media_playback_notification_queue,
                    state.queueIndex + 1,
                    state.queueSize,
                    statusText,
                )
            } else {
                statusText
            }
        val launchIntent =
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
        val contentPending =
            PendingIntent.getActivity(
                this,
                0,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        val previousPending =
            PendingIntent.getService(
                this,
                3,
                Intent(this, EmperyMediaPlaybackService::class.java).setAction(ACTION_PREVIOUS),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        val togglePending =
            PendingIntent.getService(
                this,
                1,
                Intent(this, EmperyMediaPlaybackService::class.java).setAction(ACTION_TOGGLE),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        val nextPending =
            PendingIntent.getService(
                this,
                4,
                Intent(this, EmperyMediaPlaybackService::class.java).setAction(ACTION_NEXT),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        val stopPending =
            PendingIntent.getService(
                this,
                2,
                Intent(this, EmperyMediaPlaybackService::class.java).setAction(ACTION_STOP),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        val toggleLabel =
            if (state.isPlaying) {
                getString(R.string.media_playback_action_pause)
            } else {
                getString(R.string.media_playback_action_play)
            }
        val icon = applicationInfo.icon.takeIf { it != 0 } ?: android.R.drawable.ic_media_play
        val sessionToken = EmperyMediaPlayerHolder.playbackSessionCompatToken()
        val builder =
            NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(icon)
                .setContentTitle(title)
                .setContentText(body)
                .setSubText(statusText.takeIf { state.hasQueue })
                .setOngoing(state.isPlaying)
                .setOnlyAlertOnce(true)
                .setSilent(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setContentIntent(contentPending)
        val compactActions = mutableListOf<Int>()
        if (state.hasQueue) {
            builder.addAction(
                android.R.drawable.ic_media_previous,
                getString(R.string.media_playback_action_previous),
                previousPending,
            )
            compactActions.add(compactActions.size)
        }
        builder.addAction(0, toggleLabel, togglePending)
        compactActions.add(compactActions.size)
        if (state.hasQueue) {
            builder.addAction(
                android.R.drawable.ic_media_next,
                getString(R.string.media_playback_action_next),
                nextPending,
            )
            compactActions.add(compactActions.size)
        }
        builder.addAction(0, getString(R.string.media_playback_action_stop), stopPending)
        return builder
            .setStyle(
                MediaStyle()
                    .setMediaSession(sessionToken)
                    .setShowActionsInCompactView(*compactActions.take(3).toIntArray()),
            )
            .build()
    }

    private fun startForegroundCompat(notification: Notification) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK,
            )
        } else {
            @Suppress("DEPRECATION")
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun stopForegroundCompat() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
    }

    companion object {
        private const val CHANNEL_ID = "empery_media_playback_v1"
        private const val NOTIFICATION_ID = 61002
        private const val ACTION_TOGGLE = "world.empery.mobile.media.TOGGLE"
        private const val ACTION_STOP = "world.empery.mobile.media.STOP"
        private const val ACTION_PREVIOUS = "world.empery.mobile.media.PREVIOUS"
        private const val ACTION_NEXT = "world.empery.mobile.media.NEXT"

        fun ensureRunning(context: Context) {
            val appContext = context.applicationContext
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                appContext.startForegroundService(
                    Intent(appContext, EmperyMediaPlaybackService::class.java),
                )
            } else {
                appContext.startService(Intent(appContext, EmperyMediaPlaybackService::class.java))
            }
        }

        fun stop(context: Context) {
            val appContext = context.applicationContext
            appContext.stopService(Intent(appContext, EmperyMediaPlaybackService::class.java))
        }
    }
}
