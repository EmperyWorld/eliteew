/*
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * In-app banner while a GAF video call is active — return to Meet WebView or end call.
 *
 * Invariants:
 * - Shown only when the host app tracks an active GAF video-call session.
 *
 * Related:
 * - MainActivity.kt, MainViewModel.kt, GafMeetWebViewLauncher.kt
 */

package feature.chat

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Call
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import world.empery.mobile.core.ui.PremiumRowSurface

/** UI model for [GafVideoCallReturnBar] (decoupled from app module ViewModel types). */
data class GafVideoCallBarState(
    val title: String,
    val chatId: String?,
    /** Optional mm:ss label shown under the active-call hint. */
    val elapsedLabel: String? = null,
)

@Composable
fun GafVideoCallReturnBar(
    state: GafVideoCallBarState,
    onReturnToCall: () -> Unit,
    onEndCall: () -> Unit,
    modifier: Modifier = Modifier,
) {
    PremiumRowSurface(
        modifier = modifier.fillMaxWidth(),
        containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.86f),
        borderColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.28f),
        tonalElevation = 4.dp,
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            LinearProgressIndicator(
                modifier = Modifier.fillMaxWidth(),
                trackColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f),
            )
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    imageVector = Icons.Filled.Call,
                    contentDescription = null,
                    modifier = Modifier.size(28.dp),
                    tint = MaterialTheme.colorScheme.primary,
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = state.title.ifBlank { stringResource(R.string.chat_video_call_title) },
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold),
                        maxLines = 1,
                    )
                    Text(
                        text =
                            state.elapsedLabel?.let {
                                stringResource(R.string.chat_video_call_return_elapsed, it)
                            } ?: stringResource(R.string.chat_video_call_active_hint),
                        style = MaterialTheme.typography.labelSmall,
                    )
                }
                TextButton(onClick = onEndCall) {
                    Text(stringResource(R.string.chat_video_call_end))
                }
                Button(onClick = onReturnToCall) {
                    Text(stringResource(R.string.chat_video_call_return))
                }
            }
        }
    }
}
