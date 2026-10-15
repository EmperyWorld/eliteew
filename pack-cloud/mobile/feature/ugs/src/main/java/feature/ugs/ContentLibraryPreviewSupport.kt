/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Preview loading, mime icons, and thumbnail composables for mobile content library.
 *
 * Invariants:
 * - List thumbnails: GET `/thumbnail` only when [UnifiedContentDto.thumbnail_url] is set and
 *   integrity is not `broken_quarantined`; null URL / broken → mime icon (no mime probe, no download fallback).
 * - Previews load via authenticated Coil + [ContentLibraryPreviewCache] when a list thumb URL exists.
 * - [retainOnlyKnown] invoked when list changes to evict deleted file previews.
 *
 * Related:
 * - MobileContentLibraryScreen.kt, ContentLibraryPreviewCache.kt
 * - documentation/product/CONTENT-BROKEN-FILES-AND-WEBP-DISPLAY.md
 */
package feature.ugs

import android.content.Context
import android.graphics.Bitmap
import android.graphics.drawable.BitmapDrawable
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextOverflow
import feature.ugs.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.FolderOpen
import androidx.compose.material.icons.outlined.FolderZip
import androidx.compose.material.icons.outlined.Image
import androidx.compose.material.icons.outlined.InsertDriveFile
import androidx.compose.material.icons.outlined.PictureAsPdf
import androidx.compose.material.icons.outlined.TableChart
import androidx.compose.material.icons.outlined.TextSnippet
import androidx.compose.material.icons.outlined.Videocam
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import coil.imageLoader
import coil.request.ImageRequest
import world.empery.mobile.core.media.EmperyMediaPlayerHolder
import world.empery.mobile.core.network.api.UnifiedContentDto
import world.empery.mobile.core.network.api.allowsStoredThumbnailFetch
import world.empery.mobile.core.network.api.storedThumbnailAbsoluteUrl

internal fun contentMimeType(item: UnifiedContentDto): String = item.mime_type?.lowercase().orEmpty()

internal fun isAudioContent(item: UnifiedContentDto): Boolean =
    contentMimeType(item).startsWith("audio/")

internal fun isContentStorageBroken(item: UnifiedContentDto): Boolean =
    item.storage_integrity_status?.trim()?.equals("broken_quarantined", ignoreCase = true) == true

/**
 * Whether the list row may fetch a stored preview. Locked: honor API [UnifiedContentDto.thumbnail_url]
 * only — do not probe regenerable mimes to force lazy-heal (that recreated the edge 404 storm).
 */
internal fun supportsListThumbnail(item: UnifiedContentDto): Boolean = item.allowsStoredThumbnailFetch()

/** Absolute Coil URL for list thumb, or null when [supportsListThumbnail] is false. */
internal fun contentListThumbnailUrl(item: UnifiedContentDto): String? =
    item.storedThumbnailAbsoluteUrl(EmperyMediaPlayerHolder.apiBaseUrl)

internal fun supportsContentPreview(item: UnifiedContentDto): Boolean {
    val mime = contentMimeType(item)
    return mime.startsWith("image/") ||
        mime.startsWith("video/") ||
        mime.contains("pdf") ||
        mime.startsWith("text/") ||
        mime.contains("word") ||
        mime.contains("document") ||
        mime.contains("sheet") ||
        mime.contains("excel") ||
        mime.contains("presentation")
}

internal fun contentTypeIcon(item: UnifiedContentDto): ImageVector {
    val mime = contentMimeType(item)
    return when {
        mime.startsWith("audio/") -> Icons.Filled.MusicNote
        mime.startsWith("image/") -> Icons.Outlined.Image
        mime.startsWith("video/") -> Icons.Outlined.Videocam
        mime.contains("pdf") -> Icons.Outlined.PictureAsPdf
        mime.contains("word") || mime.contains("officedocument.word") -> Icons.Outlined.Description
        mime.contains("sheet") || mime.contains("excel") -> Icons.Outlined.TableChart
        mime.contains("presentation") || mime.contains("powerpoint") -> Icons.Outlined.Description
        mime.startsWith("text/") -> Icons.Outlined.TextSnippet
        mime.contains("zip") || mime.contains("rar") || mime.contains("7z") || mime.contains("tar") -> Icons.Outlined.FolderZip
        mime.isNotBlank() -> Icons.Outlined.InsertDriveFile
        else -> Icons.Outlined.FolderOpen
    }
}

