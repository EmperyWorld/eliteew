/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Full-screen incoming GAF video call overlay: caller/group avatars, accept and decline actions.
 *
 * Invariants:
 * - Covers entire shell; only the explicit decline control ends the call on the server.
 * - System back defaults to consume-only (no /end); callers may pass [onSystemBack] (e.g. wake finish).
 * - Plays incoming ringtone while visible; stops on dispose.
 *
 * Related:
 * - MainViewModel.kt, MainActivity.kt, ProfileAvatarPlaceholder
 */
package feature.chat

import android.media.MediaPlayer
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.CallEnd
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Videocam
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import feature.profile.ProfileAvatarPlaceholder
import world.empery.mobile.core.storage.ProfileEntity

@Immutable
data class IncomingCallParticipantUi(
    val userId: String,
    val displayName: String,
    val avatarUrl: String?,
)

@Immutable
data class IncomingGafVideoCallUi(
    val callId: String,
    val chatId: String?,
    val title: String,
    val callerUserId: String?,
    val isGroupCall: Boolean,
    val participants: List<IncomingCallParticipantUi>,
)

private fun IncomingCallParticipantUi.toProfileEntity(): ProfileEntity =
    ProfileEntity(
        id = userId,
        email = null,
        username = displayName,
        fullName = displayName,
        avatarUrl = avatarUrl,
        updatedAtEpochMs = 0L,
    )

@Composable
fun IncomingGafVideoCallOverlay(
    state: IncomingGafVideoCallUi,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
    modifier: Modifier = Modifier,
    playRingtone: Boolean = true,
    onSystemBack: () -> Unit = {},
) {
    IncomingCallRingEffect(active = playRingtone)
    // Default: consume back without /end. Wake UI may finish() via [onSystemBack].
    BackHandler(onBack = onSystemBack)

    val backdrop =
        Brush.verticalGradient(
            colors =
                listOf(
                    Color(0xFF050816),
                    Color(0xFF141B44),
                    Color(0xFF2A1854),
                    Color(0xFF0A1028),
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
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Icon(
                    imageVector = if (state.isGroupCall) Icons.Filled.Groups else Icons.Filled.Videocam,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.92f),
                    modifier = Modifier.size(22.dp),
                )
                Text(
                    text = stringResource(R.string.chat_video_call_incoming_title),
                    style = MaterialTheme.typography.titleMedium,
                    color = Color.White.copy(alpha = 0.88f),
                    fontWeight = FontWeight.Medium,
                )
            }
            Spacer(modifier = Modifier.height(36.dp))
            if (state.isGroupCall && state.participants.size > 1) {
                IncomingGroupParticipantsHero(participants = state.participants)
            } else {
                IncomingSingleCallerHero(participant = state.participants.firstOrNull())
            }
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
                text =
                    if (state.isGroupCall) {
                        stringResource(
                            R.string.chat_video_call_incoming_group_subtitle,
                            state.participants.size.coerceAtLeast(1),
                        )
                    } else {
                        stringResource(R.string.chat_video_call_incoming_subtitle)
                    },
                style = MaterialTheme.typography.bodyLarge,
                color = Color.White.copy(alpha = 0.72f),
                textAlign = TextAlign.Center,
            )
            if (state.isGroupCall && state.participants.size > 1) {
                Spacer(modifier = Modifier.height(20.dp))
                IncomingParticipantNameChips(participants = state.participants)
            }
            Spacer(modifier = Modifier.weight(1f))
            IncomingCallActionRow(onAccept = onAccept, onDecline = onDecline)
            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

@Composable
private fun IncomingSingleCallerHero(participant: IncomingCallParticipantUi?) {
    val pulseTransition = rememberInfiniteTransition(label = "incoming_call_pulse")
    val pulseScale by pulseTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.12f,
        animationSpec =
            infiniteRepeatable(
                animation = tween(durationMillis = 1400, easing = FastOutSlowInEasing),
                repeatMode = RepeatMode.Reverse,
            ),
        label = "pulse_scale",
    )
    val pulseAlpha by pulseTransition.animateFloat(
        initialValue = 0.35f,
        targetValue = 0.08f,
        animationSpec =
            infiniteRepeatable(
                animation = tween(durationMillis = 1400, easing = FastOutSlowInEasing),
                repeatMode = RepeatMode.Reverse,
            ),
        label = "pulse_alpha",
    )
    Box(contentAlignment = Alignment.Center) {
        Box(
            modifier =
                Modifier
                    .size(168.dp)
                    .scale(pulseScale)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primary.copy(alpha = pulseAlpha)),
        )
        Box(
            modifier =
                Modifier
                    .size(140.dp)
                    .clip(CircleShape)
                    .border(2.dp, Color.White.copy(alpha = 0.28f), CircleShape)
                    .padding(6.dp),
            contentAlignment = Alignment.Center,
        ) {
            ProfileAvatarPlaceholder(
                entity = participant?.toProfileEntity(),
                modifier = Modifier.size(128.dp),
            )
        }
    }
}

