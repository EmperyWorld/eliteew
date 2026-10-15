/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Production FCM entry: token refresh, data sync, chat/call pushes, tab navigation via [MobilePushNavigation].
 *
 * Invariants:
 * - FCM token values never logged (device correlation secret).
 * - Signed-out sessions skip chat/social UI; incoming video-call rings still deliver
 *   ([MobilePushDeliveryPolicy.allowWhenSignedOut]) so session wipe does not mute calls.
 * - Duplicate messageId suppressed 10 min.
 *
 * Related:
 * - MobilePushNavigation.kt, MobilePushDeliveryPolicy, NotificationHelper.kt,
 *   MOBILE-ANDROID-PUSH-DEEPLINK-REGISTRY.md
 */
package world.empery.mobile.push

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import feature.notifications.NotificationPreferenceCategory
import world.empery.mobile.R
import world.empery.mobile.BuildConfig
import world.empery.mobile.MainActivity
import world.empery.mobile.MobileApp
import world.empery.mobile.MobileDeepLinks
import world.empery.mobile.observability.MobileTelemetry
import world.empery.mobile.sync.MobileSyncScheduler
import world.empery.mobile.sync.MobileSyncScope
import java.util.LinkedHashMap
import java.util.concurrent.atomic.AtomicInteger

class MobileFirebaseMessagingService : FirebaseMessagingService() {

    private val channelInitLock = Any()
    private val messageDedupeLock = Any()
    private val notificationIdSeq = AtomicInteger(1)

