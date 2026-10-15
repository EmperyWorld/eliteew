/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * GAF video-call Compose overlays extracted from MainActivity: Meet join permission/launch
 * effects, in-call return bar, group picker, and incoming/outgoing call sheets.
 *
 * Invariants:
 * - Does not own GafVideoCallCoordinator state machine — only renders overlays + Meet WebView launch.
 * - Route contracts unchanged; return-to-call may navigate to Chat tab via MobileBackStackPolicy.
 * - Package remains [world.empery.mobile] for a thin public shell API from MobileRoot.
 *
 * Related:
 * - MainActivity MobileRoot, shell/videocall/GafVideoCallCoordinator.kt,
 *   MOBILE-ANDROID-PRODUCT-PERFECTION-PLAN.md W1
 */
package world.empery.mobile

import android.Manifest
import android.content.pm.PackageManager
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.navigation.NavHostController
import feature.chat.GafGroupCallPickerUi
import feature.chat.GafGroupVideoCallPickerSheet
import feature.chat.GafMeetWebViewLauncher
import feature.chat.GafPreCallDiagnosticsRow
import feature.chat.IncomingGafVideoCallOverlay
import feature.chat.IncomingGafVideoCallUi
import feature.chat.OutgoingGafVideoCallOverlay
import feature.chat.OutgoingGafVideoCallUi
import world.empery.mobile.shell.MobileBackStackPolicy
import world.empery.mobile.shell.RootTab

@Composable
fun GafVideoCallMeetLaunchEffects(
    gafVideoCall: GafVideoCallOverlayUi?,
) {
    val context = LocalContext.current

    fun launchGafMeetWebViewIfReady(session: GafVideoCallOverlayUi) {
        if (!GafMeetWebViewLauncher.isValidJoinUrl(session.joinUrl)) {
            return
        }
        val act = context as? ComponentActivity ?: return
        GafMeetWebViewLauncher.launch(
            activity = act,
            joinUrl = session.joinUrl,
            title = session.title,
            callId = session.callId,
            chatId = session.chatId,
        )
    }

    val meetMediaPermissionLauncher =
        rememberLauncherForActivityResult(
            ActivityResultContracts.RequestMultiplePermissions(),
        ) { results ->
            val session = gafVideoCall ?: return@rememberLauncherForActivityResult
            if (!results.values.all { it }) {
                Toast.makeText(
                    context,
                    context.getString(feature.chat.R.string.chat_video_call_media_denied),
                    Toast.LENGTH_LONG,
                ).show()
                return@rememberLauncherForActivityResult
            }
            launchGafMeetWebViewIfReady(session)
        }

    LaunchedEffect(gafVideoCall?.callId, gafVideoCall?.joinUrl) {
        val session = gafVideoCall ?: return@LaunchedEffect
        if (!GafMeetWebViewLauncher.isValidJoinUrl(session.joinUrl)) {
            Toast.makeText(
                context,
                context.getString(feature.chat.R.string.chat_video_call_join_failed),
                Toast.LENGTH_LONG,
            ).show()
            return@LaunchedEffect
        }
        val camOk =
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                PackageManager.PERMISSION_GRANTED
        val micOk =
            ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
                PackageManager.PERMISSION_GRANTED
        if (camOk && micOk) {
            launchGafMeetWebViewIfReady(session)
        } else {
            meetMediaPermissionLauncher.launch(
                arrayOf(
                    Manifest.permission.CAMERA,
                    Manifest.permission.RECORD_AUDIO,
                ),
            )
        }
    }
}

@Composable
fun GafVideoCallActiveCallBanner(
    gafVideoCall: GafVideoCallOverlayUi?,
    eliteEwNetworkAvailable: Boolean,
    currentRoute: String?,
    navController: NavHostController,
    onReturnToActiveCall: () -> Unit,
    onEndCall: () -> Unit,
) {
    val context = LocalContext.current
    val activeCall = gafVideoCall ?: return

    fun bringGafMeetWebViewToForeground(session: GafVideoCallOverlayUi) {
        if (!GafMeetWebViewLauncher.isValidJoinUrl(session.joinUrl)) {
            return
        }
        val act = context as? ComponentActivity ?: return
        GafMeetWebViewLauncher.bringToForeground(
            activity = act,
            joinUrl = session.joinUrl,
            title = session.title,
            callId = session.callId,
            chatId = session.chatId,
        )
    }

    val camGranted =
        ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
            PackageManager.PERMISSION_GRANTED
    val micGranted =
        ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
            PackageManager.PERMISSION_GRANTED
    GafPreCallDiagnosticsRow(
        networkAvailable = eliteEwNetworkAvailable,
        cameraGranted = camGranted,
        micGranted = micGranted,
        modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
    )
    feature.chat.GafVideoCallReturnBar(
        state =
            feature.chat.GafVideoCallBarState(
                title = activeCall.title,
                chatId = activeCall.chatId,
                elapsedLabel = formatGafCallElapsed(activeCall.startedAtEpochMs),
            ),
        onReturnToCall = {
            if (currentRoute != RootTab.Chat.route) {
                MobileBackStackPolicy.navigateBottomTab(navController, RootTab.Chat.route)
            }
            onReturnToActiveCall()
            bringGafMeetWebViewToForeground(activeCall)
        },
        onEndCall = onEndCall,
    )
}

@Composable
fun GafVideoCallOverlayHost(
    isAuthenticated: Boolean,
    gafGroupCallPicker: GafGroupCallPickerUi?,
    incomingGafVideoCall: IncomingGafVideoCallUi?,
    outgoingGafVideoCall: OutgoingGafVideoCallUi?,
    onDismissGroupPicker: () -> Unit,
    onConfirmGroupCall: (List<String>) -> Unit,
    onAcceptIncoming: () -> Unit,
    onDeclineIncoming: () -> Unit,
    onCancelOutgoing: () -> Unit,
) {
    if (!isAuthenticated) return
    gafGroupCallPicker?.let { pickerState ->
        GafGroupVideoCallPickerSheet(
            state = pickerState,
            onDismiss = onDismissGroupPicker,
            onConfirm = { additionalIds ->
                onConfirmGroupCall(additionalIds)
            },
        )
    }
    incomingGafVideoCall?.let { incoming ->
        IncomingGafVideoCallOverlay(
            state = incoming,
            onAccept = onAcceptIncoming,
            onDecline = onDeclineIncoming,
            modifier = Modifier.fillMaxSize(),
        )
    }
    outgoingGafVideoCall?.let { outgoing ->
        OutgoingGafVideoCallOverlay(
            state = outgoing,
            onCancel = onCancelOutgoing,
            modifier = Modifier.fillMaxSize(),
        )
    }
}

private fun formatGafCallElapsed(startedAtEpochMs: Long): String {
    val elapsedSec = ((System.currentTimeMillis() - startedAtEpochMs) / 1000L).coerceAtLeast(0L)
    val minutes = elapsedSec / 60
    val seconds = elapsedSec % 60
    return "%d:%02d".format(minutes, seconds)
}
