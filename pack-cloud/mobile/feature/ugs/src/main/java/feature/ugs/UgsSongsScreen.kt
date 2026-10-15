/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Native UGS song generator and recent song history for the Android client.
 *
 * Invariants:
 * - Song generation is MusicForge thin client (`/api/v1/music-forge/` runs); optional mode_key from capabilities.
 * - Song play streams via shared Empery media player; downloads stay authenticated Retrofit → Downloads.
 *
 * Related:
 * - UgsHubRepository, UgsSongsUi.kt, MusicForgeMobileSupport.kt
 * - documentation/product/MUSIC-FORGE-APP.md
 */
package feature.ugs

import android.content.Context
import android.widget.Toast
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.LibraryMusic
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import world.empery.mobile.core.media.EmperyMediaPlayerHolder
import world.empery.mobile.core.media.EmperyMediaTrack
import world.empery.mobile.core.network.api.MusicForgeModeCapability
import world.empery.mobile.core.network.api.UnifiedContentDto
import world.empery.mobile.core.network.api.listAllContent
import world.empery.mobile.core.ui.LocalMobilePermissionRequester
import world.empery.mobile.core.ui.MobileUiScale
import world.empery.mobile.core.ui.PremiumBadge
import world.empery.mobile.core.ui.PremiumDividerGlow
import world.empery.mobile.core.ui.PremiumLoadingCard
import world.empery.mobile.core.ui.PremiumMetricPill
import world.empery.mobile.core.ui.PremiumSectionCard
import world.empery.mobile.core.ui.PremiumStateCard
import world.empery.mobile.core.ui.ScaledOutlinedButton
import world.empery.mobile.core.ui.rememberMobileScaleChromePolicy

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UgsSongsScreen(
    repository: UgsHubRepository,
    onBack: () -> Unit,
    onOpenContentLibrary: (() -> Unit)? = null,
) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val permissionRequester = LocalMobilePermissionRequester.current
    val listState = rememberLazyListState()
    val chrome = rememberMobileScaleChromePolicy()
    val formSpacing = if (chrome.uiScale == MobileUiScale.COMFORT) 16.dp else 14.dp

    var selectedTabIndex by remember { mutableIntStateOf(0) }
    var topic by remember { mutableStateOf("") }

    val styles = remember { UgsSongGenrePresets.ugsV2 }
    var selectedStyleIndex by remember { mutableIntStateOf(0) }

    val languages =
        listOf(
            "ru" to stringResource(R.string.ugs_songs_lang_ru),
            "en" to stringResource(R.string.ugs_songs_lang_en),
            "es" to stringResource(R.string.ugs_songs_lang_es),
            "fr" to stringResource(R.string.ugs_songs_lang_fr),
        )
    var selectedLanguageIndex by remember { mutableIntStateOf(0) }

    val vocals =
        listOf(
            "male" to stringResource(R.string.ugs_songs_vocal_male),
            "female" to stringResource(R.string.ugs_songs_vocal_female),
            "duet" to stringResource(R.string.ugs_songs_vocal_duet),
        )
    var selectedVocalIndex by remember { mutableIntStateOf(0) }

    var forgeModes by remember { mutableStateOf<List<MusicForgeModeCapability>>(emptyList()) }
    var selectedModeIndex by remember { mutableIntStateOf(0) }
    var forgeModesLoadError by remember { mutableStateOf<String?>(null) }
    var tasteLikeCount by remember { mutableIntStateOf(0) }
    var showSoundSettings by remember { mutableStateOf(false) }

    var isSubmitting by remember { mutableStateOf(false) }
    var submitError by remember { mutableStateOf<String?>(null) }
    var topicError by remember { mutableStateOf<String?>(null) }

    var songs by remember { mutableStateOf<List<UnifiedContentDto>>(emptyList()) }
    var songsTotal by remember { mutableIntStateOf(0) }
    var isSongsLoading by remember { mutableStateOf(true) }
    var songsError by remember { mutableStateOf<String?>(null) }

    var downloadingSongId by remember { mutableStateOf<String?>(null) }
    var rewritingSongId by remember { mutableStateOf<String?>(null) }
    var deletingSongId by remember { mutableStateOf<String?>(null) }
    var selectedSongForActions by remember { mutableStateOf<UnifiedContentDto?>(null) }
    var songPendingDelete by remember { mutableStateOf<UnifiedContentDto?>(null) }

    val mediaPlaybackState by EmperyMediaPlayerHolder.controller.state.collectAsStateWithLifecycle()
    val cachedSongIds by EmperyMediaPlayerHolder.cachedContentIds.collectAsStateWithLifecycle()

    val fieldShape = RoundedCornerShape(18.dp)
    val fieldColors =
        OutlinedTextFieldDefaults.colors(
            focusedBorderColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.45f),
            unfocusedBorderColor = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f),
        )

    fun loadCapabilities() {
        scope.launch {
            forgeModesLoadError = null
            try {
                val caps =
                    withContext(Dispatchers.IO) {
                        repository.musicForgeApi.getCapabilities()
                    }
                forgeModes = caps.modes
                tasteLikeCount = musicForgeTasteLikeCount(caps.taste_profile_like_count)
                selectedModeIndex =
                    resolveMusicForgeModeIndex(caps.modes, caps.default_mode_key)
            } catch (e: Exception) {
                forgeModes = emptyList()
                tasteLikeCount = 0
                forgeModesLoadError =
                    e.message ?: context.getString(R.string.ugs_songs_modes_load_error)
            }
        }
    }

    fun loadSongs() {
        scope.launch {
            isSongsLoading = true
            songsError = null
            try {
                val loaded =
                    withContext(Dispatchers.IO) {
                        coroutineScope {
                            val forge =
                                async {
                                    repository.contentApi.listAllContent(
                                        sourceService = "music_forge",
                                        listProfile = "full",
                                        pageSize = 50,
                                        maxItems = 200,
                                    )
                                }
                            val legacy =
                                async {
                                    repository.contentApi.listAllContent(
                                        sourceService = "music_generator",
                                        pageSize = 50,
                                        maxItems = 200,
                                    )
                                }
                            mergeSongHistory(forge.await(), legacy.await(), maxItems = 200)
                        }
                    }
                songs = loaded
                songsTotal = loaded.size
            } catch (e: Exception) {
                songsError = e.message ?: context.getString(R.string.ugs_songs_load_error)
            } finally {
                isSongsLoading = false
            }
        }
    }

    fun playSong(song: UnifiedContentDto) {
        try {
            val tracks = songs.map { item -> item.toSongMediaTrack(context) }
            val startIndex = songs.indexOfFirst { it.id == song.id }.coerceAtLeast(0)
            EmperyMediaPlayerHolder.controller.playQueue(tracks, startIndex)
        } catch (e: Exception) {
            Toast.makeText(
                context,
                e.message ?: context.getString(R.string.ugs_songs_open_error),
                Toast.LENGTH_SHORT,
            ).show()
        }
    }

    fun onSongPrimaryTap(song: UnifiedContentDto) {
        val isCurrentTrack = mediaPlaybackState.track?.id == song.id
        if (isCurrentTrack) {
            EmperyMediaPlayerHolder.controller.togglePlayPause()
        } else {
            playSong(song)
        }
    }

    LaunchedEffect(Unit) {
        loadCapabilities()
        loadSongs()
    }

    UgsSongActionsSheet(
        visible = selectedSongForActions != null,
        song = selectedSongForActions,
        isPlaying =
            selectedSongForActions?.id == mediaPlaybackState.track?.id &&
                mediaPlaybackState.isPlaying,
        isCurrentTrack = selectedSongForActions?.id == mediaPlaybackState.track?.id,
        isDownloadBusy = downloadingSongId == selectedSongForActions?.id,
        isRewriteBusy = rewritingSongId == selectedSongForActions?.id,
        canRewriteLyrics =
            selectedSongForActions?.let { song ->
                musicForgeRunIdFromMetadata(song.metadata) != null
            } == true,
        onDismiss = { selectedSongForActions = null },
        onTogglePlayPause = {
            selectedSongForActions?.let { onSongPrimaryTap(it) }
        },
        onDownload = {
            val song = selectedSongForActions ?: return@UgsSongActionsSheet
            scope.launch {
                if (!requestStoragePermissionsIfNeeded(context, permissionRequester)) {
                    Toast.makeText(
                        context,
                        context.getString(R.string.ugs_download_permissions_needed),
                        Toast.LENGTH_LONG,
                    ).show()
                    return@launch
                }
                downloadingSongId = song.id
                try {
                    repository.downloadSongToDownloads(context, song.id, songDownloadFileName(song))
                    Toast.makeText(
                        context,
                        context.getString(R.string.ugs_songs_downloaded),
                        Toast.LENGTH_SHORT,
                    ).show()
                } catch (e: Exception) {
                    Toast.makeText(
                        context,
                        e.message ?: context.getString(R.string.ugs_download_open_file_error),
                        Toast.LENGTH_SHORT,
                    ).show()
                } finally {
                    downloadingSongId = null
                }
            }
        },
        onRewriteLyrics = {
            val song = selectedSongForActions ?: return@UgsSongActionsSheet
            val sourceRunId = musicForgeRunIdFromMetadata(song.metadata) ?: return@UgsSongActionsSheet
            scope.launch {
                rewritingSongId = song.id
                selectedSongForActions = null
                try {
                    withContext(Dispatchers.IO) {
                        runMusicForgeLyricsRewrite(
                            api = repository.musicForgeApi,
                            sourceRunId = sourceRunId,
                        )
                    }
                    Toast.makeText(
                        context,
                        context.getString(R.string.ugs_songs_rewrite_started),
                        Toast.LENGTH_SHORT,
                    ).show()
                    selectedTabIndex = 1
                    loadSongs()
                } catch (e: Exception) {
                    Toast.makeText(
                        context,
                        e.message ?: context.getString(R.string.ugs_submit_error),
                        Toast.LENGTH_LONG,
                    ).show()
                } finally {
                    rewritingSongId = null
                }
            }
        },
        onDeleteRequest = { songPendingDelete = selectedSongForActions },
    )

    UgsSongDeleteDialog(
        visible = songPendingDelete != null,
        songTitle =
            songPendingDelete?.let { songDisplayName(context, it) }
                ?: "",
        isDeleting = deletingSongId == songPendingDelete?.id,
        onConfirm = {
            val song = songPendingDelete ?: return@UgsSongDeleteDialog
            scope.launch {
                deletingSongId = song.id
                try {
                    repository.contentApi.deleteContent(song.id)
                    loadSongs()
                    songPendingDelete = null
                } catch (e: Exception) {
                    Toast.makeText(
                        context,
                        e.message ?: context.getString(R.string.ugs_songs_delete_error),
                        Toast.LENGTH_SHORT,
                    ).show()
                } finally {
                    deletingSongId = null
                }
            }
        },
        onDismiss = {
            if (deletingSongId == null) {
                songPendingDelete = null
            }
        },
    )

    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            UgsAiSubScreenTopBar(
                title = stringResource(R.string.ugs_songs_screen_title),
                subtitle = stringResource(R.string.ugs_songs_top_subtitle),
                onBack = onBack,
                isRefreshing = isSongsLoading,
                onRefresh = { loadSongs() },
                refreshContentDescription = stringResource(R.string.ugs_songs_refresh),
            )
        },
    ) { padding ->
        LazyColumn(
            state = listState,
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item { Spacer(modifier = Modifier.height(8.dp)) }
            item {
                UgsSongsScreenTabs(
                    selectedTabIndex = selectedTabIndex,
                    onTabSelect = { selectedTabIndex = it },
                )
            }

            if (selectedTabIndex == 0) {
                item {
                    PremiumSectionCard(
                        title = stringResource(R.string.ugs_songs_new_card_title),
                        subtitle = stringResource(R.string.ugs_songs_create_card_subtitle),
                        icon = Icons.Outlined.LibraryMusic,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Column(verticalArrangement = Arrangement.spacedBy(formSpacing)) {
                            OutlinedTextField(
                                value = topic,
                                onValueChange = {
                                    if (it.length <= 20) {
                                        topic = it
                                        topicError = null
                                    }
                                },
                                label = { Text(stringResource(R.string.ugs_songs_topic_label)) },
                                modifier = Modifier.fillMaxWidth(),
                                singleLine = true,
                                isError = topicError != null,
                                supportingText = {
                                    when {
                                        topicError != null -> Text(topicError!!)
                                        else ->
                                            Text(
                                                stringResource(
                                                    R.string.ugs_songs_topic_counter,
                                                    topic.length,
                                                ),
                                            )
                                    }
                                },
                                shape = fieldShape,
                                colors = fieldColors,
                            )

                            UgsSongsGenrePicker(
                                presets = styles,
                                selectedIndex = selectedStyleIndex,
                                onSelect = { selectedStyleIndex = it },
                            )

                            if (tasteLikeCount > 0) {
                                Text(
                                    text =
                                        stringResource(
                                            R.string.ugs_songs_taste_profile_active,
                                            tasteLikeCount,
                                        ),
                                    color = MaterialTheme.colorScheme.primary,
                                    style = MaterialTheme.typography.bodySmall,
                                )
                            }

                            TextButton(onClick = { showSoundSettings = !showSoundSettings }) {
                                Text(
                                    text =
                                        stringResource(
                                            if (showSoundSettings) {
                                                R.string.ugs_songs_sound_settings_hide
                                            } else {
                                                R.string.ugs_songs_sound_settings_show
                                            },
                                        ),
                                )
                            }

                            AnimatedVisibility(visible = showSoundSettings) {
                                Column(verticalArrangement = Arrangement.spacedBy(formSpacing)) {
                                    UgsSongsOptionChips(
                                        heading = stringResource(R.string.ugs_songs_language_label),
                                        options = languages,
                                        selectedIndex = selectedLanguageIndex,
                                        onSelect = { selectedLanguageIndex = it },
                                        useWrappedLayout = chrome.useWrappedFilterChips,
                                    )
                                    UgsSongsOptionChips(
                                        heading = stringResource(R.string.ugs_songs_vocal_label),
                                        options = vocals,
                                        selectedIndex = selectedVocalIndex,
                                        onSelect = { selectedVocalIndex = it },
                                        useWrappedLayout = chrome.useWrappedFilterChips,
                                    )
                                    if (forgeModes.isNotEmpty()) {
                                        val langKey = languages[selectedLanguageIndex].first
                                        UgsSongsOptionChips(
                                            heading = stringResource(R.string.ugs_songs_pipeline_label),
                                            options =
                                                forgeModes.map { mode ->
                                                    mode.mode_key to
                                                        musicForgeModeLabel(mode, langKey)
                                                },
                                            selectedIndex =
                                                selectedModeIndex.coerceIn(0, forgeModes.lastIndex),
                                            onSelect = { selectedModeIndex = it },
                                            useWrappedLayout = chrome.useWrappedFilterChips,
                                        )
                                    } else if (forgeModesLoadError != null) {
                                        Text(
                                            text = forgeModesLoadError!!,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                            style = MaterialTheme.typography.bodySmall,
                                        )
                                    }
                                }
                            }

                            if (submitError != null) {
                                Text(
                                    text = submitError!!,
                                    color = MaterialTheme.colorScheme.error,
                                    style = MaterialTheme.typography.bodyMedium,
                                )
                            }

                            Button(
                                onClick = {
                                    val topicValidation = validateUgsSongTopic(topic)
                                    if (!topicValidation.isValid) {
                                        topicError = topicValidationMessage(context, topicValidation.rejectReason)
                                        submitError = null
                                    } else {
                                        scope.launch {
                                            isSubmitting = true
                                            submitError = null
                                            topicError = null
                                            try {
                                                withContext(Dispatchers.IO) {
                                                    val modeKey =
                                                        forgeModes
                                                            .getOrNull(selectedModeIndex)
                                                            ?.mode_key
                                                    runUgsSongGeneration(
                                                        repository = repository,
                                                        topic = topicValidation.normalizedTopic,
                                                        styleKey = styles[selectedStyleIndex].style,
                                                        language = languages[selectedLanguageIndex].first,
                                                        vocal = vocals[selectedVocalIndex].first,
                                                        modeKey = modeKey,
                                                    )
                                                }
                                                topic = ""
                                                Toast.makeText(
                                                    context,
                                                    context.getString(R.string.ugs_songs_started),
                                                    Toast.LENGTH_SHORT,
                                                ).show()
                                                selectedTabIndex = 1
                                                loadSongs()
                                            } catch (e: Exception) {
                                                submitError =
                                                    e.message ?: context.getString(R.string.ugs_submit_error)
                                            } finally {
                                                isSubmitting = false
                                            }
                                        }
                                    }
                                },
                                enabled = !isSubmitting,
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(14.dp),
                                colors =
                                    ButtonDefaults.buttonColors(
                                        containerColor = Color(0xFF16A34A),
                                        contentColor = Color.White,
                                    ),
                            ) {
                                if (isSubmitting) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(18.dp).padding(end = 8.dp),
                                        strokeWidth = 2.dp,
                                        color = Color.White,
                                    )
                                }
                                Text(
                                    if (isSubmitting) {
                                        stringResource(R.string.ugs_songs_generating)
                                    } else {
                                        stringResource(R.string.ugs_songs_generate)
                                    },
                                )
                            }
                            if (isSubmitting) {
                                PremiumLoadingCard(
                                    message = stringResource(R.string.ugs_songs_generating_hint),
                                    modifier = Modifier.fillMaxWidth(),
                                )
                            }
                        }
                    }
                }
            } else {
                item {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                text = stringResource(R.string.ugs_songs_section_generations),
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.onSurface,
                            )
                            if (songs.isNotEmpty()) {
                                PremiumBadge(text = songs.size.toString())
                            }
                        }
                        Text(
                            text = stringResource(R.string.ugs_songs_tap_row_hint),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        if (onOpenContentLibrary != null) {
                            ScaledOutlinedButton(
                                onClick = onOpenContentLibrary,
                                enabled = true,
                                label = stringResource(R.string.ugs_songs_open_content_library),
                                icon = Icons.Outlined.LibraryMusic,
                                modifier = Modifier.fillMaxWidth(),
                            )
                        }
                        if (songsTotal >= 200) {
                            Text(
                                text = stringResource(R.string.ugs_songs_history_cap_hint),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }

                item {
                    PremiumDividerGlow(modifier = Modifier.padding(vertical = 2.dp))
                }

                if (isSongsLoading && songs.isEmpty()) {
                    item {
                        PremiumLoadingCard(
                            message = stringResource(R.string.ugs_songs_loading),
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                } else if (songsError != null && songs.isEmpty()) {
                    item {
                        PremiumStateCard(
                            modifier = Modifier.fillMaxWidth(),
                            title = stringResource(R.string.ugs_songs_screen_title),
                            message = songsError ?: "",
                            icon = Icons.Outlined.LibraryMusic,
                            isError = true,
                            action = {
                                Button(
                                    onClick = { loadSongs() },
                                    shape = RoundedCornerShape(12.dp),
                                ) {
                                    Text(stringResource(R.string.ugs_songs_error_retry))
                                }
                            },
                        )
                    }
                } else if (songs.isEmpty()) {
                    item {
                        PremiumStateCard(
                            modifier = Modifier.fillMaxWidth(),
                            title = stringResource(R.string.ugs_songs_empty_title),
                            message = stringResource(R.string.ugs_songs_empty_hint),
                            icon = Icons.Outlined.LibraryMusic,
                        )
                    }
                } else {
                    items(songs, key = { it.id }) { song ->
                        val isCurrentTrack = mediaPlaybackState.track?.id == song.id
                        val isPlaying = isCurrentTrack && mediaPlaybackState.isPlaying
                        val isRowBusy =
                            (isCurrentTrack && mediaPlaybackState.isLoading) ||
                                downloadingSongId == song.id ||
                                deletingSongId == song.id
                        UgsSongHistoryRow(
                            song = song,
                            isCurrentTrack = isCurrentTrack,
                            isPlaying = isPlaying,
                            isOfflineCached = song.id in cachedSongIds,
                            isBusy = isRowBusy,
                            onPrimaryClick = { onSongPrimaryTap(song) },
                            onMoreClick = { selectedSongForActions = song },
                        )
                    }
                }
            }
        }
    }
}

