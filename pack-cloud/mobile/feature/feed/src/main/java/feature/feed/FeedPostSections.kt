/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EWDesk feed post list/grid and rich post cards (hero media, markdown, share).
 *
 * Invariants:
 * - Same package as FeedFeature; public [EwDeskFeedScreen] API unchanged for nav.
 *
 * Related:
 * - FeedFeature.kt, EwDeskFeedHeroMedia.kt, FeedMarkdownRender.kt
 */
package feature.feed

import android.content.Context
import android.content.Intent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.UriHandler
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImagePainter
import coil.compose.SubcomposeAsyncImage
import coil.request.ImageRequest
import com.halilibo.richtext.markdown.MarkdownParseOptions
import kotlinx.coroutines.delay
import okhttp3.OkHttpClient
import world.empery.mobile.core.media.EmperyMediaStreamCache
import world.empery.mobile.core.media.EmperyMediaTrack
import world.empery.mobile.core.network.EwDeskLinkedMediaUrls
import world.empery.mobile.core.storage.FeedPostEntity
import world.empery.mobile.core.ui.MobileAdaptiveColumns
import world.empery.mobile.core.ui.MobileIconButton
import world.empery.mobile.core.ui.PremiumBadge
import world.empery.mobile.core.ui.PremiumDividerGlow
import world.empery.mobile.core.ui.PremiumGlassCard
import world.empery.mobile.core.ui.PremiumGlassShape
import world.empery.mobile.core.ui.rememberMobileScaleChromePolicy

internal fun Context.shareEwDeskPost(title: String, plainBody: String) {
    val trimmedTitle = title.trim()
    val text =
        buildString(trimmedTitle.length + plainBody.length + 16) {
            appendLine(trimmedTitle)
            appendLine()
            append(plainBody.trim().take(20_000))
        }
    val intent =
        Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, trimmedTitle)
            putExtra(Intent.EXTRA_TEXT, text)
        }
    runCatching {
        startActivity(Intent.createChooser(intent, getString(R.string.feed_share_chooser)))
    }
}

