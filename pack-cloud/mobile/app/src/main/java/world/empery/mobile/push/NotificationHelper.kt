/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * FCM notification channels and builders for chat, calls, and general push.
 *
 * Invariants:
 * - Channel labels and default notification copy use app string resources.
 * - Incoming calls use full-screen intent + accept/decline actions when permitted.
 *
 * Related:
 * - MobilePushNavigation.kt, MobileFirebaseMessagingService, NotificationDeliveryGate
 */
package world.empery.mobile.push

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import feature.notifications.NotificationPreferenceCategory
import world.empery.mobile.MainActivity
import world.empery.mobile.R
import world.empery.mobile.MobileDeepLinks
import java.util.concurrent.atomic.AtomicInteger

object NotificationHelper {
    private const val CHANNEL_ID = EmperyNotificationSoundChannels.PUSH_CHANNEL_ID
    private const val CALLS_CHANNEL_ID = EmperyNotificationSoundChannels.CALLS_CHANNEL_ID
    private val notificationIdSeq = AtomicInteger(1000)

    const val EXTRA_INCOMING_CALL_ID = "extra_incoming_call_id"
    const val EXTRA_INCOMING_CHAT_ID = "extra_incoming_chat_id"
    const val EXTRA_AUTO_ACCEPT_CALL = "extra_auto_accept_call"

    fun ensureChannel(context: Context) {
        EmperyNotificationSoundChannels.ensurePushChannel(context)
    }

    fun ensureCallsChannel(context: Context) {
        EmperyNotificationSoundChannels.ensureCallsChannel(context)
    }

