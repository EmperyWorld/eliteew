/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Mobile file manager: unified content list, compact toolbar card, row tap + action sheet.
 *
 * Invariants:
 * - Opening the screen fetches list pages only — no bulk file download or stream-cache prefetch.
 * - Play/cache/download/open run only after explicit user choice in the action sheet.
 * - Primary tap runs the best default action (audio play, openable files open); overflow opens full sheet.
 *
 * Related:
 * - UnifiedContentListSupport.kt, UgsContentUpload.kt, UgsHubRepository
 */
package feature.ugs

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudDownload
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.OpenInNew
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Upload
import androidx.compose.material.icons.outlined.CloudDone
import androidx.compose.material.icons.outlined.Favorite
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.AudioFile
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.FolderOpen
import androidx.compose.material.icons.outlined.Image
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch
import world.empery.mobile.core.media.EmperyMediaPlayerHolder
import world.empery.mobile.core.media.EmperyMediaStreamCache
import world.empery.mobile.core.media.EmperyMediaTrack
import world.empery.mobile.core.media.MusicPlayerFavoritesHolder
import world.empery.mobile.core.network.api.UnifiedContentDto
import world.empery.mobile.core.network.api.UnifiedContentListPage
import world.empery.mobile.core.network.api.fetchContentPage
import world.empery.mobile.core.ui.LocalMobilePermissionRequester
import world.empery.mobile.core.ui.PremiumBadge
import world.empery.mobile.core.ui.PremiumLoadingCard
import world.empery.mobile.core.ui.PremiumRowSurface
import world.empery.mobile.core.ui.PremiumSectionCard
import world.empery.mobile.core.ui.PremiumStateCard
import world.empery.mobile.core.ui.ScaledOutlinedButton

private enum class ContentLibraryFilter(
    val apiType: String?,
    val labelRes: Int,
    val icon: ImageVector,
) {
    ALL(null, R.string.mobile_content_filter_all, Icons.Outlined.FolderOpen),
    AUDIO("audio", R.string.mobile_content_filter_audio, Icons.Outlined.AudioFile),
    IMAGE("image", R.string.mobile_content_filter_image, Icons.Outlined.Image),
    DOCUMENT("document", R.string.mobile_content_filter_document, Icons.Outlined.Description),
}

private enum class ContentLibrarySort(
    val sortField: String,
    val sortOrder: String,
    val labelRes: Int,
) {
    NEWEST("date", "desc", R.string.mobile_content_sort_newest),
    NAME("name", "asc", R.string.mobile_content_sort_name),
}

private enum class ContentSheetAction {
    PLAY,
    CACHE,
    DOWNLOAD,
    OPEN,
    FAVORITE,
}

