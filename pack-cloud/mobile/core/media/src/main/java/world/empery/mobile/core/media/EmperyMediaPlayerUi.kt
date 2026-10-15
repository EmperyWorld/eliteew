/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compact dock + full seek/transport controls for the in-app Empery media player.
 *
 * Invariants:
 * - Dock uses progress strip (no slider); expanded sheet uses seek slider + primary play.
 * - Dock chrome follows shell GLASS/PREMIUM/SYSTEM tokens when colors are passed from MainActivity.
 *
 * Related:
 * - EmperyPlayerChrome.kt, EmperyPlayerChromeScale.kt, EmperyExpandedPlayerSheet.kt, MainActivity bottomBar
 * - documentation/product/desktop/ELITEEW-AUDIO-PLAYER-AND-MUSIC-UI-FULL-SUMMARY-2026-05-31.md
 */
package world.empery.mobile.core.media

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.filled.FastForward
import androidx.compose.material.icons.filled.FastRewind
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import world.empery.mobile.core.ui.MobileSurfaceStyle
import world.empery.mobile.core.ui.PremiumDividerGlow
import world.empery.mobile.core.ui.PremiumRowSurface
import world.empery.mobile.core.ui.mobileMinimumTouchTarget

enum class EmperyPlayerControlsStyle {
    DOCK,
    EXPANDED,
}