internal fun isTextContent(item: UnifiedContentDto): Boolean {
    val mime = contentMimeType(item)
    return mime.startsWith("text/") ||
        mime.contains("json") ||
        mime.contains("xml") ||
        mime.contains("csv") ||
        mime.contains("markdown")
}

internal fun formatContentFileSize(bytes: Long?): String? {
    if (bytes == null || bytes <= 0L) return null
    val kb = 1024.0
    val mb = kb * 1024.0
    val gb = mb * 1024.0
    return when {
        bytes >= gb -> String.format("%.1f GB", bytes / gb)
        bytes >= mb -> String.format("%.1f MB", bytes / mb)
        bytes >= kb -> String.format("%.0f KB", bytes / kb)
        else -> "$bytes B"
    }
}

@Composable
internal fun ContentLibraryMetadataBlock(
    item: UnifiedContentDto,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        ContentLibraryMetadataRow(
            label = stringResource(R.string.mobile_content_meta_name),
            value = item.name.ifBlank { stringResource(R.string.mobile_content_untitled) },
        )
        item.mime_type?.takeIf { it.isNotBlank() }?.let { mime ->
            ContentLibraryMetadataRow(
                label = stringResource(R.string.mobile_content_meta_mime),
                value = mime,
            )
        }
        formatContentFileSize(item.file_size)?.let { size ->
            ContentLibraryMetadataRow(
                label = stringResource(R.string.mobile_content_meta_size),
                value = size,
            )
        }
        item.created_at?.takeIf { it.isNotBlank() }?.let { created ->
            ContentLibraryMetadataRow(
                label = stringResource(R.string.mobile_content_meta_created),
                value = created,
            )
        }
        ContentLibraryMetadataRow(
            label = stringResource(R.string.mobile_content_meta_id),
            value = item.id,
        )
    }
}

