/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EWDesk hero video (inline ExoPlayer) and audio row wired to the shared Empery media player dock.
 *
 * Invariants:
 * - Hero audio does not create a second ExoPlayer; playback goes through [EmperyMediaPlayerHolder].
 *
 * Related:
 * - FeedFeature.kt FeedPostCard, EmperyNowPlayingDock
 */
package feature.feed

import android.view.ViewGroup
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.ui.PlayerView
import okhttp3.OkHttpClient
import world.empery.mobile.core.media.EmperyMediaPlayerHolder
import world.empery.mobile.core.media.EmperyMediaStreamCache
import world.empery.mobile.core.media.EmperyMediaTrack
import world.empery.mobile.core.media.R as MediaR
import world.empery.mobile.core.ui.PremiumRowSurface

@Composable
internal fun EwDeskHeroVideo(
    uri: String,
    httpClient: OkHttpClient,
    modifier: Modifier = Modifier,
    aspectRatio: Float = 16f / 9f,
) {
    val context = LocalContext.current
    val exoPlayer =
        remember(uri) {
            val engine =
                DefaultMediaSourceFactory(OkHttpDataSource.Factory(httpClient))
            ExoPlayer.Builder(context).setMediaSourceFactory(engine).build().apply {
                setMediaItem(MediaItem.fromUri(uri))
                volume = 1f
            }
        }

    var playErrorHint by remember { mutableStateOf<String?>(null) }

    DisposableEffect(exoPlayer) {
        playErrorHint = null
        val listener =
            object : Player.Listener {
                override fun onPlayerError(error: PlaybackException) {
                    playErrorHint =
                        error.localizedMessage?.takeIf { it.isNotBlank() }
                            ?: context.getString(R.string.feed_video_error)
                }
            }

        exoPlayer.addListener(listener)
        exoPlayer.prepare()

        onDispose {
            exoPlayer.removeListener(listener)
            exoPlayer.release()
        }
    }

    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .aspectRatio(aspectRatio)
                .clip(RoundedCornerShape(14.dp)),
    ) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = {
                PlayerView(it).apply {
                    layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT,
                    )
                    player = exoPlayer
                    useController = true
                    setShowBuffering(PlayerView.SHOW_BUFFERING_ALWAYS)
                    setKeepContentOnPlayerReset(true)
                    setBackgroundColor(android.graphics.Color.TRANSPARENT)
                }
            },
            update = { v -> v.player = exoPlayer },
        )

        playErrorHint?.let { hint ->
            Surface(
                modifier = Modifier.fillMaxSize(),
                tonalElevation = 4.dp,
                color = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.92f),
            ) {
                Text(
                    text = hint,
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 12.dp, vertical = 12.dp),
                    style = MaterialTheme.typography.bodySmall,
                    textAlign = TextAlign.Center,
                    color = MaterialTheme.colorScheme.onErrorContainer,
                )
            }
        }
    }
}

@Composable
internal fun EwDeskHeroAudio(
    trackId: String,
    uri: String,
    label: String,
    modifier: Modifier = Modifier,
) {
    val mediaState by EmperyMediaPlayerHolder.controller.state.collectAsStateWithLifecycle()
    val cachedContentIds by EmperyMediaPlayerHolder.cachedContentIds.collectAsStateWithLifecycle()
    val ewDeskSourceLabel = stringResource(R.string.feed_audio_source)
    val isCurrentTrack = mediaState.track?.id == trackId
    val isPlaying = isCurrentTrack && mediaState.isPlaying
    val isLoading = isCurrentTrack && mediaState.isLoading
    val isOfflineCached = trackId in cachedContentIds || EmperyMediaStreamCache.isCached(trackId)

    LaunchedEffect(trackId, uri) {
        EmperyMediaStreamCache.prefetchContent(trackId, uri)
    }

    PremiumRowSurface(
        modifier = modifier.fillMaxWidth(),
        containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.86f),
        borderColor = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.34f),
    ) {
        Icon(
            Icons.AutoMirrored.Filled.VolumeUp,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.padding(start = 6.dp),
        )
        IconButton(
            onClick = {
                if (isCurrentTrack) {
                    EmperyMediaPlayerHolder.controller.togglePlayPause()
                } else {
                    EmperyMediaPlayerHolder.controller.play(
                        EmperyMediaTrack(
                            id = trackId,
                            title = label,
                            uri = uri,
                            mimeType = "audio/mpeg",
                            subtitle = ewDeskSourceLabel,
                        ),
                    )
                }
            },
        ) {
            when {
                isLoading ->
                    CircularProgressIndicator(
                        modifier = Modifier.padding(8.dp),
                        strokeWidth = 2.dp,
                    )
                isPlaying ->
                    Icon(
                        imageVector = Icons.Filled.Pause,
                        contentDescription = stringResource(R.string.feed_media_pause_cd),
                        tint = MaterialTheme.colorScheme.primary,
                    )
                else ->
                    Icon(
                        imageVector = Icons.Filled.PlayArrow,
                        contentDescription = stringResource(R.string.feed_media_play_cd),
                        tint = MaterialTheme.colorScheme.primary,
                    )
            }
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                label,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                when {
                    isLoading -> stringResource(R.string.feed_audio_loading)
                    isPlaying -> stringResource(R.string.feed_audio_playing)
                    isCurrentTrack -> stringResource(R.string.feed_audio_paused)
                    else -> stringResource(R.string.feed_audio_tap_play)
                },
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (isOfflineCached) {
                Text(
                    text = stringResource(MediaR.string.empery_media_offline_ready),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary,
                    maxLines = 1,
                )
            }
        }
    }
}