private const val CONTENT_PAGE_SIZE = 50

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MobileContentLibraryScreen(
    repository: UgsHubRepository,
    onBack: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val permissionRequester = LocalMobilePermissionRequester.current
    val listState = rememberLazyListState()
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val previewSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    var selectedFilter by remember { mutableStateOf(ContentLibraryFilter.ALL) }
    var selectedSort by remember { mutableStateOf(ContentLibrarySort.NEWEST) }
    var searchInput by remember { mutableStateOf("") }
    var searchQuery by remember { mutableStateOf("") }
    var items by remember { mutableStateOf<List<UnifiedContentDto>>(emptyList()) }
    var totalCount by remember { mutableIntStateOf(0) }
    var hasMore by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(true) }
    var isLoadingMore by remember { mutableStateOf(false) }
    var isUploading by remember { mutableStateOf(false) }
    var loadError by remember { mutableStateOf<String?>(null) }
    var selectedItem by remember { mutableStateOf<UnifiedContentDto?>(null) }
    var previewItem by remember { mutableStateOf<UnifiedContentDto?>(null) }
    var sheetBusyAction by remember { mutableStateOf<ContentSheetAction?>(null) }

    val mediaPlaybackState by EmperyMediaPlayerHolder.controller.state.collectAsStateWithLifecycle()
    val cachedContentIds by EmperyMediaPlayerHolder.cachedContentIds.collectAsStateWithLifecycle()
    val favoriteContentIds by MusicPlayerFavoritesHolder.favoriteIds.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        MusicPlayerFavoritesHolder.refresh()
    }

    val uploadLauncher =
        rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
            if (uri == null) return@rememberLauncherForActivityResult
            scope.launch {
                isUploading = true
                try {
                    repository.uploadContentFromUri(context, uri)
                    Toast.makeText(
                        context,
                        context.getString(R.string.mobile_content_upload_success),
                        Toast.LENGTH_SHORT,
                    ).show()
                    reloadContentList(
                        repository = repository,
                        context = context,
                        selectedFilter = selectedFilter,
                        selectedSort = selectedSort,
                        searchQuery = searchQuery,
                        onResult = { page ->
                            items = page.items
                            totalCount = page.total
                            hasMore = page.hasMore
                            loadError = null
                        },
                        onError = { err ->
                            loadError = err
                        },
                    )
                } catch (e: Exception) {
                    Toast.makeText(
                        context,
                        e.message ?: context.getString(R.string.mobile_content_upload_error),
                        Toast.LENGTH_SHORT,
                    ).show()
                } finally {
                    isUploading = false
                }
            }
        }

    LaunchedEffect(searchInput) {
        delay(350)
        searchQuery = searchInput.trim()
    }

    fun reload() {
        scope.launch {
            isLoading = true
            loadError = null
            reloadContentList(
                repository = repository,
                context = context,
                selectedFilter = selectedFilter,
                selectedSort = selectedSort,
                searchQuery = searchQuery,
                onResult = { page ->
                    items = page.items
                    totalCount = page.total
                    hasMore = page.hasMore
                },
                onError = { err ->
                    loadError = err
                    items = emptyList()
                    totalCount = 0
                    hasMore = false
                },
            )
            isLoading = false
        }
    }

    fun loadMore() {
        if (isLoadingMore || !hasMore) return
        scope.launch {
            isLoadingMore = true
            try {
                val page =
                    repository.contentApi.fetchContentPage(
                        contentType = selectedFilter.apiType,
                        search = searchQuery,
                        ownerOnly = true,
                        limit = CONTENT_PAGE_SIZE,
                        offset = items.size,
                        sortField = selectedSort.sortField,
                        sortOrder = selectedSort.sortOrder,
                    )
                items = items + page.items
                totalCount = page.total
                hasMore = page.hasMore
            } catch (e: Exception) {
                Toast.makeText(
                    context,
                    e.message ?: context.getString(R.string.mobile_content_load_error),
                    Toast.LENGTH_SHORT,
                ).show()
            } finally {
                isLoadingMore = false
            }
        }
    }

    LaunchedEffect(selectedFilter, selectedSort, searchQuery) {
        reload()
    }

    LaunchedEffect(listState, items.size, hasMore, isLoading, isLoadingMore) {
        snapshotFlow {
            val info = listState.layoutInfo
            info.visibleItemsInfo.lastOrNull()?.index to info.totalItemsCount
        }.distinctUntilChanged().collect { (lastVisible: Int?, totalItems: Int) ->
            if (
                totalItems > 0 &&
                lastVisible != null &&
                lastVisible >= totalItems - 4 &&
                hasMore &&
                !isLoadingMore &&
                !isLoading
            ) {
                loadMore()
            }
        }
    }

    LaunchedEffect(items) {
        retainContentPreviewCache(items.map { it.id })
    }

    fun runPrimaryTap(item: UnifiedContentDto) {
        when {
            isAudioContent(item) -> {
                scope.launch {
                    val isCurrentTrack = mediaPlaybackState.track?.id == item.id
                    if (isCurrentTrack) {
                        EmperyMediaPlayerHolder.controller.togglePlayPause()
                    } else {
                        EmperyMediaPlayerHolder.controller.play(item.toMediaTrack(context))
                    }
                }
            }
            supportsContentPreview(item) -> previewItem = item
            canOpenInViewer(item) -> previewItem = item
            else -> selectedItem = item
        }
    }

    if (previewItem != null) {
        val item = previewItem!!
        ModalBottomSheet(
            onDismissRequest = { previewItem = null },
            sheetState = previewSheetState,
        ) {
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp)
                        .padding(bottom = 28.dp)
                        .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(
                    text = stringResource(R.string.mobile_content_preview_title),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text = item.displayName(context),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                ContentLibraryMetadataBlock(item = item)
                ContentLibraryPreviewBody(
                    item = item,
                    repository = repository,
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End),
                ) {
                    if (canOpenInViewer(item)) {
                        TextButton(
                            onClick = {
                                scope.launch {
                                    runOpenContent(
                                        context = context,
                                        repository = repository,
                                        permissionRequester = permissionRequester,
                                        item = item,
                                        onDone = { previewItem = null },
                                    )
                                }
                            },
                        ) {
                            Text(stringResource(R.string.mobile_content_open))
                        }
                    }
                    TextButton(onClick = { previewItem = null }) {
                        Text(stringResource(android.R.string.cancel))
                    }
                }
            }
        }
    }

    if (selectedItem != null) {
        val item = selectedItem!!
        val isAudio = isAudioContent(item)
        val isCurrentTrack = mediaPlaybackState.track?.id == item.id
        val isPlaying = isCurrentTrack && mediaPlaybackState.isPlaying
        val isOfflineCached = item.id in cachedContentIds
        val isFavorite = item.id in favoriteContentIds

        ModalBottomSheet(
            onDismissRequest = {
                if (sheetBusyAction == null) selectedItem = null
            },
            sheetState = sheetState,
        ) {
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp)
                        .padding(bottom = 28.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    text = stringResource(R.string.mobile_content_actions_title),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.primary,
                )
                Text(
                    text = item.displayName(context),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = contentMetaLabel(context, item),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (isOfflineCached) {
                    Text(
                        text = stringResource(R.string.mobile_content_stream_cached),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                if (isAudio) {
                    ContentSheetActionRow(
                        label =
                            if (isPlaying) {
                                stringResource(R.string.mobile_content_pause)
                            } else {
                                stringResource(R.string.mobile_content_play)
                            },
                        icon = if (isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                        busy = sheetBusyAction == ContentSheetAction.PLAY,
                        enabled = sheetBusyAction == null,
                        onClick = {
                            scope.launch {
                                sheetBusyAction = ContentSheetAction.PLAY
                                try {
                                    if (isCurrentTrack) {
                                        EmperyMediaPlayerHolder.controller.togglePlayPause()
                                    } else {
                                        EmperyMediaPlayerHolder.controller.play(item.toMediaTrack(context))
                                    }
                                    selectedItem = null
                                } finally {
                                    sheetBusyAction = null
                                }
                            }
                        },
                    )
                    ContentSheetActionRow(
                        label = stringResource(R.string.mobile_content_cache),
                        icon =
                            if (isOfflineCached) {
                                Icons.Outlined.CloudDone
                            } else {
                                Icons.Filled.CloudDownload
                            },
                        busy = sheetBusyAction == ContentSheetAction.CACHE,
                        enabled = sheetBusyAction == null && !isOfflineCached,
                        onClick = {
                            scope.launch {
                                sheetBusyAction = ContentSheetAction.CACHE
                                try {
                                    EmperyMediaStreamCache.prefetchContent(
                                        item.id,
                                        EmperyMediaPlayerHolder.contentDownloadUrl(item.id),
                                    )
                                    delay(900)
                                    if (EmperyMediaStreamCache.isCached(item.id)) {
                                        Toast.makeText(
                                            context,
                                            context.getString(R.string.mobile_content_cache_ready),
                                            Toast.LENGTH_SHORT,
                                        ).show()
                                    }
                                } finally {
                                    sheetBusyAction = null
                                }
                            }
                        },
                    )
                }
                if (isAudio) {
                    ContentSheetActionRow(
                        label =
                            if (isFavorite) {
                                stringResource(R.string.mobile_content_remove_favorite_cd)
                            } else {
                                stringResource(R.string.mobile_content_add_favorite_cd)
                            },
                        icon = if (isFavorite) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
                        busy = sheetBusyAction == ContentSheetAction.FAVORITE,
                        enabled = sheetBusyAction == null,
                        onClick = {
                            sheetBusyAction = ContentSheetAction.FAVORITE
                            MusicPlayerFavoritesHolder.toggleFavorite(item.id)
                            sheetBusyAction = null
                        },
                    )
                }
                if (canOpenInViewer(item)) {
                    ContentSheetActionRow(
                        label = stringResource(R.string.mobile_content_open),
                        icon = Icons.Filled.OpenInNew,
                        busy = sheetBusyAction == ContentSheetAction.OPEN,
                        enabled = sheetBusyAction == null,
                        onClick = {
                            scope.launch {
                                sheetBusyAction = ContentSheetAction.OPEN
                                try {
                                    runOpenContent(
                                        context = context,
                                        repository = repository,
                                        permissionRequester = permissionRequester,
                                        item = item,
                                        onDone = { selectedItem = null },
                                    )
                                } catch (e: Exception) {
                                    Toast.makeText(
                                        context,
                                        e.message ?: context.getString(R.string.ugs_download_open_file_error),
                                        Toast.LENGTH_SHORT,
                                    ).show()
                                } finally {
                                    sheetBusyAction = null
                                }
                            }
                        },
                    )
                }
                ContentSheetActionRow(
                    label = stringResource(R.string.mobile_content_download),
                    icon = Icons.Filled.Download,
                    busy = sheetBusyAction == ContentSheetAction.DOWNLOAD,
                    enabled = sheetBusyAction == null,
                    onClick = {
                        scope.launch {
                            sheetBusyAction = ContentSheetAction.DOWNLOAD
                            try {
                                runDownloadContent(
                                    context = context,
                                    repository = repository,
                                    permissionRequester = permissionRequester,
                                    item = item,
                                    onDone = { selectedItem = null },
                                )
                            } catch (e: Exception) {
                                Toast.makeText(
                                    context,
                                    e.message ?: context.getString(R.string.ugs_download_open_file_error),
                                    Toast.LENGTH_SHORT,
                                ).show()
                            } finally {
                                sheetBusyAction = null
                            }
                        }
                    },
                )
                TextButton(
                    onClick = { if (sheetBusyAction == null) selectedItem = null },
                    modifier = Modifier.align(Alignment.End),
                ) {
                    Text(stringResource(android.R.string.cancel))
                }
            }
        }
    }

    Scaffold(
        containerColor = Color.Transparent,
        topBar = {
            UgsAiSubScreenTopBar(
                title = stringResource(R.string.mobile_content_screen_title),
                subtitle = stringResource(R.string.mobile_content_top_subtitle),
                onBack = onBack,
                isRefreshing = isLoading,
                onRefresh = { reload() },
                refreshContentDescription = stringResource(R.string.mobile_content_refresh),
            )
        },
    ) { padding ->
        LazyColumn(
            state = listState,
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                ContentLibraryToolbarCard(
                    searchInput = searchInput,
                    onSearchInputChange = { searchInput = it },
                    selectedFilter = selectedFilter,
                    onFilterSelect = { selectedFilter = it },
                    selectedSort = selectedSort,
                    onSortSelect = { selectedSort = it },
                    isUploading = isUploading,
                    onUploadClick = { uploadLauncher.launch(arrayOf("*/*")) },
                )
            }
            item {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = stringResource(R.string.mobile_content_list_heading),
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold,
                        )
                        if (totalCount > 0) {
                            PremiumBadge(text = "$totalCount")
                        }
                    }
                    Text(
                        text = stringResource(R.string.mobile_content_tap_for_actions),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            if (isLoading && items.isEmpty()) {
                item {
                    PremiumLoadingCard(
                        message = stringResource(R.string.mobile_content_loading),
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            } else if (loadError != null && items.isEmpty()) {
                item {
                    PremiumStateCard(
                        modifier = Modifier.fillMaxWidth(),
                        title = stringResource(R.string.mobile_content_screen_title),
                        message = loadError ?: "",
                        icon = Icons.Outlined.FolderOpen,
                        isError = true,
                        action = {
                            Button(onClick = { reload() }, shape = RoundedCornerShape(12.dp)) {
                                Text(stringResource(R.string.mobile_content_retry))
                            }
                        },
                    )
                }
            } else if (items.isEmpty()) {
                item {
                    PremiumStateCard(
                        modifier = Modifier.fillMaxWidth(),
                        title = stringResource(R.string.mobile_content_empty_title),
                        message = stringResource(R.string.mobile_content_empty_hint),
                        icon = Icons.Outlined.FolderOpen,
                    )
                }
            } else {
                items(items, key = { it.id }) { item ->
                    ContentLibraryListRow(
                        item = item,
                        isCurrentTrack = mediaPlaybackState.track?.id == item.id,
                        isPlaying = mediaPlaybackState.track?.id == item.id && mediaPlaybackState.isPlaying,
                        isOfflineCached = item.id in cachedContentIds,
                        isFavorite = item.id in favoriteContentIds,
                        onPrimaryClick = { runPrimaryTap(item) },
                        onMoreClick = { selectedItem = item },
                    )
                }
                if (isLoadingMore) {
                    item(key = "loading_more") {
                        Row(
                            modifier =
                                Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 8.dp),
                            horizontalArrangement = Arrangement.Center,
                        ) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(22.dp),
                                strokeWidth = 2.dp,
                            )
                        }
                    }
                }
            }
        }
    }
}