@Composable
private fun IncomingGroupParticipantsHero(participants: List<IncomingCallParticipantUi>) {
    Row(
        horizontalArrangement = Arrangement.spacedBy((-18).dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        participants.take(5).forEachIndexed { index, participant ->
            Box(
                modifier =
                    Modifier
                        .size(if (index == 0) 96.dp else 76.dp)
                        .clip(CircleShape)
                        .border(2.dp, Color.White.copy(alpha = 0.32f), CircleShape)
                        .background(Color(0xFF1A1F3D))
                        .padding(4.dp),
            ) {
                ProfileAvatarPlaceholder(
                    entity = participant.toProfileEntity(),
                    modifier = Modifier.fillMaxSize(),
                )
            }
        }
        if (participants.size > 5) {
            Surface(
                shape = CircleShape,
                color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.92f),
                modifier = Modifier.size(76.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text(
                        text = "+${participants.size - 5}",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun IncomingParticipantNameChips(participants: List<IncomingCallParticipantUi>) {
    FlowRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        participants.forEach { participant ->
            Surface(
                shape = CircleShape,
                color = Color.White.copy(alpha = 0.1f),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.18f)),
            ) {
                Text(
                    text = participant.displayName,
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
                    style = MaterialTheme.typography.labelLarge,
                    color = Color.White.copy(alpha = 0.92f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

@Composable
private fun IncomingCallActionRow(
    onAccept: () -> Unit,
    onDecline: () -> Unit,
) {
    val acceptCd = stringResource(R.string.chat_video_call_accept)
    val declineCd = stringResource(R.string.chat_video_call_decline)
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IncomingCallActionButton(
            icon = Icons.Filled.CallEnd,
            label = declineCd,
            containerColor = Color(0xFFD32F2F),
            contentColor = Color.White,
            contentDescription = declineCd,
            onClick = onDecline,
        )
        IncomingCallActionButton(
            icon = Icons.Filled.Call,
            label = acceptCd,
            containerColor = Color(0xFF2E7D32),
            contentColor = Color.White,
            contentDescription = acceptCd,
            onClick = onAccept,
        )
    }
}

@Composable
private fun IncomingCallActionButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    containerColor: Color,
    contentColor: Color,
    contentDescription: String,
    onClick: () -> Unit,
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        IconButton(
            onClick = onClick,
            modifier =
                Modifier
                    .size(80.dp)
                    .semantics { this.contentDescription = contentDescription }
                    .clip(CircleShape)
                    .background(containerColor)
                    .border(2.dp, Color.White.copy(alpha = 0.22f), CircleShape),
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = contentColor,
                modifier = Modifier.size(34.dp),
            )
        }
        Text(
            text = label,
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.SemiBold,
            color = Color.White.copy(alpha = 0.9f),
        )
    }
}

@Composable
private fun IncomingCallRingEffect(active: Boolean) {
    val context = LocalContext.current
    val ringUri =
        remember(context.packageName) {
            val resId =
                context.resources.getIdentifier(
                    "empery_ringtone_incoming",
                    "raw",
                    context.packageName,
                )
            if (resId == 0) {
                null
            } else {
                Uri.parse("android.resource://${context.packageName}/$resId")
            }
        }
    DisposableEffect(active, ringUri) {
        if (!active || ringUri == null) {
            return@DisposableEffect onDispose {}
        }
        val player =
            runCatching {
                MediaPlayer.create(context, ringUri)?.apply {
                    isLooping = true
                    start()
                }
            }.getOrNull()
        onDispose {
            runCatching {
                player?.stop()
                player?.release()
            }
        }
    }
}