    override fun onCreate() {
        super.onCreate()
        try {
            EmperyNotificationSoundChannels.ensureAll(this)
        } catch (e: Exception) {
            logFailure("Failed to ensure FCM notification channel", e)
        }
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        try {
            // Never log [token]: treat as a secret (account/device correlation).
            if (BuildConfig.DEBUG) {
                Log.d(TAG, "FCM token refreshed (value redacted from logs)")
            } else {
                Log.i(TAG, "FCM token refreshed")
            }
            MobileTelemetry.trackBusinessEvent("push_token_updated")
            (application as? MobileApp)?.onFcmTokenRefreshed(token)
        } catch (e: Exception) {
            logFailure("onNewToken post-processing failed", e)
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        try {
            val prefs = getSharedPreferences("empery_mobile_ui", android.content.Context.MODE_PRIVATE)
            val notificationsEnabled = prefs.getBoolean("notifications_enabled", true)
            if (!notificationsEnabled) {
                return
            }
            val signedIn =
                (application as? MobileApp)?.container?.authRepository?.hasSession() == true

            if (isDuplicateDelivery(message)) {
                return
            }
            val source = sanitizeDataField(message.data["source"])
            MobileTelemetry.trackBusinessEvent(
                name = "push_received",
                attributes = mapOf("source" to source, "signed_in" to signedIn.toString()),
            )
            if (!signedIn) {
                if (MobilePushDeliveryPolicy.allowWhenSignedOut(message.data)) {
                    handleIncomingVideoCallPush(message.data)
                }
                return
            }
            handleDataSync(message.data)
            if (MobilePushDeliveryPolicy.isIncomingVideoCallData(message.data)) {
                handleIncomingVideoCallPush(message.data)
                return
            }
            if (handleChatMessagePush(message.data)) {
                return
            }
            val payload = message.notification
            if (payload != null) {
                displayNotificationFromPayload(message)
            } else if (message.data.isNotEmpty()) {
                // Iron-Link C2: always post a local notification for data-only FCM.
                // Do not rely on background startActivity (restricted on Android 10+).
                displayNotificationFromDataOnly(message.data)
            }
        } catch (e: Exception) {
            logFailure("onMessageReceived handling failed", e)
        }
    }

    override fun onDeletedMessages() {
        super.onDeletedMessages()
        try {
            if (BuildConfig.DEBUG) {
                Log.w(TAG, "FCM reported deleted messages on server; sync if the app batches pushes")
            } else {
                Log.w(TAG, "FCM deleted messages reported")
            }
            MobileTelemetry.trackBusinessEvent("push_deleted_messages")
            MobileSyncScheduler.enqueueImmediate(applicationContext, MobileSyncScope.ALL, force = true)
        } catch (e: Exception) {
            logFailure("onDeletedMessages handling failed", e)
        }
    }



    private fun handleDataSync(data: Map<String, String>) {
        val syncRaw = data["sync"]?.trim()?.lowercase().orEmpty()
        if (syncRaw.isBlank()) return
        val scope =
            when (syncRaw) {
                "light" -> MobileSyncScope.LIGHT
                "chat" -> MobileSyncScope.CHAT
                "notifications" -> MobileSyncScope.NOTIFICATIONS
                "feed" -> MobileSyncScope.FEED
                "friends" -> MobileSyncScope.FRIENDS
                else -> MobileSyncScope.ALL
            }
        MobileSyncScheduler.enqueuePushSyncWithRetries(applicationContext, scope)
    }

    private fun handleIncomingVideoCallPush(data: Map<String, String>) {
        val callTarget =
            data["call_target"]?.trim().orEmpty().ifBlank {
                feature.profile.MobileProfileLocalStore.getCallTarget(this)
            }
        if (!feature.profile.VideoCallTarget.shouldRingMobile(callTarget)) {
            return
        }
        val callId = data["call_id"]?.trim().orEmpty().ifBlank { data["callId"]?.trim().orEmpty() }
        if (callId.isBlank()) return
        val chatId = data["chat_id"]?.trim().orEmpty().ifBlank { data["chatId"]?.trim().orEmpty() }.ifBlank { null }
        val title = data["title"]?.trim().orEmpty().ifBlank { getString(R.string.app_gaf_video_call_default) }
        val callerUserId = data["caller_user_id"]?.trim().orEmpty().ifBlank { null }
        val callerAvatarUrl = data["caller_avatar_url"]?.trim().orEmpty().ifBlank { null }
        NotificationHelper.showIncomingVideoCall(
            context = this,
            callId = callId,
            chatId = chatId,
            title = title,
            callerUserId = callerUserId,
            callerAvatarUrl = callerAvatarUrl,
        )
        MobileSyncScheduler.enqueueImmediate(applicationContext, MobileSyncScope.CHAT, force = true)
    }

    private fun handleChatMessagePush(data: Map<String, String>): Boolean {
        val type = data["type"]?.trim()?.lowercase().orEmpty()
        val event = data["event"]?.trim()?.lowercase().orEmpty()
        val isChatMessage =
            type == "gaf_chat_message" ||
                event == "gaf_chat.message_new" ||
                (data["sync"]?.trim()?.lowercase() == "chat" && !data["title"].isNullOrBlank())
        if (!isChatMessage) return false
        if (IncomingCallAlertSupport.shouldSuppressChatNotificationData(data)) return true
        val chatId = MobileDeepLinks.coerceChatId(data["chat_id"] ?: data["chatId"])
        val title = data["title"]?.trim().orEmpty()
            .ifBlank { getString(R.string.app_chat_new_message_title) }
        val body = data["body"]?.trim().orEmpty()
            .ifBlank { getString(R.string.app_chat_new_message_body_fallback) }
        if (NotificationDeliveryGate.shouldDeliver(this, NotificationPreferenceCategory.CHAT)) {
            NotificationHelper.showNotification(
                context = this,
                title = title,
                body = body,
                tab = "chat",
                targetChatId = chatId,
                category = NotificationPreferenceCategory.CHAT,
            )
        }
        return true
    }

    private fun displayNotificationFromDataOnly(data: Map<String, String>) {
        val title =
            data["title"]?.trim().orEmpty()
                .ifBlank { data["notification_title"]?.trim().orEmpty() }
                .ifBlank { getString(R.string.app_notification_default_title) }
        val body =
            data["body"]?.trim().orEmpty()
                .ifBlank { data["message"]?.trim().orEmpty() }
                .ifBlank { getString(R.string.app_chat_new_message_body_fallback) }
        val tab = data["tab"]?.trim()?.takeIf { it.isNotEmpty() }
        NotificationHelper.showNotification(
            context = this,
            title = title,
            body = body,
            tab = tab,
            friendRequestId = data["friend_request_id"] ?: data["friendRequestId"],
            friendUserId = data["friend_user_id"] ?: data["friendUserId"],
            friendsFocus = data["friends_focus"] ?: data["focus"],
            targetNotificationId = data["notification_id"] ?: data["notificationId"],
            targetChatId = MobileDeepLinks.coerceChatId(data["chat_id"] ?: data["chatId"]),
            targetProfileSection = data["profile_section"],
            targetUgsNestedRoute = data["ugs_route"] ?: data["ugsNestedRoute"],
            targetDesktopHubSection = data["desktop_hub_section"],
        )
    }

    private fun isDuplicateDelivery(message: RemoteMessage): Boolean {
        val id = message.messageId?.takeIf { it.isNotBlank() } ?: return false
        val now = System.currentTimeMillis()
        synchronized(messageDedupeLock) {
            val it = recentMessageIds.entries.iterator()
            while (it.hasNext()) {
                if (now - it.next().value > MESSAGE_ID_RETENTION_MS) {
                    it.remove()
                }
            }
            if (recentMessageIds.containsKey(id)) {
                return true
            }
            recentMessageIds[id] = now
            while (recentMessageIds.size > MAX_TRACKED_MESSAGE_IDS) {
                val first = recentMessageIds.keys.iterator().next()
                recentMessageIds.remove(first)
            }
        }
        return false
    }

    private fun sanitizeDataField(raw: String?): String {
        val t = raw?.trim().orEmpty()
        if (t.isEmpty()) return "unknown"
        return t.take(DATA_FIELD_MAX_LEN)
    }

    private fun ensureDefaultNotificationChannel() {
        EmperyNotificationSoundChannels.ensurePushChannel(this)
    }

    private fun displayNotificationFromPayload(message: RemoteMessage) {
        val notification = message.notification ?: return
        ensureDefaultNotificationChannel()
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        val notificationId = notificationIdSeq.incrementAndGet()

        val launchIntent =
            MobilePushNavigation.buildMainActivityIntentFromFcmData(this, message.data)
                ?: Intent(this, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
        val contentIntent = PendingIntent.getActivity(
                this,
                notificationId,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        val title = clampNotificationText(
            notification.title?.takeIf { it.isNotBlank() },
            NOTIFICATION_TITLE_MAX,
        ).ifBlank { getString(android.R.string.untitled) }
        val text = clampNotificationText(notification.body, NOTIFICATION_BODY_MAX)
        val smallIcon = applicationInfo.icon.takeIf { it != 0 }
            ?: android.R.drawable.stat_notify_chat
        val built = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(smallIcon)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(contentIntent)
            .build()
        runCatching {
            nm.notify(notificationId, built)
        }.onFailure { e ->
            logFailure("notify failed for FCM payload", e)
        }
    }

    private fun clampNotificationText(raw: String?, maxLen: Int): String {
        val t = raw?.trim().orEmpty()
        if (t.isEmpty()) return ""
        return if (t.length <= maxLen) t else t.take(maxLen - 1) + "…"
    }

    private fun logFailure(message: String, e: Throwable) {
        MobileTelemetry.reportError(e, message)
        if (BuildConfig.DEBUG) {
            Log.e(TAG, message, e)
        } else {
            Log.e(TAG, message)
        }
    }

    companion object {
        private const val TAG = "MobilePush"
        private const val CHANNEL_ID = EmperyNotificationSoundChannels.PUSH_CHANNEL_ID
        private const val CHANNEL_NAME = "Push"
        private const val CHANNEL_DESCRIPTION = "General push notifications"
        private const val DATA_FIELD_MAX_LEN = 64
        private const val NOTIFICATION_TITLE_MAX = 200
        private const val NOTIFICATION_BODY_MAX = 3500
        private const val MESSAGE_ID_RETENTION_MS = 600_000L
        private const val MAX_TRACKED_MESSAGE_IDS = 256

        private val recentMessageIds = LinkedHashMap<String, Long>(64, 0.75f)
    }
}