private suspend fun runUgsSongGeneration(
    repository: UgsHubRepository,
    topic: String,
    styleKey: String,
    language: String,
    vocal: String,
    modeKey: String?,
) {
    runMusicForgeSongGeneration(
        api = repository.musicForgeApi,
        topic = topic,
        styleKey = styleKey,
        language = language,
        vocal = vocal,
        modeKey = modeKey,
        durationSeconds = MUSIC_FORGE_MOBILE_DURATION_SECONDS,
    )
}

private fun UnifiedContentDto.toSongMediaTrack(context: Context): EmperyMediaTrack =
    EmperyMediaTrack(
        id = id,
        title = songDisplayName(context, this),
        uri = EmperyMediaPlayerHolder.contentDownloadUrl(id),
        mimeType = mime_type ?: "audio/mpeg",
        subtitle = context.getString(R.string.ugs_songs_track_source),
        artworkUrl = contentListThumbnailUrl(this),
    )

private fun songDownloadFileName(song: UnifiedContentDto): String {
    val rawName =
        song.name
            .ifBlank { "song" }
            .replace(Regex("[\\\\/:*?\"<>|]+"), "_")
            .trim()
            .ifBlank { "song" }
    return "${rawName}_${song.id.take(8)}.mp3"
}

private fun topicValidationMessage(
    context: Context,
    reason: UgsSongTopicRejectReason?,
): String =
    when (reason) {
        UgsSongTopicRejectReason.EMPTY -> context.getString(R.string.ugs_songs_topic_required)
        UgsSongTopicRejectReason.PROFANITY_OR_OBFUSCATION ->
            context.getString(R.string.ugs_songs_topic_forbidden_words)
        UgsSongTopicRejectReason.PROHIBITED_CONTENT -> context.getString(R.string.ugs_songs_topic_prohibited)
        null -> context.getString(R.string.ugs_submit_error)
    }
