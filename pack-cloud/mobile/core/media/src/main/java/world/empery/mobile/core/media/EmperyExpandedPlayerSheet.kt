/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Full-screen bottom sheet player with two faces: player controls and scrollable track list.
 *
 * Invariants:
 * - List face scrolls independently; player face does not embed the queue below controls.
 * - Re-tapping the current queue row or favorite toggles play/pause.
 * - Favorites sync via desktop shell_state music_playlists (same playlist id as web player).
 *
 * Related:
 * - EmperyPlayerChrome.kt, EmperyPlayerChromeScale.kt, EmperyMediaPlayerUi.kt, EmperyPlayerTrackListActions.kt
 * - documentation/product/desktop/ELITEEW-AUDIO-PLAYER-AND-MUSIC-UI-FULL-SUMMARY-2026-05-31.md
 */
package world.empery.mobile.core.media

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.GraphicEq
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material.icons.filled.RepeatOne
import androidx.compose.material.icons.filled.Shuffle
import androidx.compose.material.icons.outlined.Bedtime
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.MusicNote
import androidx.compose.material.icons.outlined.QueueMusic
import androidx.compose.material.icons.outlined.Speed
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.SubcomposeAsyncImage
import world.empery.mobile.core.ui.PremiumRowSurface
import world.empery.mobile.core.ui.PremiumSectionCard
import world.empery.mobile.core.ui.mobileMinimumTouchTarget

private enum class ExpandedPlayerFace {
    Player,
    List,
}

