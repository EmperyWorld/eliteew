/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared visual chrome for Empery media player (progress strip, chips, primary play, tool row).
 *
 * Invariants:
 * - Pure presentation; callbacks stay in parent composables.
 *
 * Related:
 * - EmperyPlayerChromeScale.kt, EmperyNowPlayingDock, EmperyExpandedPlayerSheet, EmperyMiniAudioControls
 * - documentation/product/desktop/ELITEEW-AUDIO-PLAYER-AND-MUSIC-UI-FULL-SUMMARY-2026-05-31.md
 */
package world.empery.mobile.core.media

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

@Composable
fun EmperyPlayerDockTimeLabel(
    state: EmperyMediaPlaybackState,
    modifier: Modifier = Modifier,
) {
    val durationMs = state.durationMs.coerceAtLeast(0L)
    if (durationMs <= 0L) return
    val positionMs = state.positionMs.coerceIn(0L, durationMs)
    Text(
        text =
            stringResource(
                R.string.empery_media_time_format,
                formatMediaTimeMs(positionMs),
                formatMediaTimeMs(durationMs),
            ),
        modifier = modifier,
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        maxLines = 1,
    )
}

@Composable
fun EmperyPlayerProgressStrip(
    state: EmperyMediaPlaybackState,
    modifier: Modifier = Modifier,
    stripHeight: Dp = 4.dp,
) {
    val durationMs = state.durationMs.coerceAtLeast(0L)
    if (durationMs <= 0L) return
    val positionFraction =
        (state.positionMs.toFloat() / durationMs.toFloat()).coerceIn(0f, 1f)
    val bufferFraction =
        (state.bufferedPositionMs.toFloat() / durationMs.toFloat()).coerceIn(0f, 1f)
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .height(stripHeight)
                .clip(RoundedCornerShape(999.dp)),
    ) {
        LinearProgressIndicator(
            progress = { bufferFraction },
            modifier = Modifier.matchParentSize(),
            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.85f),
            trackColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.25f),
        )
        LinearProgressIndicator(
            progress = { positionFraction },
            modifier = Modifier.matchParentSize(),
            color = MaterialTheme.colorScheme.primary,
            trackColor = MaterialTheme.colorScheme.primary.copy(alpha = 0f),
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun EmperyPlayerStatusChips(
    state: EmperyMediaPlaybackState,
    modifier: Modifier = Modifier,
) {
    val chips = buildList {
        if (state.playbackFromCache) {
            add(stringResource(R.string.empery_media_offline_ready))
        }
        if (state.hasQueue) {
            add(
                stringResource(
                    R.string.empery_media_queue_position,
                    state.queueIndex + 1,
                    state.queueSize,
                ),
            )
        }
        state.sleepTimerRemainingMs?.let { remainingMs ->
            add(
                stringResource(
                    R.string.empery_media_sleep_timer_remaining,
                    formatMediaTimeMs(remainingMs),
                ),
            )
        }
        if (state.playbackSpeed != 1f) {
            add(formatPlaybackSpeedLabel(state.playbackSpeed))
        }
        if (state.shuffleEnabled) {
            add(stringResource(R.string.empery_media_shuffle_on))
        }
        when (state.repeatMode) {
            EmperyQueueRepeatMode.ONE -> add(stringResource(R.string.empery_media_repeat_one))
            EmperyQueueRepeatMode.ALL -> add(stringResource(R.string.empery_media_repeat_all))
            EmperyQueueRepeatMode.OFF -> Unit
        }
    }
    if (chips.isEmpty()) return
    FlowRow(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        chips.forEach { label ->
            EmperyPlayerMetaChip(text = label, highlighted = true)
        }
    }
}

@Composable
fun EmperyPlayerMetaChip(
    text: String,
    modifier: Modifier = Modifier,
    highlighted: Boolean = false,
) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(999.dp),
        color =
            if (highlighted) {
                MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.72f)
            } else {
                MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = 0.82f)
            },
        border =
            BorderStroke(
                1.dp,
                if (highlighted) {
                    MaterialTheme.colorScheme.primary.copy(alpha = 0.35f)
                } else {
                    MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.45f)
                },
            ),
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Medium,
            color =
                if (highlighted) {
                    MaterialTheme.colorScheme.onPrimaryContainer
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                },
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
fun EmperyPlayerPrimaryButton(
    isPlaying: Boolean,
    isLoading: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    contentDescription: String,
    buttonSize: Dp = 64.dp,
    iconSize: Dp = 34.dp,
    loadingIndicatorSize: Dp = 28.dp,
) {
    val playIconSize = iconSize + 4.dp
    Surface(
        modifier =
            modifier
                .size(buttonSize)
                .semantics { this.contentDescription = contentDescription },
        shape = CircleShape,
        color = MaterialTheme.colorScheme.primary,
        shadowElevation = 8.dp,
        tonalElevation = 2.dp,
        onClick = onClick,
        enabled = !isLoading,
    ) {
        Box(contentAlignment = Alignment.Center) {
            when {
                isLoading ->
                    CircularProgressIndicator(
                        modifier = Modifier.size(loadingIndicatorSize),
                        strokeWidth = 2.5.dp,
                        color = MaterialTheme.colorScheme.onPrimary,
                    )
                isPlaying ->
                    Icon(
                        imageVector = Icons.Filled.Pause,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onPrimary,
                        modifier = Modifier.size(iconSize),
                    )
                else ->
                    Icon(
                        imageVector = Icons.Filled.PlayArrow,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onPrimary,
                        modifier = Modifier.size(playIconSize),
                    )
            }
        }
    }
}

@Composable
fun EmperyPlayerToolChip(
    label: String,
    icon: ImageVector?,
    active: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    contentDescription: String = label,
    iconOnly: Boolean = false,
) {
    Surface(
        modifier =
            modifier.semantics { this.contentDescription = contentDescription },
        onClick = onClick,
        enabled = enabled,
        shape = RoundedCornerShape(16.dp),
        color =
            if (active) {
                MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.78f)
            } else {
                MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = 0.88f)
            },
        border =
            BorderStroke(
                1.dp,
                if (active) {
                    MaterialTheme.colorScheme.primary.copy(alpha = 0.42f)
                } else {
                    MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.42f)
                },
            ),
    ) {
        if (iconOnly && icon != null) {
            Box(
                modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    modifier = Modifier.size(22.dp),
                    tint =
                        if (active) {
                            MaterialTheme.colorScheme.primary
                        } else {
                            MaterialTheme.colorScheme.onSurfaceVariant
                        },
                )
            }
        } else {
            Column(
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                if (icon != null) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp),
                        tint =
                            if (active) {
                                MaterialTheme.colorScheme.primary
                            } else {
                                MaterialTheme.colorScheme.onSurfaceVariant
                            },
                    )
                }
                Text(
                    text = label,
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = if (active) FontWeight.SemiBold else FontWeight.Medium,
                    color =
                        if (active) {
                            MaterialTheme.colorScheme.onPrimaryContainer
                        } else {
                            MaterialTheme.colorScheme.onSurfaceVariant
                        },
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}