    fun showIncomingVideoCall(
        context: Context,
        callId: String,
        chatId: String?,
        title: String,
        callerUserId: String? = null,
        callerAvatarUrl: String? = null,
        callKind: String? = null,
    ) {
        if (!NotificationDeliveryGate.shouldDeliverCall(context)) return
        ensureCallsChannel(context)
        IncomingCallRingtoneService.start(
            context = context,
            callId = callId,
            chatId = chatId,
            title = title,
            callerUserId = callerUserId,
            callerAvatarUrl = callerAvatarUrl,
            callKind = callKind,
        )
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val notificationId = IncomingCallRingtoneService.notificationIdForCall(callId)
        val fullScreenIntent =
            Intent(context, IncomingGafCallWakeActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra(IncomingCallRingtoneService.EXTRA_CALL_ID, callId)
                if (!chatId.isNullOrBlank()) putExtra(IncomingCallRingtoneService.EXTRA_CHAT_ID, chatId)
                if (title.isNotBlank()) putExtra(IncomingCallRingtoneService.EXTRA_TITLE, title)
                IncomingCallRingtoneService.putCallerMetadata(this, callerUserId, callerAvatarUrl, callKind)
            }
        val fullScreenPending =
            PendingIntent.getActivity(
                context,
                notificationId,
                fullScreenIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        val contentIntent =
            PendingIntent.getActivity(
                context,
                notificationId + 1,
                fullScreenIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        val acceptIntent =
            Intent(context, IncomingCallPushReceiver::class.java).apply {
                action = IncomingCallPushReceiver.ACTION_ACCEPT
                putExtra(IncomingCallPushReceiver.EXTRA_CALL_ID, callId)
                if (!chatId.isNullOrBlank()) putExtra(IncomingCallPushReceiver.EXTRA_CHAT_ID, chatId)
                if (title.isNotBlank()) putExtra(IncomingCallPushReceiver.EXTRA_TITLE, title)
            }
        val declineIntent =
            Intent(context, IncomingCallPushReceiver::class.java).apply {
                action = IncomingCallPushReceiver.ACTION_DECLINE
                putExtra(IncomingCallPushReceiver.EXTRA_CALL_ID, callId)
                if (!chatId.isNullOrBlank()) putExtra(IncomingCallPushReceiver.EXTRA_CHAT_ID, chatId)
                if (title.isNotBlank()) putExtra(IncomingCallPushReceiver.EXTRA_TITLE, title)
            }
        val acceptPending =
            PendingIntent.getBroadcast(
                context,
                notificationId + 2,
                acceptIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        val declinePending =
            PendingIntent.getBroadcast(
                context,
                notificationId + 3,
                declineIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        val smallIcon = context.applicationInfo.icon.takeIf { it != 0 }
            ?: android.R.drawable.stat_sys_phone_call
        val builder =
            NotificationCompat.Builder(context, CALLS_CHANNEL_ID)
                .setSmallIcon(smallIcon)
                .setContentTitle(title.ifBlank { context.getString(R.string.notification_incoming_call_title) })
                .setContentText(context.getString(R.string.app_incoming_call_tap_answer))
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setAutoCancel(false)
                // RingtoneService MediaPlayer owns audio; posting again must not re-alert.
                .setSilent(true)
                .setSound(null)
                .setOnlyAlertOnce(true)
                .setVibrate(null)
                .setContentIntent(contentIntent)
                .setFullScreenIntent(fullScreenPending, true)
                .addAction(
                    android.R.drawable.ic_menu_close_clear_cancel,
                    context.getString(R.string.notification_call_decline_action),
                    declinePending,
                )
                .addAction(
                    android.R.drawable.ic_menu_call,
                    context.getString(R.string.notification_call_accept_action),
                    acceptPending,
                )
        nm.notify(notificationId, builder.build())
        runCatching {
            context.startActivity(fullScreenIntent)
        }
    }

    fun showNotification(
        context: Context,
        title: String,
        body: String,
        tab: String? = null,
        ewDeskPostId: String? = null,
        friendRequestId: String? = null,
        friendUserId: String? = null,
        friendsFocus: String? = null,
        targetNotificationId: String? = null,
        targetChatId: String? = null,
        targetProfileSection: String? = null,
        targetSocialHubInboxItemId: String? = null,
        targetUgsNestedRoute: String? = null,
        targetDesktopHubSection: String? = null,
        category: NotificationPreferenceCategory = notificationCategoryForTab(tab),
    ) {
        if (!NotificationDeliveryGate.shouldDeliver(context, category)) {
            return
        }

        ensureChannel(context)
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val notificationId = notificationIdSeq.incrementAndGet()

        val launchIntent =
            MobilePushNavigation.buildMainActivityIntentFromNotificationParams(
                context = context,
                tab = tab,
                ewDeskPostId = ewDeskPostId,
                friendRequestId = friendRequestId,
                friendUserId = friendUserId,
                friendsFocus = friendsFocus,
                targetNotificationId = targetNotificationId,
                targetChatId = targetChatId,
                targetProfileSection = targetProfileSection,
                targetSocialHubInboxItemId = targetSocialHubInboxItemId,
                targetUgsNestedRoute = targetUgsNestedRoute,
                targetDesktopHubSection = targetDesktopHubSection,
            ) ?: Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
        val contentIntent = PendingIntent.getActivity(
            context,
            notificationId,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val smallIcon = context.applicationInfo.icon.takeIf { it != 0 }
            ?: android.R.drawable.stat_notify_chat

        val built = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(smallIcon)
            .setContentTitle(title.ifBlank { context.getString(R.string.app_notification_default_title) })
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(contentIntent)
            .build()

        runCatching {
            nm.notify(notificationId, built)
        }
    }

    private fun notificationCategoryForTab(tab: String?): NotificationPreferenceCategory =
        when (tab?.trim()?.lowercase()) {
            "chat" -> NotificationPreferenceCategory.CHAT
            "friends", "inbox" -> NotificationPreferenceCategory.FRIENDS
            "ugs", "desktop" -> NotificationPreferenceCategory.UGS
            else -> NotificationPreferenceCategory.SYSTEM
        }
}
