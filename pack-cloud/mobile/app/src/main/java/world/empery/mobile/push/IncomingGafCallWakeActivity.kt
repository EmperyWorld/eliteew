/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Full-screen incoming GAF call UI for lock screen and FCM wake (accept / decline).
 *
 * Invariants:
 * - Shows above lock screen; accept/decline only via explicit overlay actions.
 * - System back finishes this activity only — ringtone FGS + call notification keep ringing.
 * - Reuses IncomingGafVideoCallOverlay; ringtone is owned by IncomingCallRingtoneService FGS.
 *
 * Related:
 * - IncomingCallRingtoneService, IncomingCallPushReceiver, MainActivity
 */
package world.empery.mobile.push

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import feature.chat.IncomingGafVideoCallOverlay
import feature.profile.MobileUiStylePreferences
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import world.empery.mobile.MobileApp
import world.empery.mobile.R
import world.empery.mobile.core.ui.LocalMobileApiBaseUrl
import world.empery.mobile.theme.EmperyMobileTheme
import androidx.compose.runtime.CompositionLocalProvider

class IncomingGafCallWakeActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
            )
        }
        val callId = intent.getStringExtra(IncomingCallRingtoneService.EXTRA_CALL_ID)?.trim().orEmpty()
        val chatId = intent.getStringExtra(IncomingCallRingtoneService.EXTRA_CHAT_ID)?.trim()?.ifBlank { null }
        val title = intent.getStringExtra(IncomingCallRingtoneService.EXTRA_TITLE)?.trim().orEmpty()
        val callerUserId =
            intent.getStringExtra(IncomingCallRingtoneService.EXTRA_CALLER_USER_ID)?.trim()?.ifBlank { null }
        val callerAvatarUrl =
            intent.getStringExtra(IncomingCallRingtoneService.EXTRA_CALLER_AVATAR_URL)?.trim()?.ifBlank { null }
        val callKind = intent.getStringExtra(IncomingCallRingtoneService.EXTRA_CALL_KIND)?.trim()?.ifBlank { null }
        if (callId.isBlank()) {
            finish()
            return
        }
        IncomingCallRingtoneService.start(
            context = this,
            callId = callId,
            chatId = chatId,
            title = title,
            callerUserId = callerUserId,
            callerAvatarUrl = callerAvatarUrl,
            callKind = callKind,
        )
        val mobileStyle = MobileUiStylePreferences.get(this)
        val app = application as MobileApp
        val apiBaseUrl = app.container.apiBaseUrl
        setContent {
            val defaultTitle = stringResource(R.string.app_gaf_video_call_default)
            var incomingState by remember(callId, chatId, title, callerUserId, callerAvatarUrl, callKind) {
                mutableStateOf(
                    IncomingCallLocalResolver.build(
                        chats = emptyList(),
                        friends = emptyList(),
                        callId = callId,
                        chatId = chatId,
                        callerUserId = callerUserId,
                        callKind = callKind,
                        participantUserIds = emptyList(),
                        fallbackTitle = title.ifBlank { defaultTitle },
                        fallbackAvatarUrl = callerAvatarUrl,
                    ),
                )
            }
            LaunchedEffect(callId, chatId, callerUserId, callerAvatarUrl, callKind, title) {
                val resolved =
                    withContext(Dispatchers.IO) {
                        IncomingCallLocalResolver.resolve(
                            container = app.container,
                            callId = callId,
                            chatId = chatId,
                            callerUserId = callerUserId,
                            callKind = callKind,
                            participantUserIds = emptyList(),
                            fallbackTitle = title.ifBlank { defaultTitle },
                            fallbackAvatarUrl = callerAvatarUrl,
                        )
                    }
                incomingState = resolved
            }
            EmperyMobileTheme(mobileStyle = mobileStyle) {
                CompositionLocalProvider(LocalMobileApiBaseUrl provides apiBaseUrl) {
                    IncomingGafVideoCallOverlay(
                        state = incomingState,
                        onAccept = { dispatchAction(IncomingCallPushReceiver.ACTION_ACCEPT, callId, chatId, title) },
                        onDecline = { dispatchAction(IncomingCallPushReceiver.ACTION_DECLINE, callId, chatId, title) },
                        modifier = Modifier.fillMaxSize(),
                        playRingtone = false,
                        onSystemBack = { finish() },
                    )
                }
            }
        }
    }

    private fun dispatchAction(
        action: String,
        callId: String,
        chatId: String?,
        title: String,
    ) {
        val broadcast =
            Intent(this, IncomingCallPushReceiver::class.java).apply {
                this.action = action
                putExtra(IncomingCallPushReceiver.EXTRA_CALL_ID, callId)
                if (!chatId.isNullOrBlank()) putExtra(IncomingCallPushReceiver.EXTRA_CHAT_ID, chatId)
                if (title.isNotBlank()) putExtra(IncomingCallPushReceiver.EXTRA_TITLE, title)
            }
        sendBroadcast(broadcast)
        finish()
    }
}
