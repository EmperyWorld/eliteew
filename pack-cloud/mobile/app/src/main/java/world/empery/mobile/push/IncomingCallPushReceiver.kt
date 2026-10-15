/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Notification action receiver for incoming GAF video calls (accept / decline).
 *
 * Invariants:
 * - Stops ringtone service and cancels call notification before navigation/API side effects.
 *
 * Related:
 * - NotificationHelper, IncomingCallRingtoneService, MainActivity
 */
package world.empery.mobile.push

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import world.empery.mobile.MainActivity
import world.empery.mobile.MobileApp
import world.empery.mobile.MobileDeepLinks

class IncomingCallPushReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent == null) return
        val callId = intent.getStringExtra(EXTRA_CALL_ID)?.trim().orEmpty()
        if (callId.isBlank()) return
        val chatId = intent.getStringExtra(EXTRA_CHAT_ID)?.trim()?.ifBlank { null }
        val title = intent.getStringExtra(EXTRA_TITLE)?.trim().orEmpty()
        IncomingCallRingtoneService.stop(context, callId)
        cancelCallNotification(context, callId)

        when (intent.action) {
            ACTION_ACCEPT -> {
                val launch =
                    Intent(context, MainActivity::class.java).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                        putExtra(MobileDeepLinks.EXTRA_NAV_ROUTE, "chat")
                        putExtra(NotificationHelper.EXTRA_INCOMING_CALL_ID, callId)
                        if (!chatId.isNullOrBlank()) {
                            putExtra(NotificationHelper.EXTRA_INCOMING_CHAT_ID, chatId)
                        }
                        putExtra(NotificationHelper.EXTRA_AUTO_ACCEPT_CALL, true)
                    }
                context.startActivity(launch)
            }
            ACTION_DECLINE -> {
                val pending = goAsync()
                runBlocking(Dispatchers.IO) {
                    runCatching {
                        val app = context.applicationContext as? MobileApp
                        app?.container?.chatRepository?.endGafVideoCall(callId)
                    }
                    pending.finish()
                }
            }
        }
    }

    private fun cancelCallNotification(context: Context, callId: String) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.cancel(IncomingCallRingtoneService.notificationIdForCall(callId))
        nm.cancel(callId.hashCode())
    }

    companion object {
        const val ACTION_ACCEPT = "world.empery.mobile.action.INCOMING_CALL_ACCEPT"
        const val ACTION_DECLINE = "world.empery.mobile.action.INCOMING_CALL_DECLINE"
        const val EXTRA_CALL_ID = "extra_incoming_call_action_id"
        const val EXTRA_CHAT_ID = "extra_incoming_call_action_chat_id"
        const val EXTRA_TITLE = "extra_incoming_call_action_title"
    }
}
