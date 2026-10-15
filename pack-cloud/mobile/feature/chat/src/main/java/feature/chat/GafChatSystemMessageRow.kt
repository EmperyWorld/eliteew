/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Centered system-event row for GAF chat thread (video call events, onboarding, admin links).
 *
 * Invariants:
 * - System rows are not styled as user bubbles; no avatars or side alignment.
 *
 * Related:
 * - GafChatSystemMessageSupport.kt, GAFChatMessageBubble.tsx (desktop parity)
 */
package feature.chat

import android.content.Context
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Call
import androidx.compose.material.icons.outlined.CallEnd
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.Videocam
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

@Composable
fun GafChatSystemMessageRow(
    presentation: GafMessageSystemPresentation,
    fallbackBody: String,
    createdAt: String?,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val label =
        remember(presentation, fallbackBody) {
            resolveGafSystemMessageLabel(context, presentation, fallbackBody)
        }
    val durationSuffix =
        remember(presentation, fallbackBody) {
            if (isLegacyPostCallSummaryBody(fallbackBody)) {
                return@remember null
            }
            val video = presentation as? GafMessageSystemPresentation.VideoCallEvent
            val seconds = video?.durationSeconds
            if (video != null && seconds != null && seconds > 0) {
                context.getString(
                    R.string.chat_video_call_event_duration,
                    formatGafVideoCallDuration(seconds),
                )
            } else {
                null
            }
        }
    val timeLabel = remember(createdAt) { formatMessageTime(createdAt) }
    val icon = remember(presentation) { systemMessageIcon(presentation) }
    val cd =
        remember(label, durationSuffix, timeLabel) {
            buildString {
                append(context.getString(R.string.chat_system_message_cd))
                append(": ")
                append(label)
                durationSuffix?.let { append(" ").append(it) }
                if (timeLabel.isNotBlank()) append(" ").append(timeLabel)
            }
        }

    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp)
                .semantics { contentDescription = cd },
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Surface(
            color = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.72f),
            contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
            shape = RoundedCornerShape(999.dp),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.35f)),
            tonalElevation = 0.dp,
            shadowElevation = 0.dp,
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.primary,
                )
                Text(
                    text = label,
                    style = MaterialTheme.typography.labelMedium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    textAlign = TextAlign.Center,
                )
                if (!durationSuffix.isNullOrBlank()) {
                    Text(
                        text = durationSuffix,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.78f),
                        maxLines = 1,
                    )
                }
                if (timeLabel.isNotBlank()) {
                    Text(
                        text = timeLabel,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.62f),
                        maxLines = 1,
                    )
                }
            }
        }
    }
}

private fun systemMessageIcon(presentation: GafMessageSystemPresentation): ImageVector =
    when (presentation) {
        is GafMessageSystemPresentation.VideoCallEvent ->
            when (presentation.event) {
                "ringing" -> Icons.Outlined.Videocam
                "accepted" -> Icons.Outlined.Call
                "ended", "missed" -> Icons.Outlined.CallEnd
                else -> Icons.Outlined.Videocam
            }
        is GafMessageSystemPresentation.OnboardingInstruction,
        is GafMessageSystemPresentation.DesktopAppLink,
        is GafMessageSystemPresentation.Generic,
        -> Icons.Outlined.Info
    }

private fun formatMessageTime(createdAt: String?): String {
    val trimmed = createdAt?.trim().orEmpty()
    if (trimmed.isEmpty()) return ""
    return if (trimmed.length >= 16) trimmed.substring(11, 16) else trimmed.takeLast(5)
}
