/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Polished composables for the UGS Songs screen (create form chips, list rows, action sheet).
 *
 * Invariants:
 * - Visual-only helpers; playback/download/delete callbacks stay in UgsSongsScreen.
 *
 * Related:
 * - UgsSongsScreen.kt, MobileContentLibraryScreen.kt, UgsAiUi.kt
 */
package feature.ugs

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.outlined.AutoFixHigh
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.LibraryMusic
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.SubcomposeAsyncImage
import world.empery.mobile.core.media.EmperyMediaPlayerHolder
import world.empery.mobile.core.network.api.UnifiedContentDto
import world.empery.mobile.core.ui.MobileUiScale
import world.empery.mobile.core.ui.PremiumBadge
import world.empery.mobile.core.ui.PremiumMetricPill
import world.empery.mobile.core.ui.PremiumRowSurface
import world.empery.mobile.core.ui.ScaledOutlinedButton
import world.empery.mobile.core.ui.rememberMobileScaleChromePolicy

@Composable
internal fun UgsSongsScreenTabs(
    selectedTabIndex: Int,
    onTabSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val tabCreate = stringResource(R.string.ugs_songs_tab_create)
    val tabLibrary = stringResource(R.string.ugs_songs_tab_library)
    val tabs = listOf(tabCreate, tabLibrary)
    SingleChoiceSegmentedButtonRow(modifier = modifier.fillMaxWidth()) {
        tabs.forEachIndexed { index, label ->
            SegmentedButton(
                selected = selectedTabIndex == index,
                onClick = { onTabSelect(index) },
                shape = SegmentedButtonDefaults.itemShape(index = index, count = tabs.size),
            ) {
                Text(label, style = MaterialTheme.typography.labelLarge)
            }
        }
    }
}

@Composable
internal fun UgsSongsChipHeading(
    text: String,
    modifier: Modifier = Modifier,
) {
    Text(
        text = text,
        modifier = modifier,
        style = MaterialTheme.typography.labelLarge,
        fontWeight = FontWeight.SemiBold,
        color = MaterialTheme.colorScheme.primary,
    )
}

@Composable
private fun ugsSongsChipLabelStyle(): TextStyle {
    val chrome = rememberMobileScaleChromePolicy()
    return when {
        chrome.shouldStackChromeActions -> MaterialTheme.typography.labelMedium
        chrome.uiScale == MobileUiScale.COMFORT -> MaterialTheme.typography.labelMedium
        else -> MaterialTheme.typography.labelSmall
    }
}