@Composable
fun EmperyMiniAudioControls(
    state: EmperyMediaPlaybackState,
    onTogglePlayPause: () -> Unit,
    onSeek: (Long) -> Unit,
    onStop: () -> Unit,
    modifier: Modifier = Modifier,
    style: EmperyPlayerControlsStyle = EmperyPlayerControlsStyle.EXPANDED,
    showTitle: Boolean = true,
    showStop: Boolean = true,
    showArtwork: Boolean = false,
    onSkipPrevious: (() -> Unit)? = null,
    onSkipNext: (() -> Unit)? = null,
    onSkipBack: (() -> Unit)? = null,
    onSkipForward: (() -> Unit)? = null,
    onRetry: (() -> Unit)? = null,
    metrics: EmperyPlayerChromeMetrics = rememberEmperyPlayerChromeMetrics(),
) {
    val track = state.track ?: return
    val durationMs = state.durationMs.coerceAtLeast(0L)
    val positionMs = state.positionMs.coerceIn(0L, durationMs.takeIf { it > 0L } ?: Long.MAX_VALUE)
    val sliderEnabled = durationMs > 0L
    var sliderValue by remember(track.id, durationMs) {
        mutableFloatStateOf(
            if (durationMs > 0L) positionMs.toFloat() / durationMs.toFloat() else 0f,
        )
    }
    var isSeekDragging by remember(track.id) { mutableStateOf(false) }
    if (sliderEnabled && !isSeekDragging) {
        sliderValue = positionMs.toFloat() / durationMs.toFloat()
    }
    val displayedPositionMs =
        if (isSeekDragging && durationMs > 0L) {
            (sliderValue * durationMs).toLong()
        } else {
            positionMs
        }
    val playPauseCd =
        if (state.isPlaying) {
            stringResource(R.string.empery_media_pause_cd)
        } else {
            stringResource(R.string.empery_media_play_cd)
        }
    val seekCd = stringResource(R.string.empery_media_seek_cd)
    val stopCd = stringResource(R.string.empery_media_stop_cd)
    val skipBackCd = stringResource(R.string.empery_media_skip_back_cd)
    val skipForwardCd = stringResource(R.string.empery_media_skip_forward_cd)
    val skipPreviousCd = stringResource(R.string.empery_media_skip_previous_cd)
    val skipNextCd = stringResource(R.string.empery_media_skip_next_cd)
    val usePrimaryPlay = style == EmperyPlayerControlsStyle.EXPANDED

    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (showTitle) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (showArtwork) {
                    EmperyTrackArtwork(
                        track = track,
                        modifier = Modifier.size(metrics.dockArtworkSize),
                    )
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = track.title,
                        style = MaterialTheme.typography.labelLarge,
                        maxLines = metrics.dockTitleMaxLines,
                        overflow = TextOverflow.Ellipsis,
                        fontWeight = FontWeight.SemiBold,
                    )
                    if (metrics.dockSubtitleMaxLines > 0) {
                        track.subtitle?.takeIf { it.isNotBlank() }?.let { subtitle ->
                            Text(
                                text = subtitle,
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = metrics.dockSubtitleMaxLines,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                }
            }
            EmperyPlayerStatusChips(state = state)
        }
        state.errorMessage?.let { err ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    text = err.ifBlank { stringResource(R.string.empery_media_error) },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.weight(1f),
                )
                if (onRetry != null) {
                    TextButton(onClick = onRetry) {
                        Text(stringResource(R.string.empery_media_retry))
                    }
                }
            }
        }
        if (style == EmperyPlayerControlsStyle.EXPANDED) {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Box(modifier = Modifier.fillMaxWidth()) {
                    if (sliderEnabled && state.bufferedPositionMs > 0L) {
                        LinearProgressIndicator(
                            progress = {
                                (state.bufferedPositionMs.toFloat() / durationMs.toFloat()).coerceIn(0f, 1f)
                            },
                            modifier =
                                Modifier
                                    .fillMaxWidth()
                                    .height(4.dp)
                                    .align(Alignment.Center),
                            color = MaterialTheme.colorScheme.surfaceVariant,
                            trackColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f),
                        )
                    }
                    Slider(
                        value = sliderValue.coerceIn(0f, 1f),
                        onValueChange = { value ->
                            isSeekDragging = true
                            sliderValue = value
                        },
                        onValueChangeFinished = {
                            isSeekDragging = false
                            if (durationMs > 0L) {
                                onSeek((sliderValue * durationMs).toLong())
                            }
                        },
                        enabled = sliderEnabled && !state.isLoading,
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .semantics { contentDescription = seekCd },
                        colors =
                            SliderDefaults.colors(
                                thumbColor = MaterialTheme.colorScheme.primary,
                                activeTrackColor = MaterialTheme.colorScheme.primary,
                                inactiveTrackColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                            ),
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        text = formatMediaTimeMs(displayedPositionMs),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        text = formatMediaTimeMs(durationMs),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
        ) {
            if (onSkipBack != null) {
                IconButton(
                    onClick = onSkipBack,
                    enabled = !state.isLoading,
                    modifier = Modifier.semantics { contentDescription = skipBackCd },
                ) {
                    Icon(
                        imageVector = Icons.Filled.FastRewind,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            if (onSkipPrevious != null) {
                IconButton(
                    onClick = onSkipPrevious,
                    enabled = state.canSkipPrevious && !state.isLoading,
                    modifier = Modifier.semantics { contentDescription = skipPreviousCd },
                ) {
                    Icon(
                        imageVector = Icons.Filled.SkipPrevious,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(metrics.skipTransportIconSize),
                    )
                }
            }
            if (usePrimaryPlay) {
                EmperyPlayerPrimaryButton(
                    isPlaying = state.isPlaying,
                    isLoading = state.isLoading,
                    onClick = onTogglePlayPause,
                    contentDescription = playPauseCd,
                    modifier = Modifier.padding(horizontal = 8.dp),
                    buttonSize = metrics.primaryPlayButtonSize,
                    iconSize = metrics.primaryPlayIconSize,
                    loadingIndicatorSize = metrics.primaryPlayLoadingSize,
                )
            } else {
                IconButton(
                    onClick = onTogglePlayPause,
                    enabled = !state.isLoading,
                    modifier =
                        Modifier
                            .semantics { contentDescription = playPauseCd }
                            .mobileMinimumTouchTarget()
                            .size(metrics.miniPlayButtonSize),
                ) {
                    if (state.isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.padding(6.dp),
                            strokeWidth = 2.dp,
                        )
                    } else {
                        Icon(
                            imageVector =
                                if (state.isPlaying) {
                                    Icons.Filled.Pause
                                } else {
                                    Icons.Filled.PlayArrow
                                },
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(metrics.dockPlayIconSize),
                        )
                    }
                }
            }
            if (onSkipNext != null) {
                IconButton(
                    onClick = onSkipNext,
                    enabled = state.canSkipNext && !state.isLoading,
                    modifier = Modifier.semantics { contentDescription = skipNextCd },
                ) {
                    Icon(
                        imageVector = Icons.Filled.SkipNext,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(metrics.skipTransportIconSize),
                    )
                }
            }
            if (onSkipForward != null) {
                IconButton(
                    onClick = onSkipForward,
                    enabled = !state.isLoading,
                    modifier = Modifier.semantics { contentDescription = skipForwardCd },
                ) {
                    Icon(
                        imageVector = Icons.Filled.FastForward,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            if (showStop && style == EmperyPlayerControlsStyle.EXPANDED) {
                IconButton(
                    onClick = onStop,
                    modifier = Modifier.semantics { contentDescription = stopCd },
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Close,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(22.dp),
                    )
                }
            }
        }
        if (showStop && style != EmperyPlayerControlsStyle.EXPANDED) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
            ) {
                TextButton(
                    onClick = onStop,
                    modifier = Modifier.semantics { contentDescription = stopCd },
                ) {
                    Icon(
                        imageVector = Icons.Filled.Close,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp),
                    )
                    Text(
                        text = stringResource(R.string.empery_media_stop_cd),
                        modifier = Modifier.padding(start = 6.dp),
                    )
                }
            }
        }
    }
}