private suspend fun reloadContentList(
    repository: UgsHubRepository,
    context: Context,
    selectedFilter: ContentLibraryFilter,
    selectedSort: ContentLibrarySort,
    searchQuery: String,
    onResult: (page: UnifiedContentListPage) -> Unit,
    onError: (String) -> Unit,
) {
    try {
        val page =
            repository.contentApi.fetchContentPage(
                contentType = selectedFilter.apiType,
                search = searchQuery,
                ownerOnly = true,
                limit = CONTENT_PAGE_SIZE,
                offset = 0,
                sortField = selectedSort.sortField,
                sortOrder = selectedSort.sortOrder,
            )
        onResult(page)
    } catch (e: Exception) {
        onError(e.message ?: context.getString(R.string.mobile_content_load_error))
    }
}

@Composable
private fun ContentLibraryToolbarCard(
    searchInput: String,
    onSearchInputChange: (String) -> Unit,
    selectedFilter: ContentLibraryFilter,
    onFilterSelect: (ContentLibraryFilter) -> Unit,
    selectedSort: ContentLibrarySort,
    onSortSelect: (ContentLibrarySort) -> Unit,
    isUploading: Boolean,
    onUploadClick: () -> Unit,
) {
    PremiumSectionCard(
        title = stringResource(R.string.mobile_content_toolbar_title),
        subtitle = stringResource(R.string.mobile_content_toolbar_hint),
        icon = Icons.Outlined.FolderOpen,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedTextField(
                value = searchInput,
                onValueChange = onSearchInputChange,
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                label = { Text(stringResource(R.string.mobile_content_search_label)) },
                placeholder = { Text(stringResource(R.string.mobile_content_search_hint)) },
            )
            ContentLibraryChipHeading(text = stringResource(R.string.mobile_content_filter_heading))
            LazyRowFilters(selected = selectedFilter, onSelect = onFilterSelect)
            ContentLibraryChipHeading(text = stringResource(R.string.mobile_content_sort_heading))
            LazyRowSort(selected = selectedSort, onSelect = onSortSelect)
            ScaledOutlinedButton(
                onClick = onUploadClick,
                label = stringResource(R.string.mobile_content_upload),
                icon = Icons.Filled.Upload,
                enabled = !isUploading,
                modifier = Modifier.fillMaxWidth(),
            )
            if (isUploading) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                    Text(
                        text = stringResource(R.string.mobile_content_loading),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun ContentLibraryChipHeading(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.labelLarge,
        fontWeight = FontWeight.SemiBold,
        color = MaterialTheme.colorScheme.primary,
    )
}

@Composable
private fun ContentLibraryListRow(
    item: UnifiedContentDto,
    isCurrentTrack: Boolean,
    isPlaying: Boolean,
    isOfflineCached: Boolean,
    isFavorite: Boolean,
    onPrimaryClick: () -> Unit,
    onMoreClick: () -> Unit,
) {
    val context = LocalContext.current
    val isAudio = isAudioContent(item)

    PremiumRowSurface(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onPrimaryClick),
        containerColor =
            if (isCurrentTrack) {
                MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.45f)
            } else {
                null
            },
    ) {
        ContentLibraryThumbnail(item = item)
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(
                text = item.displayName(context),
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = contentMetaLabel(context, item),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                if (isCurrentTrack && isPlaying) {
                    PremiumBadge(text = stringResource(R.string.mobile_content_now_playing))
                }
                if (isOfflineCached) {
                    PremiumBadge(text = stringResource(R.string.mobile_content_stream_cached))
                }
                if (isFavorite && isAudio) {
                    PremiumBadge(text = stringResource(R.string.mobile_content_favorite_badge))
                }
            }
        }
        IconButton(onClick = onMoreClick) {
            Icon(
                imageVector = Icons.Outlined.ChevronRight,
                contentDescription = stringResource(R.string.mobile_content_row_more_cd),
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun LazyRowSort(
    selected: ContentLibrarySort,
    onSelect: (ContentLibrarySort) -> Unit,
) {
    androidx.compose.foundation.lazy.LazyRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(ContentLibrarySort.entries.size) { index ->
            val sort = ContentLibrarySort.entries[index]
            FilterChip(
                selected = selected == sort,
                onClick = { onSelect(sort) },
                label = { Text(stringResource(sort.labelRes)) },
            )
        }
    }
}

private suspend fun runDownloadContent(
    context: Context,
    repository: UgsHubRepository,
    permissionRequester: (() -> Unit)?,
    item: UnifiedContentDto,
    onDone: () -> Unit = {},
) {
    if (!requestStoragePermissionsIfNeeded(context, permissionRequester)) {
        Toast.makeText(
            context,
            context.getString(R.string.ugs_download_permissions_needed),
            Toast.LENGTH_LONG,
        ).show()
        return
    }
    repository.downloadContentToDownloads(
        context = context,
        contentId = item.id,
        fileName = contentDownloadFileName(item),
        mimeType = item.mime_type ?: "application/octet-stream",
    )
    Toast.makeText(
        context,
        context.getString(R.string.mobile_content_downloaded),
        Toast.LENGTH_SHORT,
    ).show()
    onDone()
}

private suspend fun runOpenContent(
    context: Context,
    repository: UgsHubRepository,
    permissionRequester: (() -> Unit)?,
    item: UnifiedContentDto,
    onDone: () -> Unit = {},
) {
    if (!requestStoragePermissionsIfNeeded(context, permissionRequester)) {
        Toast.makeText(
            context,
            context.getString(R.string.ugs_download_permissions_needed),
            Toast.LENGTH_LONG,
        ).show()
        return
    }
    val uri =
        repository.downloadContentToDownloads(
            context = context,
            contentId = item.id,
            fileName = contentDownloadFileName(item),
            mimeType = item.mime_type ?: "application/octet-stream",
        )
    val viewMime = viewerMimeType(item)
    val intent =
        Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, viewMime)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
    context.startActivity(intent)
    onDone()
}

@Composable
private fun ContentSheetActionRow(
    label: String,
    icon: ImageVector,
    busy: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    PremiumRowSurface(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(enabled = enabled && !busy, onClick = onClick),
        tonalElevation = 1.dp,
    ) {
        if (busy) {
            CircularProgressIndicator(
                modifier = Modifier.size(20.dp),
                strokeWidth = 2.dp,
            )
        } else {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(22.dp),
                tint = MaterialTheme.colorScheme.primary,
            )
        }
        Text(
            text = label,
            style = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun LazyRowFilters(
    selected: ContentLibraryFilter,
    onSelect: (ContentLibraryFilter) -> Unit,
) {
    androidx.compose.foundation.lazy.LazyRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(ContentLibraryFilter.entries.size) { index ->
            val filter = ContentLibraryFilter.entries[index]
            FilterChip(
                selected = selected == filter,
                onClick = { onSelect(filter) },
                label = { Text(stringResource(filter.labelRes)) },
                leadingIcon = {
                    Icon(
                        imageVector = filter.icon,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp),
                    )
                },
            )
        }
    }
}

private fun canOpenInViewer(item: UnifiedContentDto): Boolean {
    val mime = item.mime_type?.lowercase().orEmpty()
    return mime.startsWith("image/") ||
        mime.startsWith("video/") ||
        mime.contains("pdf") ||
        mime.startsWith("text/")
}

private fun viewerMimeType(item: UnifiedContentDto): String {
    val mime = item.mime_type?.lowercase().orEmpty()
    return when {
        mime.startsWith("image/") -> "image/*"
        mime.startsWith("video/") -> "video/*"
        mime.contains("pdf") -> "application/pdf"
        mime.startsWith("text/") -> "text/plain"
        else -> item.mime_type ?: "*/*"
    }
}

private fun UnifiedContentDto.displayName(context: Context): String =
    name.ifBlank { context.getString(R.string.mobile_content_untitled) }

private fun UnifiedContentDto.toMediaTrack(context: Context): EmperyMediaTrack =
    EmperyMediaTrack(
        id = id,
        title = displayName(context),
        uri = EmperyMediaPlayerHolder.contentDownloadUrl(id),
        mimeType = mime_type ?: "audio/mpeg",
        subtitle = context.getString(R.string.mobile_content_track_source),
        artworkUrl = contentListThumbnailUrl(this),
    )

private fun contentMetaLabel(
    context: Context,
    item: UnifiedContentDto,
): String {
    val typeLabel = contentTypeLabel(context, item)
    val sizeLabel = formatContentFileSize(item.file_size)
    return if (sizeLabel != null) "$typeLabel · $sizeLabel" else typeLabel
}

private fun contentTypeLabel(
    context: Context,
    item: UnifiedContentDto,
): String {
    val mime = item.mime_type?.lowercase().orEmpty()
    return when {
        mime.startsWith("audio/") -> context.getString(R.string.mobile_content_type_audio)
        mime.startsWith("image/") -> context.getString(R.string.mobile_content_type_image)
        mime.startsWith("video/") -> context.getString(R.string.mobile_content_type_video)
        mime.contains("pdf") -> context.getString(R.string.mobile_content_type_document)
        mime.isNotBlank() -> mime
        else -> context.getString(R.string.mobile_content_type_other)
    }
}

private fun contentDownloadFileName(item: UnifiedContentDto): String {
    val safeStem =
        item.name
            .ifBlank { "content" }
            .replace(Regex("[\\\\/:*?\"<>|]+"), "_")
            .trim()
            .ifBlank { "content" }
    val ext =
        when {
            item.mime_type?.contains("mpeg") == true || item.mime_type?.contains("mp3") == true -> "mp3"
            item.mime_type?.startsWith("image/") == true -> "png"
            item.mime_type?.contains("pdf") == true -> "pdf"
            else -> "bin"
        }
    return "${safeStem}_${item.id.take(8)}.$ext"
}
