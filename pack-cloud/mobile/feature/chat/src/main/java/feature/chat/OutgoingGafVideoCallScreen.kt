/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Full-screen outgoing 1:1 GAF video call ringing UI (no Meet WebView until callee accepts).
 *
 * Related:
 * - IncomingGafVideoCallScreen.kt, MainViewModel.startGafVideoCallFromChat
 */
package feature.chat

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.filled.CallEnd
import androidx.compose.material3.IconButton
import androidx.compose.ui.draw.clip

data class OutgoingGafVideoCallUi(
    val callId: String,
    val chatId: String?,
    val title: String,
    val startedAtEpochMs: Long = System.currentTimeMillis(),
)

@Composable
fun OutgoingGafVideoCallOverlay(
    state: OutgoingGafVideoCallUi,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier,
) {
    BackHandler(onBack = onCancel)

    val backdrop =
        Brush.verticalGradient(
            colors =
                listOf(
                    Color(0xFF08122A),
                    Color(0xFF1A2550),
                    Color(0xFF241845),
                    Color(0xFF0B1228),
                ),
        )

    Box(
        modifier =
            modifier
                .fillMaxSize()
                .background(backdrop)
                .statusBarsPadding()
                .navigationBarsPadding(),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(modifier = Modifier.height(28.dp))
            Icon(
                imageVector = Icons.Filled.Videocam,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.92f),
                modifier = Modifier.size(22.dp),
            )
            Spacer(modifier = Modifier.height(36.dp))
            Text(
                text = stringResource(R.string.chat_video_call_outgoing_title),
                style = MaterialTheme.typography.titleMedium,
                color = Color.White.copy(alpha = 0.88f),
                fontWeight = FontWeight.Medium,
            )
            Spacer(modifier = Modifier.height(28.dp))
            Text(
                text = state.title,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = Color.White,
                textAlign = TextAlign.Center,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(modifier = Modifier.height(10.dp))
            Text(
                text = stringResource(R.string.chat_video_call_outgoing_subtitle),
                style = MaterialTheme.typography.bodyLarge,
                color = Color.White.copy(alpha = 0.72f),
                textAlign = TextAlign.Center,
            )
            Spacer(modifier = Modifier.weight(1f))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    IconButton(
                        onClick = onCancel,
                        modifier =
                            Modifier
                                .size(72.dp)
                                .clip(CircleShape)
                                .background(Color(0xFFD32F2F)),
                    ) {
                        Icon(
                            imageVector = Icons.Filled.CallEnd,
                            contentDescription = stringResource(R.string.chat_video_call_outgoing_cancel),
                            tint = Color.White,
                            modifier = Modifier.size(30.dp),
                        )
                    }
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        text = stringResource(R.string.chat_video_call_outgoing_cancel),
                        style = MaterialTheme.typography.labelLarge,
                        color = Color.White.copy(alpha = 0.88f),
                    )
                }
            }
            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}
