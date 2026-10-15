/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compact pre-call network, camera, and microphone diagnostics for GAF video calls.
 *
 * Invariants:
 * - Public function signature remains stable for existing call sites.
 *
 * Related:
 * - IncomingGafVideoCallScreen.kt, OutgoingGafVideoCallScreen.kt
 */
package feature.chat

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp

@Composable
fun GafPreCallDiagnosticsRow(
    networkAvailable: Boolean,
    cameraGranted: Boolean,
    micGranted: Boolean,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(
            text = stringResource(R.string.chat_video_call_pre_call_title),
            style = MaterialTheme.typography.labelLarge,
        )
        Text(
            text =
                stringResource(
                    if (networkAvailable) {
                        R.string.chat_video_call_pre_call_network_ok
                    } else {
                        R.string.chat_video_call_pre_call_network_offline
                    },
                ),
            style = MaterialTheme.typography.bodySmall,
            color =
                if (networkAvailable) {
                    MaterialTheme.colorScheme.primary
                } else {
                    MaterialTheme.colorScheme.error
                },
        )
        Text(
            text =
                stringResource(
                    if (cameraGranted) {
                        R.string.chat_video_call_pre_call_camera_ok
                    } else {
                        R.string.chat_video_call_pre_call_camera_denied
                    },
                ),
            style = MaterialTheme.typography.bodySmall,
        )
        Text(
            text =
                stringResource(
                    if (micGranted) {
                        R.string.chat_video_call_pre_call_mic_ok
                    } else {
                        R.string.chat_video_call_pre_call_mic_denied
                    },
                ),
            style = MaterialTheme.typography.bodySmall,
        )
    }
}
