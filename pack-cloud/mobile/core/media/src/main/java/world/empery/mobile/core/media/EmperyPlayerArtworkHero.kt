/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Artwork-driven hero backdrop (blurred cover + glass gradient) for expanded player.
 *
 * Invariants:
 * - Blur via RenderEffect on API 31+; palette gradient fallback on older devices.
 *
 * Related:
 * - EmperyExpandedPlayerSheet.kt, EmperyTrackArtwork
 */
package world.empery.mobile.core.media

import android.graphics.drawable.BitmapDrawable
import android.os.Build
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asComposeRenderEffect
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import android.graphics.RenderEffect
import android.graphics.Shader
import androidx.palette.graphics.Palette
import coil.compose.SubcomposeAsyncImage
import coil.imageLoader
import coil.request.ImageRequest

data class ArtworkBackdropColors(
    val dominant: Color,
    val muted: Color,
    val vibrant: Color,
) {
    companion object {
        val Default =
            ArtworkBackdropColors(
                dominant = Color(0xFF5C6BC0),
                muted = Color(0xFF3949AB),
                vibrant = Color(0xFF7986CB),
            )
    }
}

@Composable
fun rememberArtworkBackdropColors(artworkUrl: String?): ArtworkBackdropColors {
    val context = LocalContext.current
    var colors by remember(artworkUrl) { mutableStateOf(ArtworkBackdropColors.Default) }
    LaunchedEffect(artworkUrl) {
        val url = artworkUrl?.trim()?.takeIf { it.isNotEmpty() } ?: return@LaunchedEffect
        val result =
            runCatching {
                context.imageLoader.execute(
                    ImageRequest.Builder(context)
                        .data(url)
                        .allowHardware(false)
                        .build(),
                )
            }.getOrNull() ?: return@LaunchedEffect
        val bitmap = (result.drawable as? BitmapDrawable)?.bitmap ?: return@LaunchedEffect
        val palette = Palette.from(bitmap).generate()
        val dominant = palette.getDominantColor(0xFF5C6BC0.toInt())
        val muted = palette.getMutedColor(dominant)
        val vibrant = palette.getVibrantColor(dominant)
        colors =
            ArtworkBackdropColors(
                dominant = Color(dominant),
                muted = Color(muted),
                vibrant = Color(vibrant),
            )
    }
    return colors
}

private fun Modifier.artworkBackdropBlur(blurRadius: Dp): Modifier {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return this
    val radiusPx = blurRadius.value
    return this.graphicsLayer {
        renderEffect =
            RenderEffect
                .createBlurEffect(radiusPx, radiusPx, Shader.TileMode.CLAMP)
                .asComposeRenderEffect()
    }
}

@Composable
fun EmperyPlayerArtworkHero(
    track: EmperyMediaTrack,
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit,
) {
    val artworkUrl = track.artworkUrl?.trim()?.takeIf { it.isNotEmpty() }
    val backdropColors = rememberArtworkBackdropColors(artworkUrl)
    val surfaceColor = MaterialTheme.colorScheme.surface
    val shape = RoundedCornerShape(28.dp)
    val blurRadius = 36.dp

    Box(
        modifier =
            modifier
                .clip(shape),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(
                        Brush.linearGradient(
                            listOf(
                                backdropColors.vibrant.copy(alpha = 0.82f),
                                backdropColors.muted.copy(alpha = 0.72f),
                                backdropColors.dominant.copy(alpha = 0.58f),
                            ),
                        ),
                    ),
        )
        if (artworkUrl != null) {
            SubcomposeAsyncImage(
                model = artworkUrl,
                contentDescription = null,
                modifier =
                    Modifier
                        .fillMaxSize()
                        .graphicsLayer {
                            scaleX = 1.18f
                            scaleY = 1.18f
                        }
                        .artworkBackdropBlur(blurRadius),
                contentScale = ContentScale.Crop,
                loading = {},
                error = {},
            )
        }
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            colorStops =
                                arrayOf(
                                    0f to backdropColors.vibrant.copy(alpha = 0.28f),
                                    0.45f to backdropColors.dominant.copy(alpha = 0.42f),
                                    1f to surfaceColor.copy(alpha = 0.88f),
                                ),
                        ),
                    ),
        )
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            listOf(
                                Color.White.copy(alpha = 0.10f),
                                Color.Transparent,
                                surfaceColor.copy(alpha = 0.24f),
                            ),
                        ),
                    ),
        )
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(vertical = 20.dp),
            contentAlignment = Alignment.Center,
            content = content,
        )
    }
}

@Composable
fun EmperyPlayerDockDragHandle(
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .padding(top = 4.dp, bottom = 2.dp),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth(0.12f)
                    .height(4.dp)
                    .clip(RoundedCornerShape(999.dp))
                    .background(MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.42f)),
        )
    }
}
