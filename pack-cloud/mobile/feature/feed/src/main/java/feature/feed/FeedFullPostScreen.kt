/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * feed-003: full post screen with Markdown body, hero media, and share/copy controls.
 */
package feature.feed

import android.content.ClipData
import android.content.Intent
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil.compose.SubcomposeAsyncImage
import coil.request.ImageRequest
import okhttp3.OkHttpClient
import world.empery.mobile.core.network.EwDeskLinkedMediaUrls
import world.empery.mobile.core.storage.FeedPostEntity
import world.empery.mobile.core.ui.PremiumGlassCard
import world.empery.mobile.core.ui.rememberMobileScaleChromePolicy

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeedFullPostScreen(
    post: FeedPostEntity,
    apiRootUrl: String,
    authenticatedOkHttpClient: OkHttpClient,
    onBack: () -> Unit,
    onOpenApp: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val chrome = rememberMobileScaleChromePolicy()
    val rewritten = EwDeskLinkedMediaUrls.rewriteEwDeskMarkdownAssetUrls(post.body, apiRootUrl)
    val markdownOptions = rememberFeedMarkdownParseOptions()
    val customHandler = rememberFeedUriHandler(onOpenApp)
    val meta =
        remember(post.publishedAt, post.updatedAt, context) {
            formatEwDeskMetaLine(context, post.publishedAt, post.updatedAt)
        }
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
    val heroAspect = ewDeskHeroAspectRatio(chrome.shouldStackChromeActions)
    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.feed_full_post_title)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.feed_full_post_back_cd),
                        )
                    }
                },
                actions = {
                    IconButton(onClick = { shareFeedPost(context, post.title, post.body) }) {
                        Icon(Icons.Filled.Share, contentDescription = stringResource(R.string.feed_share_cd))
                    }
                    IconButton(onClick = { copyFeedPostLink(context, post.id) }) {
                        Text(stringResource(R.string.feed_copy_link))
                    }
                },
            )
        },
    ) { inner ->
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(inner)
                    .padding(16.dp)
                    .verticalScroll(rememberScrollState()),
        ) {
            PremiumGlassCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Text(post.title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    if (meta.isNotBlank()) {
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(meta, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(stringResource(R.string.feed_source_label), style = MaterialTheme.typography.labelSmall)
                }
            }
            Spacer(modifier = Modifier.height(12.dp))
            videoUrl?.let { url ->
                EwDeskHeroVideo(
                    uri = url,
                    httpClient = authenticatedOkHttpClient,
                    aspectRatio = heroAspect,
                    modifier = Modifier.fillMaxWidth(),
                )
                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            }
            heroImageUrl?.takeIf { videoUrl == null }?.let { img ->
                SubcomposeAsyncImage(
                    model =
                        ImageRequest.Builder(context)
                            .data(img)
                            .crossfade(true)
                            .build(),
                    contentDescription = stringResource(R.string.feed_hero_image_cd),
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .aspectRatio(heroAspect)
                            .clip(RoundedCornerShape(if (chrome.shouldStackChromeActions) 14.dp else 22.dp)),
                    contentScale = ContentScale.Crop,
                )
                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            }
            audioUrl?.let { url ->
                EwDeskHeroAudio(
                    trackId = audioContentId!!,
                    uri = url,
                    label = stringResource(R.string.feed_audio_label),
                    modifier = Modifier.fillMaxWidth(),
                )
                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            }
            CompositionLocalProvider(LocalUriHandler provides customHandler) {
                FeedMarkdownBody(
                    markdown = rewritten,
                    markdownParseOptions = markdownOptions,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}

private fun copyFeedPostLink(context: Context, postId: String) {
    val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    val link = "${context.packageName}:/nav/feed/$postId"
    cm.setPrimaryClip(ClipData.newPlainText("feed", link))
}

private fun shareFeedPost(context: Context, title: String, body: String) {
    val intent =
        Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, title)
            putExtra(Intent.EXTRA_TEXT, "$title\n\n${body.take(20_000)}")
        }
    runCatching { context.startActivity(Intent.createChooser(intent, context.getString(R.string.feed_share_chooser))) }
}
