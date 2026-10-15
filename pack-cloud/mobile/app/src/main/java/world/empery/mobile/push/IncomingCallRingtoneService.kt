/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Foreground service that loops the incoming-call ringtone until accept/decline/timeout.
 *
 * Invariants:
 * - startForeground runs immediately; ringtone uses USAGE_NOTIFICATION_RINGTONE via MediaPlayer only.
 * - One active ring per call_id; duplicate FCM/socket/Wake starts must not restart the melody.
 * - Notification posts are silent — channel sound would overlap MediaPlayer and sound like multi-ring.
 *
 * Related:
 * - NotificationHelper, IncomingCallPushReceiver, IncomingGafCallWakeActivity
 */
package world.empery.mobile.push

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import world.empery.mobile.R

class IncomingCallRingtoneService : Service() {
    private var mediaPlayer: MediaPlayer? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var activeCallId: String? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val callId = intent?.getStringExtra(EXTRA_CALL_ID)?.trim().orEmpty()
        if (callId.isBlank()) {
            stopSelf()
            return START_NOT_STICKY
        }
        val chatId = intent?.getStringExtra(EXTRA_CHAT_ID)?.trim()?.ifBlank { null }
        val title = intent?.getStringExtra(EXTRA_TITLE)?.trim().orEmpty()
        val callerUserId = intent?.getStringExtra(EXTRA_CALLER_USER_ID)?.trim()?.ifBlank { null }
        val callerAvatarUrl = intent?.getStringExtra(EXTRA_CALLER_AVATAR_URL)?.trim()?.ifBlank { null }
        val callKind = intent?.getStringExtra(EXTRA_CALL_KIND)?.trim()?.ifBlank { null }
        EmperyNotificationSoundChannels.ensureCallsChannel(this)
        val notification = buildRingNotification(callId, chatId, title, callerUserId, callerAvatarUrl, callKind)
        val notificationId = notificationIdForCall(callId)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                notificationId,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK,
            )
        } else {
            @Suppress("DEPRECATION")
            startForeground(notificationId, notification)
        }
        acquireWakeLock()
        // Same call may arrive via FCM + socket + WakeActivity; never restart the melody mid-ring.
        if (activeCallId == callId && mediaPlayer?.isPlaying == true) {
            return START_STICKY
        }
        activeCallId = callId
        startRingtone()
        return START_STICKY
    }

    override fun onDestroy() {
        activeCallId = null
        releaseWakeLock()
        stopRingtone()
        super.onDestroy()
    }

    private fun acquireWakeLock() {
        if (wakeLock?.isHeld == true) return
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock =
            pm.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "EmperyMobile:IncomingCallRingtone",
            ).apply {
                setReferenceCounted(false)
                acquire(RING_WAKE_LOCK_MS)
            }
    }

    private fun releaseWakeLock() {
        runCatching {
            wakeLock?.let { lock ->
                if (lock.isHeld) lock.release()
            }
        }
        wakeLock = null
    }

    private fun startRingtone() {
        if (mediaPlayer?.isPlaying == true) return
        stopRingtone()
        val uri = EmperyNotificationSoundChannels.callsSoundUri(this)
        if (uri == Uri.EMPTY) return
        mediaPlayer =
            MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build(),
                )
                setDataSource(this@IncomingCallRingtoneService, uri)
                isLooping = true
                prepare()
                start()
            }
    }

    private fun stopRingtone() {
        runCatching {
            mediaPlayer?.stop()
            mediaPlayer?.release()
        }
        mediaPlayer = null
    }

    private fun buildRingNotification(
        callId: String,
        chatId: String?,
        title: String,
        callerUserId: String? = null,
        callerAvatarUrl: String? = null,
        callKind: String? = null,
    ): Notification {
        val launchIntent = buildWakeActivityIntent(callId, chatId, title, callerUserId, callerAvatarUrl, callKind)
        val contentIntent =
            PendingIntent.getActivity(
                this,
                notificationIdForCall(callId),
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        val smallIcon = applicationInfo.icon.takeIf { it != 0 }
            ?: android.R.drawable.stat_sys_phone_call
        return NotificationCompat.Builder(this, EmperyNotificationSoundChannels.CALLS_CHANNEL_ID)
            .setSmallIcon(smallIcon)
            .setContentTitle(title.ifBlank { getString(R.string.notification_incoming_call_title) })
            .setContentText(getString(R.string.app_incoming_call_tap_answer))
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            // MediaPlayer owns the loop; channel/notification sound would restart the melody.
            .setSilent(true)
            .setSound(null)
            .setOnlyAlertOnce(true)
            .setContentIntent(contentIntent)
            .setFullScreenIntent(contentIntent, true)
            .build()
    }

    private fun buildWakeActivityIntent(
        callId: String,
        chatId: String?,
        title: String,
        callerUserId: String? = null,
        callerAvatarUrl: String? = null,
        callKind: String? = null,
    ): Intent =
        Intent(this, IncomingGafCallWakeActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(EXTRA_CALL_ID, callId)
            if (!chatId.isNullOrBlank()) putExtra(EXTRA_CHAT_ID, chatId)
            if (title.isNotBlank()) putExtra(EXTRA_TITLE, title)
            putCallerMetadata(this, callerUserId, callerAvatarUrl, callKind)
        }

    companion object {
        const val EXTRA_CALL_ID = "incoming_call_id"
        const val EXTRA_CHAT_ID = "incoming_chat_id"
        const val EXTRA_TITLE = "incoming_call_title"
        const val EXTRA_CALLER_USER_ID = "incoming_caller_user_id"
        const val EXTRA_CALLER_AVATAR_URL = "incoming_caller_avatar_url"
        const val EXTRA_CALL_KIND = "incoming_call_kind"
        private const val RING_WAKE_LOCK_MS = 60_000L

        fun start(
            context: Context,
            callId: String,
            chatId: String?,
            title: String,
            callerUserId: String? = null,
            callerAvatarUrl: String? = null,
            callKind: String? = null,
        ) {
            val intent =
                Intent(context, IncomingCallRingtoneService::class.java).apply {
                    putExtra(EXTRA_CALL_ID, callId)
                    if (!chatId.isNullOrBlank()) putExtra(EXTRA_CHAT_ID, chatId)
                    if (title.isNotBlank()) putExtra(EXTRA_TITLE, title)
                    if (!callerUserId.isNullOrBlank()) putExtra(EXTRA_CALLER_USER_ID, callerUserId)
                    if (!callerAvatarUrl.isNullOrBlank()) putExtra(EXTRA_CALLER_AVATAR_URL, callerAvatarUrl)
                    if (!callKind.isNullOrBlank()) putExtra(EXTRA_CALL_KIND, callKind)
                }
            context.startForegroundService(intent)
        }

        fun putCallerMetadata(
            intent: Intent,
            callerUserId: String?,
            callerAvatarUrl: String?,
            callKind: String?,
        ) {
            if (!callerUserId.isNullOrBlank()) intent.putExtra(EXTRA_CALLER_USER_ID, callerUserId)
            if (!callerAvatarUrl.isNullOrBlank()) intent.putExtra(EXTRA_CALLER_AVATAR_URL, callerAvatarUrl)
            if (!callKind.isNullOrBlank()) intent.putExtra(EXTRA_CALL_KIND, callKind)
        }

        fun stop(context: Context, callId: String) {
            val intent = Intent(context, IncomingCallRingtoneService::class.java)
            context.stopService(intent)
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.cancel(notificationIdForCall(callId))
        }

        fun notificationIdForCall(callId: String): Int =
            ("incoming-call:$callId").hashCode()
    }
}