@Composable
fun EmperyNowPlayingDock(
    state: EmperyMediaPlaybackState,
    onTogglePlayPause: () -> Unit,
    onSeek: (Long) -> Unit,
    onStop: () -> Unit,
    modifier: Modifier = Modifier,
    onExpand: (() -> Unit)? = null,
    onSkipPrevious: (() -> Unit)? = null,
    onSkipNext: (() -> Unit)? = null,
    onRetry: (() -> Unit)? = null,
    surfaceStyle: MobileSurfaceStyle = MobileSurfaceStyle.SYSTEM,
    containerColor: Color? = null,
    borderColor: Color? = null,
) {
    if (!state.hasActiveTrack) return
    val track = state.track ?: return
    val metrics = rememberEmperyPlayerChromeMetrics()
    val scheme = MaterialTheme.colorScheme
    val resolvedContainer =
        containerColor
            ?: when (surfaceStyle) {
                MobileSurfaceStyle.GLASS -> scheme.surface.copy(alpha = 0.72f)
                MobileSurfaceStyle.PREMIUM -> scheme.surfaceContainer.copy(alpha = 0.94f)
                MobileSurfaceStyle.SYSTEM -> scheme.surfaceContainerHigh.copy(alpha = 0.97f)
            }
    val resolvedBorder =
        borderColor
            ?: when (surfaceStyle) {
                MobileSurfaceStyle.GLASS -> Color.White.copy(alpha = 0.42f)
                MobileSurfaceStyle.PREMIUM -> scheme.primary.copy(alpha = 0.38f)
                MobileSurfaceStyle.SYSTEM -> scheme.outlineVariant.copy(alpha = 0.32f)
            }
    val dockShadowElevation =
        when (surfaceStyle) {
            MobileSurfaceStyle.GLASS -> 6.dp
            MobileSurfaceStyle.PREMIUM -> 12.dp
            MobileSurfaceStyle.SYSTEM -> 10.dp
        }
    val expandCd = stringResource(R.string.empery_media_expand_cd)
    val playPauseCd =
        if (state.isPlaying) {
            stringResource(R.string.empery_media_pause_cd)
        } else {
            stringResource(R.string.empery_media_play_cd)
        }
    val skipPreviousCd = stringResource(R.string.empery_media_skip_previous_cd)
    val skipNextCd = stringResource(R.string.empery_media_skip_next_cd)
    val swipeHint = stringResource(R.string.empery_media_dock_swipe_hint)

    Surface(
        modifier =
            modifier
                .fillMaxWidth()
                .emperyDockSwipeToDismiss(onDismiss = onStop),
        tonalElevation = 4.dp,
        shadowElevation = dockShadowElevation,
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
        color = resolvedContainer,
        border = BorderStroke(1.dp, resolvedBorder),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(bottom = 6.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            PremiumDividerGlow()
            EmperyPlayerProgressStrip(
                state = state,
                modifier = Modifier.fillMaxWidth(),
                stripHeight = metrics.progressStripHeight,
            )
            EmperyPlayerDockDragHandle()
            if (metrics.showDockSwipeHint) {
                Text(
                    text = swipeHint,
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.78f),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
            }
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .then(
                            if (onExpand != null) {
                                Modifier
                                    .clickable(onClick = onExpand)
                                    .semantics { contentDescription = expandCd }
                            } else {
                                Modifier
                            },
                        )
                        .padding(horizontal = 14.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                EmperyTrackArtwork(
                    track = track,
                    modifier = Modifier.size(metrics.dockArtworkSize),
                    cornerRadius = 14.dp,
                )
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    Text(
                        text = track.title,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = metrics.dockTitleMaxLines,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (metrics.showDockSubtitle) {
                        track.subtitle?.takeIf { it.isNotBlank() }?.let { subtitle ->
                            Text(
                                text = subtitle,
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = metrics.dockSubtitleMaxLines,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                    if (metrics.showDockTimeLabel) {
                        EmperyPlayerDockTimeLabel(state = state)
                    }
                }
            }
            PremiumRowSurface(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp),
            ) {
                Box(modifier = Modifier.weight(1f))
                if (onSkipPrevious != null) {
                    IconButton(
                        onClick = onSkipPrevious,
                        enabled = state.canSkipPrevious && !state.isLoading,
                        modifier = Modifier.semantics { contentDescription = skipPreviousCd },
                    ) {
                        Icon(
                            imageVector = Icons.Filled.SkipPrevious,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                IconButton(
                    onClick = onTogglePlayPause,
                    enabled = !state.isLoading,
                    modifier =
                        Modifier
                            .semantics { contentDescription = playPauseCd }
                            .mobileMinimumTouchTarget()
                            .size(metrics.dockPlayButtonSize),
                ) {
                    if (state.isLoading) {
                        CircularProgressIndicator(
                            strokeWidth = 2.dp,
                            modifier = Modifier.size(metrics.dockPlayIconSize - 6.dp),
                        )
                    } else {
                        Icon(
                            imageVector =
                                if (state.isPlaying) {
                                    Icons.Filled.Pause
                                } else {
                                    Icons.Filled.PlayArrow
                                },
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(metrics.dockPlayIconSize),
                        )
                    }
                }
                if (onSkipNext != null) {
                    IconButton(
                        onClick = onSkipNext,
                        enabled = state.canSkipNext && !state.isLoading,
                        modifier = Modifier.semantics { contentDescription = skipNextCd },
                    ) {
                        Icon(
                            imageVector = Icons.Filled.SkipNext,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                Box(modifier = Modifier.weight(1f))
            }
            state.errorMessage?.let { err ->
                Row(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(
                        text = err.ifBlank { stringResource(R.string.empery_media_error) },
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.weight(1f),
                    )
                    if (onRetry != null) {
                        TextButton(onClick = onRetry) {
                            Text(stringResource(R.string.empery_media_retry))
                        }
                    }
                }
            }
        }
    }
}