@Composable
internal fun FeedPostList(
    posts: List<FeedPostEntity>,
    focusPostId: String?,
    onFeedFocusConsumed: () -> Unit,
    apiRootUrl: String,
    authenticatedOkHttpClient: OkHttpClient,
    onOpenApp: (String) -> Unit,
    topContent: (@Composable () -> Unit)? = null,
) {
    val context = LocalContext.current
    val listState = rememberLazyListState()

    LaunchedEffect(focusPostId, posts) {
        val id = focusPostId ?: return@LaunchedEffect
        val index = posts.indexOfFirst { it.id == id }
        if (index >= 0) {
            delay(80)
            listState.scrollToItem(index)
            onFeedFocusConsumed()
        }
    }

    LaunchedEffect(posts, apiRootUrl) {
        val tracks =
            posts.mapNotNull { post ->
                val contentId = post.audioContentId?.trim()?.takeIf { it.isNotEmpty() } ?: return@mapNotNull null
                EmperyMediaTrack(
                    id = contentId,
                    title = post.title,
                    uri = EwDeskLinkedMediaUrls.linkedAudio(apiRootUrl, contentId),
                    mimeType = "audio/mpeg",
                    subtitle = null,
                )
            }
        if (tracks.isNotEmpty()) {
            EmperyMediaStreamCache.prefetchTracks(tracks)
        }
    }

    val markdownOptions = rememberFeedMarkdownParseOptions()
    val customUriHandler = rememberFeedUriHandler(onOpenApp)

    LazyColumn(
        state = listState,
        modifier =
            Modifier.fillMaxSize().semantics { contentDescription = context.getString(R.string.feed_list_cd) },
        contentPadding = PaddingValues(bottom = 12.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        topContent?.let { content ->
            item(key = "feed_top_content", contentType = "feed_top_content") {
                content()
            }
        }
        items(
            items = posts,
            key = { it.id },
            contentType = { "ewdesk_post" },
        ) { post ->
            FeedPostCard(
                post = post,
                markdownParseOptions = markdownOptions,
                customUriHandler = customUriHandler,
                apiRootUrl = apiRootUrl,
                authenticatedOkHttpClient = authenticatedOkHttpClient,
            )
        }
    }
}

@Composable
internal fun FeedPostGrid(
    posts: List<FeedPostEntity>,
    focusPostId: String?,
    onFeedFocusConsumed: () -> Unit,
    apiRootUrl: String,
    authenticatedOkHttpClient: OkHttpClient,
    onOpenApp: (String) -> Unit,
    columnCount: Int,
    topContent: (@Composable () -> Unit)? = null,
) {
    val context = LocalContext.current
    val gridState = rememberLazyGridState()
    LaunchedEffect(focusPostId, posts) {
        val id = focusPostId ?: return@LaunchedEffect
        val index = posts.indexOfFirst { it.id == id }
        if (index >= 0) {
            delay(80)
            gridState.scrollToItem(index)
            onFeedFocusConsumed()
        }
    }
    LaunchedEffect(posts, apiRootUrl) {
        val tracks =
            posts.mapNotNull { post ->
                val contentId = post.audioContentId?.trim()?.takeIf { it.isNotEmpty() } ?: return@mapNotNull null
                EmperyMediaTrack(
                    id = contentId,
                    title = post.title,
                    uri = EwDeskLinkedMediaUrls.linkedAudio(apiRootUrl, contentId),
                    mimeType = "audio/mpeg",
                    subtitle = null,
                )
            }
        if (tracks.isNotEmpty()) {
            EmperyMediaStreamCache.prefetchTracks(tracks)
        }
    }
    val markdownOptions = rememberFeedMarkdownParseOptions()
    val customUriHandler = rememberFeedUriHandler(onOpenApp)
    LazyVerticalGrid(
        state = gridState,
        columns = GridCells.Fixed(columnCount),
        modifier =
            Modifier.fillMaxSize().semantics { contentDescription = context.getString(R.string.feed_list_cd) },
        horizontalArrangement = Arrangement.spacedBy(14.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        topContent?.let { content ->
            item(
                key = "feed_top_content",
                contentType = "feed_top_content",
                span = { GridItemSpan(maxLineSpan) },
            ) {
                content()
            }
        }
        items(
            items = posts,
            key = { it.id },
            contentType = { "ewdesk_post" },
        ) { post ->
            FeedPostCard(
                post = post,
                markdownParseOptions = markdownOptions,
                customUriHandler = customUriHandler,
                apiRootUrl = apiRootUrl,
                authenticatedOkHttpClient = authenticatedOkHttpClient,
            )
        }
    }
}

@Composable
internal fun FeedPostListAdaptive(
    posts: List<FeedPostEntity>,
    focusPostId: String?,
    onFeedFocusConsumed: () -> Unit,
    apiRootUrl: String,
    authenticatedOkHttpClient: OkHttpClient,
    onOpenApp: (String) -> Unit,
    topContent: (@Composable () -> Unit)? = null,
) {
    MobileAdaptiveColumns { columnCount ->
        if (columnCount <= 1) {
            FeedPostList(
                posts = posts,
                focusPostId = focusPostId,
                onFeedFocusConsumed = onFeedFocusConsumed,
                apiRootUrl = apiRootUrl,
                authenticatedOkHttpClient = authenticatedOkHttpClient,
                onOpenApp = onOpenApp,
                topContent = topContent,
            )
        } else {
            FeedPostGrid(
                posts = posts,
                focusPostId = focusPostId,
                onFeedFocusConsumed = onFeedFocusConsumed,
                apiRootUrl = apiRootUrl,
                authenticatedOkHttpClient = authenticatedOkHttpClient,
                onOpenApp = onOpenApp,
                columnCount = columnCount,
                topContent = topContent,
            )
        }
    }
}

@Composable
internal fun FeedPostCard(
    post: FeedPostEntity,
    markdownParseOptions: MarkdownParseOptions,
    customUriHandler: UriHandler,
    apiRootUrl: String,
    authenticatedOkHttpClient: OkHttpClient,
) {
    val ctx = LocalContext.current
    val chrome = rememberMobileScaleChromePolicy()
    val previewChars = ewDeskBodyPreviewChars(chrome)
    val titleMaxLines = if (chrome.shouldStackChromeActions) 2 else 3
    val heroAspect = ewDeskHeroAspectRatio(chrome.shouldStackChromeActions)
    val heroCornerRadius = if (chrome.shouldStackChromeActions) 14.dp else 22.dp
    val rewrittenBody =
        remember(post.body, apiRootUrl) {
            EwDeskLinkedMediaUrls.rewriteEwDeskMarkdownAssetUrls(post.body, apiRootUrl)
        }
    val plainBodyFull =
        remember(rewrittenBody) {
            ewDeskMarkdownToPlain(rewrittenBody)
        }
    val hasBody = rewrittenBody.trim().isNotEmpty()
    val shouldCollapse = shouldCollapseEwDeskBody(rewrittenBody, plainBodyFull)
    val readMinutes =
        remember(plainBodyFull) {
            if (plainBodyFull.isBlank()) null else estimateFeedReadMinutes(plainBodyFull)
        }
    var expanded by rememberSaveable(post.id) { mutableStateOf(false) }

    val videoUrl =
        post.videoContentId?.trim()?.takeIf { it.isNotEmpty() }?.let { id ->
            EwDeskLinkedMediaUrls.linkedVideo(apiRootUrl, id)
        }
    val audioContentId = post.audioContentId?.trim()?.takeIf { it.isNotEmpty() }
    val audioUrl =
        audioContentId?.let { id ->
            EwDeskLinkedMediaUrls.linkedAudio(apiRootUrl, id)
        }
    val heroImageUrl =
        remember(post.imageUrl, post.imageContentId, apiRootUrl) {
            EwDeskLinkedMediaUrls.heroImageLoadUrl(post.imageUrl, apiRootUrl, post.imageContentId)
        }

    PremiumGlassCard(
        modifier =
            Modifier
                .fillMaxWidth()
                .then(
                    if (post.pinned) {
                        Modifier.border(
                            width = 1.5.dp,
                            color = MaterialTheme.colorScheme.primary.copy(alpha = 0.48f),
                            shape = PremiumGlassShape,
                        )
                    } else {
                        Modifier
                    },
                ),
        tonalElevation = if (post.pinned) 8.dp else 4.dp,
    ) {
        Column(
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            if (chrome.shouldStackChromeActions) {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Text(
                        text = post.title,
                        style =
                            if (post.pinned) {
                                MaterialTheme.typography.headlineSmall
                            } else {
                                MaterialTheme.typography.titleLarge
                            },
                        fontWeight = FontWeight.Bold,
                        overflow = TextOverflow.Ellipsis,
                        maxLines = titleMaxLines,
                    )
                    if (post.pinned) {
                        PremiumBadge(text = stringResource(R.string.feed_pinned))
                    }
                }
            } else {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = post.title,
                        style =
                            if (post.pinned) {
                                MaterialTheme.typography.headlineSmall
                            } else {
                                MaterialTheme.typography.titleLarge
                            },
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.weight(1f),
                        overflow = TextOverflow.Ellipsis,
                        maxLines = titleMaxLines,
                    )
                    if (post.pinned) {
                        PremiumBadge(text = stringResource(R.string.feed_pinned))
                    }
                }
            }

            val meta =
                remember(post.publishedAt, post.updatedAt, ctx) {
                    formatEwDeskMetaLine(ctx, post.publishedAt, post.updatedAt)
                }
            if (meta.isNotBlank() || readMinutes != null) {
                Text(
                    text =
                        buildList {
                            if (meta.isNotBlank()) add(meta)
                            readMinutes?.let { add(ctx.getString(R.string.feed_read_time, it)) }
                        }.joinToString(" • "),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = if (chrome.shouldStackChromeActions) 2 else 3,
                    overflow = TextOverflow.Ellipsis,
                )
            }

            videoUrl?.let { url ->
                EwDeskHeroVideo(
                    uri = url,
                    httpClient = authenticatedOkHttpClient,
                    aspectRatio = heroAspect,
                    modifier = Modifier.fillMaxWidth(),
                )
                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
            }

            heroImageUrl?.takeIf { videoUrl == null }?.let { img ->
                SubcomposeAsyncImage(
                    model =
                        ImageRequest.Builder(ctx)
                            .data(img)
                            .crossfade(true)
                            .build(),
                    contentDescription = stringResource(R.string.feed_hero_image_cd),
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .aspectRatio(heroAspect)
                            .clip(RoundedCornerShape(heroCornerRadius)),
                    contentScale = ContentScale.Crop,
                ) {
                    val st = painter.state
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center,
                    ) {
                        when (st) {
                            AsyncImagePainter.State.Empty,
                            is AsyncImagePainter.State.Loading,
                            ->
                                CircularProgressIndicator(Modifier.size(28.dp))

                            is AsyncImagePainter.State.Error -> {
                                Surface(
                                    tonalElevation = 2.dp,
                                    shape = RoundedCornerShape(16.dp),
                                    color = MaterialTheme.colorScheme.surface.copy(alpha = 0.86f),
                                    border =
                                        BorderStroke(
                                            1.dp,
                                            MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.34f),
                                        ),
                                ) {
                                    Text(
                                        stringResource(R.string.feed_image_error),
                                        modifier =
                                            Modifier
                                                .fillMaxWidth()
                                                .padding(16.dp),
                                        style = MaterialTheme.typography.bodySmall,
                                        textAlign = TextAlign.Center,
                                    )
                                }
                            }

                            is AsyncImagePainter.State.Success ->
                                Image(
                                    painter = st.painter,
                                    contentDescription = null,
                                    modifier = Modifier.fillMaxSize(),
                                    contentScale = ContentScale.Crop,
                                )
                        }
                    }
                }
            }

            if (audioUrl != null) {
                EwDeskHeroAudio(
                    trackId = audioContentId!!,
                    uri = audioUrl,
                    label = stringResource(R.string.feed_audio_label),
                    modifier = Modifier.fillMaxWidth(),
                )
                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
            }

            if (hasBody) {
                PremiumDividerGlow(modifier = Modifier.padding(vertical = 2.dp))
                when {
                    !shouldCollapse || expanded ->
                        CompositionLocalProvider(LocalUriHandler provides customUriHandler) {
                            FeedMarkdownBody(
                                markdown = rewrittenBody,
                                markdownParseOptions = markdownParseOptions,
                                modifier = Modifier.fillMaxWidth(),
                            )
                        }

                    else ->
                        Text(
                            text = ewDeskCollapsedPreviewPlain(plainBodyFull, previewChars),
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurface,
                            modifier = Modifier.padding(top = 2.dp),
                        )
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = if (chrome.shouldStackChromeActions) Arrangement.spacedBy(4.dp) else Arrangement.Start,
            ) {
                if (shouldCollapse) {
                    TextButton(onClick = { expanded = !expanded }) {
                        Text(if (expanded) stringResource(R.string.feed_collapse) else stringResource(R.string.feed_expand))
                    }
                }
                if (!chrome.shouldStackChromeActions) {
                    Spacer(modifier = Modifier.weight(1f))
                }
                MobileIconButton(
                    onClick = { ctx.shareEwDeskPost(post.title, plainBodyFull) },
                    contentDescription = ctx.getString(R.string.feed_share_cd),
                ) {
                    Icon(
                        Icons.Filled.Share,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                    )
                }
            }
        }
    }
}