@Composable
internal fun UgsSongsGenrePicker(
    presets: List<GenreQuickPreset>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val chrome = rememberMobileScaleChromePolicy()
    val chipLabelStyle = ugsSongsChipLabelStyle()
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(if (chrome.uiScale == MobileUiScale.COMFORT) 10.dp else 8.dp),
    ) {
        UgsSongsChipHeading(text = stringResource(R.string.ugs_songs_genre_label))
        if (!chrome.shouldStackChromeActions && presets.indices.contains(selectedIndex)) {
            PremiumMetricPill(
                label = stringResource(R.string.ugs_songs_genre_selected_label),
                value = presets[selectedIndex].label,
                icon = Icons.Outlined.LibraryMusic,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        LazyRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            itemsIndexed(presets) { index, preset ->
                FilterChip(
                    selected = selectedIndex == index,
                    onClick = { onSelect(index) },
                    label = {
                        Text(
                            preset.label,
                            style = chipLabelStyle,
                            maxLines = if (chrome.uiScale == MobileUiScale.COMFORT) 2 else 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    },
                )
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun UgsSongsOptionChips(
    heading: String,
    options: List<Pair<String, String>>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
    useWrappedLayout: Boolean,
    modifier: Modifier = Modifier,
) {
    val chrome = rememberMobileScaleChromePolicy()
    val chipLabelStyle = ugsSongsChipLabelStyle()
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(if (chrome.uiScale == MobileUiScale.COMFORT) 10.dp else 8.dp),
    ) {
        UgsSongsChipHeading(text = heading)
        val chip: @Composable (Int, Pair<String, String>) -> Unit = { index, pair ->
            FilterChip(
                selected = selectedIndex == index,
                onClick = { onSelect(index) },
                label = {
                    Text(
                        pair.second,
                        style = chipLabelStyle,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                },
            )
        }
        if (useWrappedLayout) {
            FlowRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                options.forEachIndexed { index, pair -> chip(index, pair) }
            }
        } else {
            LazyRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                itemsIndexed(options) { index, pair -> chip(index, pair) }
            }
        }
    }
}

@Composable
internal fun UgsSongListArtwork(
    song: UnifiedContentDto,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(12.dp)
    val artworkUrl = contentListThumbnailUrl(song)
    Box(
        modifier =
            modifier
                .size(52.dp)
                .clip(shape)
                .background(MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.55f)),
        contentAlignment = Alignment.Center,
    ) {
        if (artworkUrl == null) {
            Icon(
                imageVector = Icons.Filled.MusicNote,
                contentDescription = song.name,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(22.dp),
            )
        } else {
            SubcomposeAsyncImage(
                model = artworkUrl,
                contentDescription = song.name,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
                loading = {
                    Icon(
                        imageVector = Icons.Filled.MusicNote,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(22.dp),
                    )
                },
                error = {
                    Icon(
                        imageVector = Icons.Filled.MusicNote,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(22.dp),
                    )
                },
            )
        }
    }
}

@Composable
internal fun UgsSongHistoryRow(
    song: UnifiedContentDto,
    isCurrentTrack: Boolean,
    isPlaying: Boolean,
    isOfflineCached: Boolean,
    isBusy: Boolean,
    onPrimaryClick: () -> Unit,
    onMoreClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val chrome = rememberMobileScaleChromePolicy()
    PremiumRowSurface(
        modifier =
            modifier
                .fillMaxWidth()
                .clickable(enabled = !isBusy, onClick = onPrimaryClick),
        containerColor =
            if (isCurrentTrack) {
                MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.48f)
            } else {
                null
            },
        tonalElevation = if (isCurrentTrack) 2.dp else null,
    ) {
        if (isBusy) {
            Box(
                modifier = Modifier.size(52.dp),
                contentAlignment = Alignment.Center,
            ) {
                CircularProgressIndicator(modifier = Modifier.size(22.dp), strokeWidth = 2.dp)
            }
        } else {
            UgsSongListArtwork(song = song)
        }
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(
                text = songDisplayName(context, song),
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                maxLines = chrome.maxHeroTitleLines.coerceAtLeast(2),
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = formatSongMetaLabel(context, song),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = chrome.maxBodyPreviewLines.coerceAtMost(2),
                overflow = TextOverflow.Ellipsis,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                if (isCurrentTrack && isPlaying) {
                    PremiumBadge(text = stringResource(R.string.ugs_songs_now_playing))
                } else if (isCurrentTrack) {
                    PremiumBadge(text = stringResource(R.string.ugs_songs_paused_badge))
                }
                if (isOfflineCached) {
                    PremiumBadge(text = stringResource(R.string.ugs_songs_offline_cached))
                }
            }
        }
        Icon(
            imageVector =
                if (isCurrentTrack && isPlaying) {
                    Icons.Filled.Pause
                } else {
                    Icons.Filled.PlayArrow
                },
            contentDescription =
                if (isPlaying) {
                    stringResource(R.string.ugs_songs_pause)
                } else {
                    stringResource(R.string.ugs_songs_play)
                },
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(24.dp),
        )
        IconButton(onClick = onMoreClick, enabled = !isBusy) {
            Icon(
                imageVector = Icons.Outlined.ChevronRight,
                contentDescription = stringResource(R.string.ugs_songs_row_more_cd),
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun UgsSongActionsSheet(
    visible: Boolean,
    song: UnifiedContentDto?,
    isPlaying: Boolean,
    isCurrentTrack: Boolean,
    isDownloadBusy: Boolean,
    isRewriteBusy: Boolean = false,
    canRewriteLyrics: Boolean = false,
    onDismiss: () -> Unit,
    onTogglePlayPause: () -> Unit,
    onDownload: () -> Unit,
    onRewriteLyrics: () -> Unit = {},
    onDeleteRequest: () -> Unit,
) {
    if (!visible || song == null) return
    val context = LocalContext.current
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
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
                    .padding(bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = songDisplayName(context, song),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = formatSongMetaLabel(context, song),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            ScaledOutlinedButton(
                onClick = {
                    onTogglePlayPause()
                    onDismiss()
                },
                enabled = true,
                label =
                    if (isCurrentTrack && isPlaying) {
                        stringResource(R.string.ugs_songs_pause)
                    } else {
                        stringResource(R.string.ugs_songs_play)
                    },
                icon =
                    if (isCurrentTrack && isPlaying) {
                        Icons.Filled.Pause
                    } else {
                        Icons.Filled.PlayArrow
                    },
                modifier = Modifier.fillMaxWidth(),
            )
            ScaledOutlinedButton(
                onClick = onDownload,
                enabled = !isDownloadBusy && !isRewriteBusy,
                label = stringResource(R.string.ugs_songs_download),
                icon = Icons.Outlined.Download,
                modifier = Modifier.fillMaxWidth(),
            )
            if (canRewriteLyrics) {
                ScaledOutlinedButton(
                    onClick = {
                        onRewriteLyrics()
                    },
                    enabled = !isDownloadBusy && !isRewriteBusy,
                    label = stringResource(R.string.ugs_songs_rewrite_lyrics),
                    icon = Icons.Outlined.AutoFixHigh,
                    modifier = Modifier.fillMaxWidth(),
                )
                Text(
                    text = stringResource(R.string.ugs_songs_rewrite_lyrics_hint),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (isDownloadBusy || isRewriteBusy) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                    Text(
                        text =
                            if (isRewriteBusy) {
                                stringResource(R.string.ugs_songs_rewriting)
                            } else {
                                stringResource(R.string.ugs_songs_downloading)
                            },
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            ScaledOutlinedButton(
                onClick = {
                    onDeleteRequest()
                    onDismiss()
                },
                enabled = !isDownloadBusy && !isRewriteBusy,
                label = stringResource(R.string.ugs_songs_delete),
                icon = Icons.Outlined.Delete,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
internal fun UgsSongDeleteDialog(
    visible: Boolean,
    songTitle: String,
    isDeleting: Boolean,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    if (!visible) return
    AlertDialog(
        onDismissRequest = { if (!isDeleting) onDismiss() },
        title = { Text(stringResource(R.string.ugs_songs_delete_confirm)) },
        text = { Text(songTitle) },
        confirmButton = {
            TextButton(onClick = onConfirm, enabled = !isDeleting) {
                if (isDeleting) {
                    CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                } else {
                    Text(stringResource(R.string.ugs_songs_delete_confirm_yes))
                }
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !isDeleting) {
                Text(stringResource(R.string.ugs_songs_delete_confirm_no))
            }
        },
    )
}