private enum class ExpandedPlayerListTab {
    Queue,
    Favorites,
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun EmperyExpandedPlayerSheet(
    state: EmperyMediaPlaybackState,
    favoriteIds: Set<String>,
    favoriteTracks: List<EmperyMediaTrack>,
    favoritesLoading: Boolean,
    onDismiss: () -> Unit,
    onTogglePlayPause: () -> Unit,
    onSeek: (Long) -> Unit,
    onStop: () -> Unit,
    onSkipPrevious: () -> Unit,
    onSkipNext: () -> Unit,
    onSkipBack: () -> Unit,
    onSkipForward: () -> Unit,
    onRetry: () -> Unit,
    onToggleShuffle: () -> Unit,
    onToggleRepeat: () -> Unit,
    onCyclePlaybackSpeed: () -> Unit,
    onCycleSleepTimer: () -> Unit,
    onJumpToQueueIndex: (Int) -> Unit,
    onToggleFavorite: (String) -> Unit,
    onPlayFavoriteTrack: (EmperyMediaTrack) -> Unit,
) {
    if (!state.hasActiveTrack) {
        EmperyExpandedPlayerIdleSheet(
            favoriteTracks = favoriteTracks,
            favoritesLoading = favoritesLoading,
            onDismiss = onDismiss,
            onPlayFavoriteTrack = onPlayFavoriteTrack,
        )
        return
    }
    val track = state.track ?: return
    val hasQueue = state.queueTracks.size > 1
    val isFavorite = favoriteIds.contains(track.id)
    val hasQueueOrFavorites = hasQueue || favoriteTracks.isNotEmpty()
    val metrics = rememberEmperyPlayerChromeMetrics(hasQueueOrFavorites = hasQueueOrFavorites)
    var playerFace by remember(track.id) { mutableStateOf(ExpandedPlayerFace.Player) }
    var listTab by remember(hasQueue) {
        mutableStateOf(
            if (hasQueue) {
                ExpandedPlayerListTab.Queue
            } else {
                ExpandedPlayerListTab.Favorites
            },
        )
    }
    val heroHeight = metrics.expandedHeroHeight
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val shuffleCd = stringResource(R.string.empery_media_shuffle_cd)
    val repeatCd = stringResource(R.string.empery_media_repeat_cd)
    val speedCd = stringResource(R.string.empery_media_speed_cd)
    val sleepCd = stringResource(R.string.empery_media_sleep_timer_cd)
    val configuration = LocalConfiguration.current
    val sheetMaxHeight = (configuration.screenHeightDp * 0.88f).dp
    val listPaneHeight = (configuration.screenHeightDp * 0.52f).dp.coerceAtLeast(300.dp)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        dragHandle = { BottomSheetDefaults.DragHandle() },
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
                    .padding(bottom = 28.dp)
                    .heightIn(max = sheetMaxHeight),
        ) {
            EmperyPlayerFaceSwitcher(
                selected = playerFace,
                onSelect = { playerFace = it },
            )
            Spacer(Modifier.height(12.dp))
            AnimatedContent(
                targetState = playerFace,
                transitionSpec = { fadeIn() togetherWith fadeOut() },
                label = "expanded_player_face",
            ) { face ->
                when (face) {
                    ExpandedPlayerFace.Player -> {
                        Column(
                            modifier =
                                Modifier
                                    .fillMaxWidth()
                                    .verticalScroll(rememberScrollState()),
                            verticalArrangement = Arrangement.spacedBy(18.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Box(
                                modifier =
                                    Modifier
                                        .fillMaxWidth()
                                        .height(heroHeight),
                            ) {
                                EmperyPlayerArtworkHero(
                                    track = track,
                                    modifier = Modifier.fillMaxSize(),
                                ) {
                                    Surface(
                                        modifier = Modifier.size(metrics.expandedArtworkSize),
                                        shape = RoundedCornerShape(28.dp),
                                        shadowElevation = 12.dp,
                                        tonalElevation = 4.dp,
                                        color = MaterialTheme.colorScheme.surface.copy(alpha = 0.08f),
                                    ) {
                                        EmperyTrackArtwork(
                                            track = track,
                                            modifier = Modifier.fillMaxSize(),
                                            cornerRadius = 28.dp,
                                        )
                                    }
                                }
                            }
                            if (metrics.shouldStackChromeActions) {
                                Column(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.spacedBy(8.dp),
                                ) {
                                    Text(
                                        text = track.title,
                                        style = MaterialTheme.typography.headlineSmall,
                                        fontWeight = FontWeight.Bold,
                                        maxLines = metrics.expandedTitleMaxLines,
                                        overflow = TextOverflow.Ellipsis,
                                        textAlign = TextAlign.Center,
                                    )
                                    if (metrics.expandedSubtitleMaxLines > 0) {
                                        track.subtitle?.takeIf { it.isNotBlank() }?.let { subtitle ->
                                            Text(
                                                text = subtitle,
                                                style = MaterialTheme.typography.bodyMedium,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                                maxLines = metrics.expandedSubtitleMaxLines,
                                                overflow = TextOverflow.Ellipsis,
                                                textAlign = TextAlign.Center,
                                            )
                                        }
                                    }
                                    EmperyPlayerStatusChips(state = state)
                                    IconButton(
                                        onClick = { onToggleFavorite(track.id) },
                                        modifier = Modifier.mobileMinimumTouchTarget(),
                                    ) {
                                        Icon(
                                            imageVector =
                                                if (isFavorite) {
                                                    Icons.Filled.Favorite
                                                } else {
                                                    Icons.Outlined.FavoriteBorder
                                                },
                                            contentDescription =
                                                stringResource(
                                                    if (isFavorite) {
                                                        R.string.empery_media_remove_favorite_cd
                                                    } else {
                                                        R.string.empery_media_add_favorite_cd
                                                    },
                                                ),
                                            tint =
                                                if (isFavorite) {
                                                    MaterialTheme.colorScheme.primary
                                                } else {
                                                    MaterialTheme.colorScheme.onSurfaceVariant
                                                },
                                        )
                                    }
                                }
                            } else {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                                ) {
                                    Column(
                                        modifier = Modifier.weight(1f),
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                        verticalArrangement = Arrangement.spacedBy(6.dp),
                                    ) {
                                        Text(
                                            text = track.title,
                                            style = MaterialTheme.typography.headlineSmall,
                                            fontWeight = FontWeight.Bold,
                                            maxLines = metrics.expandedTitleMaxLines,
                                            overflow = TextOverflow.Ellipsis,
                                            textAlign = TextAlign.Center,
                                        )
                                        if (metrics.expandedSubtitleMaxLines > 0) {
                                            track.subtitle?.takeIf { it.isNotBlank() }?.let { subtitle ->
                                                Text(
                                                    text = subtitle,
                                                    style = MaterialTheme.typography.bodyMedium,
                                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                                    maxLines = metrics.expandedSubtitleMaxLines,
                                                    overflow = TextOverflow.Ellipsis,
                                                    textAlign = TextAlign.Center,
                                                )
                                            }
                                        }
                                        EmperyPlayerStatusChips(state = state)
                                    }
                                    IconButton(
                                        onClick = { onToggleFavorite(track.id) },
                                        modifier = Modifier.mobileMinimumTouchTarget(),
                                    ) {
                                        Icon(
                                            imageVector =
                                                if (isFavorite) {
                                                    Icons.Filled.Favorite
                                                } else {
                                                    Icons.Outlined.FavoriteBorder
                                                },
                                            contentDescription =
                                                stringResource(
                                                    if (isFavorite) {
                                                        R.string.empery_media_remove_favorite_cd
                                                    } else {
                                                        R.string.empery_media_add_favorite_cd
                                                    },
                                                ),
                                            tint =
                                                if (isFavorite) {
                                                    MaterialTheme.colorScheme.primary
                                                } else {
                                                    MaterialTheme.colorScheme.onSurfaceVariant
                                                },
                                        )
                                    }
                                }
                            }
                            EmperyMiniAudioControls(
                                state = state,
                                onTogglePlayPause = onTogglePlayPause,
                                onSeek = onSeek,
                                onStop = onStop,
                                style = EmperyPlayerControlsStyle.EXPANDED,
                                showTitle = false,
                                showStop = true,
                                onSkipPrevious = onSkipPrevious,
                                onSkipNext = onSkipNext,
                                onSkipBack = onSkipBack,
                                onSkipForward = onSkipForward,
                                onRetry = onRetry,
                                metrics = metrics,
                            )
                            PremiumSectionCard(
                                title = stringResource(R.string.empery_media_playback_tools_title),
                                subtitle = null,
                                icon = Icons.Outlined.Tune,
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                FlowRow(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    verticalArrangement = Arrangement.spacedBy(8.dp),
                                    maxItemsInEachRow =
                                        when {
                                            metrics.useIconOnlyToolChips && metrics.toolChipFullWidth -> 4
                                            metrics.toolChipFullWidth -> 1
                                            else -> 2
                                        },
                                ) {
                                    val chipModifier =
                                        when {
                                            metrics.useIconOnlyToolChips && metrics.toolChipFullWidth ->
                                                Modifier.fillMaxWidth(0.23f)
                                            metrics.toolChipFullWidth -> Modifier.fillMaxWidth(1f)
                                            else -> Modifier.fillMaxWidth(0.48f)
                                        }
                                    EmperyPlayerToolChip(
                                        label = stringResource(R.string.empery_media_tool_shuffle),
                                        icon = Icons.Filled.Shuffle,
                                        active = state.shuffleEnabled,
                                        onClick = onToggleShuffle,
                                        enabled = state.queueSize > 1,
                                        contentDescription = shuffleCd,
                                        iconOnly = metrics.useIconOnlyToolChips,
                                        modifier = chipModifier,
                                    )
                                    EmperyPlayerToolChip(
                                        label = formatPlaybackSpeedLabel(state.playbackSpeed),
                                        icon = Icons.Outlined.Speed,
                                        active = state.playbackSpeed != 1f,
                                        onClick = onCyclePlaybackSpeed,
                                        contentDescription = speedCd,
                                        iconOnly = metrics.useIconOnlyToolChips,
                                        modifier = chipModifier,
                                    )
                                    EmperyPlayerToolChip(
                                        label = formatSleepTimerLabel(state),
                                        icon = Icons.Outlined.Bedtime,
                                        active = state.sleepTimerRemainingMs != null,
                                        onClick = onCycleSleepTimer,
                                        contentDescription = sleepCd,
                                        iconOnly = metrics.useIconOnlyToolChips,
                                        modifier = chipModifier,
                                    )
                                    EmperyPlayerToolChip(
                                        label =
                                            when (state.repeatMode) {
                                                EmperyQueueRepeatMode.ONE -> stringResource(R.string.empery_media_repeat_one_short)
                                                EmperyQueueRepeatMode.ALL -> stringResource(R.string.empery_media_repeat_all_short)
                                                EmperyQueueRepeatMode.OFF -> stringResource(R.string.empery_media_tool_repeat)
                                            },
                                        icon =
                                            when (state.repeatMode) {
                                                EmperyQueueRepeatMode.ONE -> Icons.Filled.RepeatOne
                                                EmperyQueueRepeatMode.ALL,
                                                EmperyQueueRepeatMode.OFF,
                                                -> Icons.Filled.Repeat
                                            },
                                        active = state.repeatMode != EmperyQueueRepeatMode.OFF,
                                        onClick = onToggleRepeat,
                                        contentDescription = repeatCd,
                                        iconOnly = metrics.useIconOnlyToolChips,
                                        modifier = chipModifier,
                                    )
                                }
                            }
                        }
                    }

                    ExpandedPlayerFace.List -> {
                        PremiumSectionCard(
                            title = stringResource(R.string.empery_media_playback_list_title),
                            subtitle = null,
                            icon = Icons.Outlined.QueueMusic,
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Column(
                                modifier = Modifier.fillMaxWidth(),
                                verticalArrangement = Arrangement.spacedBy(10.dp),
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
                                ) {
                                    if (hasQueue) {
                                        FilterChip(
                                            selected = listTab == ExpandedPlayerListTab.Queue,
                                            onClick = { listTab = ExpandedPlayerListTab.Queue },
                                            label = { Text(stringResource(R.string.empery_media_queue_tab)) },
                                        )
                                    }
                                    FilterChip(
                                        selected = listTab == ExpandedPlayerListTab.Favorites,
                                        onClick = { listTab = ExpandedPlayerListTab.Favorites },
                                        label = { Text(stringResource(R.string.empery_media_favorites_tab)) },
                                    )
                                }
                                Box(
                                    modifier =
                                        Modifier
                                            .fillMaxWidth()
                                            .height(listPaneHeight),
                                ) {
                                    when (listTab) {
                                        ExpandedPlayerListTab.Queue -> {
                                            if (hasQueue) {
                                                LazyColumn(
                                                    modifier = Modifier.fillMaxSize(),
                                                    verticalArrangement = Arrangement.spacedBy(6.dp),
                                                ) {
                                                    item(key = "queue_header") {
                                                        Text(
                                                            text = stringResource(R.string.empery_media_queue_up_next),
                                                            modifier = Modifier.fillMaxWidth(),
                                                            style = MaterialTheme.typography.titleSmall,
                                                            fontWeight = FontWeight.SemiBold,
                                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                                        )
                                                    }
                                                    itemsIndexed(
                                                        state.queueTracks,
                                                        key = { _, item -> "queue-${item.id}" },
                                                    ) { index, queueTrack ->
                                                        EmperyQueueTrackRow(
                                                            track = queueTrack,
                                                            index = index,
                                                            isCurrent = index == state.queueIndex,
                                                            isOfflineCached = EmperyMediaStreamCache.isCached(queueTrack.id),
                                                            onClick = {
                                                                dispatchPlayerTrackTap(
                                                                    action = resolveQueueTrackTap(index, state.queueIndex),
                                                                    queueIndex = index,
                                                                    favoriteTrack = queueTrack,
                                                                    onTogglePlayPause = onTogglePlayPause,
                                                                    onJumpToQueueIndex = onJumpToQueueIndex,
                                                                    onPlayFavoriteTrack = onPlayFavoriteTrack,
                                                                )
                                                            },
                                                        )
                                                    }
                                                }
                                            }
                                        }

                                        ExpandedPlayerListTab.Favorites -> {
                                            EmperyPlayerFavoritesListPane(
                                                favoriteTracks = favoriteTracks,
                                                favoritesLoading = favoritesLoading,
                                                currentTrackId = track.id,
                                                emptyTextRes = R.string.empery_media_favorites_empty,
                                                onTogglePlayPause = onTogglePlayPause,
                                                onPlayFavoriteTrack = onPlayFavoriteTrack,
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EmperyExpandedPlayerIdleSheet(
    favoriteTracks: List<EmperyMediaTrack>,
    favoritesLoading: Boolean,
    onDismiss: () -> Unit,
    onPlayFavoriteTrack: (EmperyMediaTrack) -> Unit,
) {
    var playerFace by remember { mutableStateOf(ExpandedPlayerFace.Player) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val configuration = LocalConfiguration.current
    val sheetMaxHeight = (configuration.screenHeightDp * 0.88f).dp
    val listPaneHeight = (configuration.screenHeightDp * 0.52f).dp.coerceAtLeast(300.dp)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        dragHandle = { BottomSheetDefaults.DragHandle() },
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
                    .padding(bottom = 28.dp)
                    .heightIn(max = sheetMaxHeight),
        ) {
            EmperyPlayerFaceSwitcher(
                selected = playerFace,
                onSelect = { playerFace = it },
            )
            Spacer(Modifier.height(12.dp))
            AnimatedContent(
                targetState = playerFace,
                transitionSpec = { fadeIn() togetherWith fadeOut() },
                label = "expanded_player_idle_face",
            ) { face ->
                when (face) {
                    ExpandedPlayerFace.Player -> {
                        PremiumSectionCard(
                            title = stringResource(R.string.empery_media_idle_title),
                            subtitle = stringResource(R.string.empery_media_idle_hint),
                            icon = Icons.Filled.MusicNote,
                            modifier = Modifier.fillMaxWidth(),
                        ) {}
                    }

                    ExpandedPlayerFace.List -> {
                        PremiumSectionCard(
                            title = stringResource(R.string.empery_media_playback_list_title),
                            subtitle = null,
                            icon = Icons.Outlined.QueueMusic,
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Box(
                                modifier =
                                    Modifier
                                        .fillMaxWidth()
                                        .height(listPaneHeight),
                            ) {
                                EmperyPlayerFavoritesListPane(
                                    favoriteTracks = favoriteTracks,
                                    favoritesLoading = favoritesLoading,
                                    currentTrackId = null,
                                    emptyTextRes = R.string.empery_media_idle_favorites_empty,
                                    onTogglePlayPause = {},
                                    onPlayFavoriteTrack = onPlayFavoriteTrack,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun EmperyPlayerFaceSwitcher(
    selected: ExpandedPlayerFace,
    onSelect: (ExpandedPlayerFace) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
    ) {
        FilterChip(
            selected = selected == ExpandedPlayerFace.Player,
            onClick = { onSelect(ExpandedPlayerFace.Player) },
            label = { Text(stringResource(R.string.empery_media_player_face_tab)) },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Outlined.MusicNote,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                )
            },
        )
        FilterChip(
            selected = selected == ExpandedPlayerFace.List,
            onClick = { onSelect(ExpandedPlayerFace.List) },
            label = { Text(stringResource(R.string.empery_media_list_face_tab)) },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Outlined.QueueMusic,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                )
            },
        )
    }
}

@Composable
private fun EmperyPlayerFavoritesListPane(
    favoriteTracks: List<EmperyMediaTrack>,
    favoritesLoading: Boolean,
    currentTrackId: String?,
    emptyTextRes: Int,
    onTogglePlayPause: () -> Unit,
    onPlayFavoriteTrack: (EmperyMediaTrack) -> Unit,
) {
    when {
        favoritesLoading && favoriteTracks.isEmpty() -> {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = stringResource(R.string.empery_media_favorites_loading),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                )
            }
        }

        favoriteTracks.isEmpty() -> {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = stringResource(emptyTextRes),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                )
            }
        }

        else -> {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                itemsIndexed(favoriteTracks, key = { _, item -> "fav-${item.id}" }) { index, favoriteTrack ->
                    EmperyQueueTrackRow(
                        track = favoriteTrack,
                        index = index,
                        isCurrent = favoriteTrack.id == currentTrackId,
                        isOfflineCached = EmperyMediaStreamCache.isCached(favoriteTrack.id),
                        onClick = {
                            dispatchPlayerTrackTap(
                                action = resolveFavoriteTrackTap(favoriteTrack.id, currentTrackId),
                                queueIndex = 0,
                                favoriteTrack = favoriteTrack,
                                onTogglePlayPause = onTogglePlayPause,
                                onJumpToQueueIndex = {},
                                onPlayFavoriteTrack = onPlayFavoriteTrack,
                            )
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun EmperyQueueTrackRow(
    track: EmperyMediaTrack,
    index: Int,
    isCurrent: Boolean,
    isOfflineCached: Boolean,
    onClick: () -> Unit,
) {
    PremiumRowSurface(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick),
        containerColor =
            if (isCurrent) {
                MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.62f)
            } else {
                null
            },
        tonalElevation = if (isCurrent) 2.dp else null,
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (isCurrent) {
                Icon(
                    imageVector = Icons.Filled.GraphicEq,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(22.dp),
                )
            } else {
                Text(
                    text = "${index + 1}",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(22.dp),
                )
            }
            EmperyTrackArtwork(
                track = track,
                modifier = Modifier.size(44.dp),
                cornerRadius = 12.dp,
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = track.title,
                    style = MaterialTheme.typography.bodyMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    fontWeight = if (isCurrent) FontWeight.SemiBold else FontWeight.Normal,
                )
                track.subtitle?.takeIf { it.isNotBlank() }?.let { subtitle ->
                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                if (isOfflineCached) {
                    EmperyPlayerMetaChip(
                        text = stringResource(R.string.empery_media_offline_ready),
                        highlighted = true,
                    )
                }
            }
        }
    }
}

@Composable
fun EmperyTrackArtwork(
    track: EmperyMediaTrack,
    modifier: Modifier = Modifier,
    cornerRadius: androidx.compose.ui.unit.Dp = 20.dp,
) {
    val shape = RoundedCornerShape(cornerRadius)
    val artworkUrl = track.artworkUrl?.trim()?.takeIf { it.isNotEmpty() }
    Box(
        modifier =
            modifier
                .clip(shape)
                .background(MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.55f)),
        contentAlignment = Alignment.Center,
    ) {
        if (artworkUrl != null) {
            SubcomposeAsyncImage(
                model = artworkUrl,
                contentDescription = track.title,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
                loading = {
                    Icon(
                        imageVector = Icons.Filled.MusicNote,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(24.dp),
                    )
                },
                error = {
                    Icon(
                        imageVector = Icons.Filled.MusicNote,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(24.dp),
                    )
                },
            )
        } else {
            Icon(
                imageVector = Icons.Filled.MusicNote,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(24.dp),
            )
        }
    }
}

internal fun formatPlaybackSpeedLabel(speed: Float): String =
    when (speed) {
        1f -> "1×"
        0.75f -> "0.75×"
        1.25f -> "1.25×"
        1.5f -> "1.5×"
        else -> "${speed}×"
    }

@Composable
internal fun formatSleepTimerLabel(state: EmperyMediaPlaybackState): String {
    state.sleepTimerRemainingMs?.let { remainingMs ->
        return formatMediaTimeMs(remainingMs)
    }
    return when (state.sleepTimerMinutes) {
        EmperySleepTimerMinutes.OFF ->
            stringResource(R.string.empery_media_sleep_timer_off)
        EmperySleepTimerMinutes.MIN_15 ->
            stringResource(R.string.empery_media_sleep_timer_minutes, 15)
        EmperySleepTimerMinutes.MIN_30 ->
            stringResource(R.string.empery_media_sleep_timer_minutes, 30)
        EmperySleepTimerMinutes.MIN_60 ->
            stringResource(R.string.empery_media_sleep_timer_minutes, 60)
    }
}