@Composable
private fun ContentLibraryMetadataRow(
    label: String,
    value: String,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodySmall,
            maxLines = 3,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
internal fun ContentLibraryPreviewBody(
    item: UnifiedContentDto,
    repository: UgsHubRepository,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(16.dp)
    when {
        isTextContent(item) -> {
            ContentLibraryTextPreview(
                item = item,
                repository = repository,
                modifier =
                    modifier
                        .fillMaxWidth()
                        .clip(shape)
                        .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f))
                        .heightIn(min = 120.dp, max = 320.dp)
                        .padding(12.dp),
            )
        }
        contentMimeType(item).startsWith("image/") ||
            contentMimeType(item).contains("pdf") ||
            contentMimeType(item).startsWith("video/") -> {
            Box(
                modifier =
                    modifier
                        .fillMaxWidth()
                        .clip(shape)
                        .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f)),
                contentAlignment = Alignment.Center,
            ) {
                ContentLibraryCachedPreviewImage(
                    item = item,
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .heightIn(min = 160.dp, max = 320.dp)
                            .padding(8.dp),
                    contentScale = ContentScale.Fit,
                )
            }
        }
        else -> {
            Box(
                modifier =
                    modifier
                        .fillMaxWidth()
                        .clip(shape)
                        .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f))
                        .heightIn(min = 120.dp),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        imageVector = contentTypeIcon(item),
                        contentDescription = null,
                        modifier = Modifier.size(48.dp),
                        tint = MaterialTheme.colorScheme.primary,
                    )
                    Text(
                        text = stringResource(R.string.mobile_content_preview_unavailable),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 8.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun ContentLibraryTextPreview(
    item: UnifiedContentDto,
    repository: UgsHubRepository,
    modifier: Modifier = Modifier,
) {
    var textPreview by remember(item.id) { mutableStateOf<String?>(null) }
    var loading by remember(item.id) { mutableStateOf(true) }

    LaunchedEffect(item.id) {
        loading = true
        textPreview =
            withContext(Dispatchers.IO) {
                repository.fetchContentTextPreview(item.id)
            }
        loading = false
    }

    when {
        loading ->
            Box(modifier = modifier, contentAlignment = Alignment.Center) {
                CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
            }
        !textPreview.isNullOrBlank() ->
            Text(
                text = textPreview!!,
                modifier = modifier.verticalScroll(rememberScrollState()),
                style = MaterialTheme.typography.bodySmall,
                fontFamily = FontFamily.Monospace,
            )
        else ->
            Box(modifier = modifier, contentAlignment = Alignment.Center) {
                Text(
                    text = stringResource(R.string.mobile_content_preview_unavailable),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
    }
}

internal suspend fun loadContentPreviewBitmap(
    context: Context,
    item: UnifiedContentDto,
    maxSizePx: Int = 768,
): Bitmap? {
    ContentLibraryPreviewCache.get(item.id)?.let { return it }
    val thumbnailUrl = contentListThumbnailUrl(item) ?: return null
    loadBitmapFromUrl(context, thumbnailUrl, maxSizePx)?.let { bitmap ->
        ContentLibraryPreviewCache.put(item.id, bitmap)
        return ContentLibraryPreviewCache.get(item.id)
    }
    // No /download fallback after missing/failed stored thumb (canon: avoid Seaweed hammer).
    return null
}

private suspend fun loadBitmapFromUrl(
    context: Context,
    url: String,
    maxSizePx: Int,
): Bitmap? {
    val result =
        runCatching {
            context.imageLoader.execute(
                ImageRequest.Builder(context)
                    .data(url)
                    .size(maxSizePx)
                    .allowHardware(false)
                    .build(),
            )
        }.getOrNull() ?: return null
    return (result.drawable as? BitmapDrawable)?.bitmap
}

@Composable
internal fun ContentLibraryThumbnail(
    item: UnifiedContentDto,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(12.dp)
    if (supportsListThumbnail(item)) {
        ContentLibraryCachedPreviewImage(
            item = item,
            modifier =
                modifier
                    .size(52.dp)
                    .clip(shape),
            contentScale = ContentScale.Crop,
            showLoadingIndicator = false,
        )
    } else {
        ContentLibraryThumbnailFallback(
            item = item,
            modifier =
                modifier
                    .size(52.dp)
                    .clip(shape),
        )
    }
}

@Composable
internal fun ContentLibraryCachedPreviewImage(
    item: UnifiedContentDto,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Fit,
    showLoadingIndicator: Boolean = true,
) {
    val context = LocalContext.current
    var bitmap by remember(item.id) { mutableStateOf(ContentLibraryPreviewCache.get(item.id)) }
    var loading by remember(item.id) { mutableStateOf(bitmap == null) }

    LaunchedEffect(item.id) {
        if (bitmap != null) return@LaunchedEffect
        loading = true
        val loaded = loadContentPreviewBitmap(context, item, maxSizePx = if (contentScale == ContentScale.Crop) 256 else 1024)
        bitmap = loaded
        loading = false
    }

    when {
        bitmap != null ->
            Image(
                bitmap = bitmap!!.asImageBitmap(),
                contentDescription = null,
                modifier = modifier,
                contentScale = contentScale,
            )
        loading && showLoadingIndicator ->
            Box(modifier = modifier.background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f)), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(modifier = Modifier.size(22.dp), strokeWidth = 2.dp)
            }
        else ->
            ContentLibraryThumbnailFallback(
                item = item,
                modifier = modifier,
            )
    }
}

@Composable
internal fun ContentLibraryThumbnailFallback(
    item: UnifiedContentDto,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier.background(MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.55f)),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = contentTypeIcon(item),
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(24.dp),
        )
    }
}

internal fun retainContentPreviewCache(knownIds: Collection<String>) {
    ContentLibraryPreviewCache.retainOnly(knownIds.toSet())
}
