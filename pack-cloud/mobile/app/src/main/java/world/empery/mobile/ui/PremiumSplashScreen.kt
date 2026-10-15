/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Optional post-theme Compose splash: framed MP4 preloader at 3× speed with fade-out,
 * Lottie slot, or static brand.
 *
 * Invariants:
 * - Must not gate AppContainer / SecureTokenStore (already created in MobileApp.onCreate).
 * - Must not call SplashScreen.setKeepOnScreenCondition waiting on token store.
 * - Video path fades out then dismisses; hard max duration prevents a stuck decoder.
 * - Video is framed (not full-bleed) and plays at [PREMIUM_SPLASH_VIDEO_SPEED].
 *
 * Related:
 * - PremiumSplashSupport.kt, PremiumSplashGate.kt, MainActivity installSplashScreen, themes.xml
 * - res/raw/start_app_mobile.mp4
 */
package world.empery.mobile.ui

import android.net.Uri
import android.os.Build
import android.widget.VideoView
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.airbnb.lottie.compose.LottieAnimation
import com.airbnb.lottie.compose.LottieCompositionSpec
import com.airbnb.lottie.compose.animateLottieCompositionAsState
import com.airbnb.lottie.compose.rememberLottieComposition
import kotlinx.coroutines.delay
import world.empery.mobile.R

/**
 * Full-bleed premium splash overlay. Dismiss via [onFinished] after video fade, Lottie, or static timeout.
 * Does not interact with auth bootstrap.
 */
@Composable
fun PremiumSplashScreen(
    onFinished: () -> Unit,
    modifier: Modifier = Modifier,
    assetFileName: String = PREMIUM_SPLASH_LOTTIE_ASSET,
    staticHoldMs: Long = 700L,
) {
    val context = LocalContext.current
    val videoResId =
        remember {
            context.resources.getIdentifier(
                PREMIUM_SPLASH_VIDEO_RAW_NAME,
                "raw",
                context.packageName,
            )
        }
    val videoExists = videoResId != 0
    val lottieExists =
        remember(assetFileName) {
            runCatching {
                context.assets.open(assetFileName).use { true }
            }.getOrDefault(false)
        }
    val mode = resolvePremiumSplashMode(videoExists = videoExists, lottieExists = lottieExists)
    val splashCd = stringResource(R.string.premium_splash_cd)
    val onFinishedState = rememberUpdatedState(onFinished)

    Box(
        modifier =
            modifier
                .fillMaxSize()
                .background(Color.Black)
                .semantics { contentDescription = splashCd },
        contentAlignment = Alignment.Center,
    ) {
        when (mode) {
            PremiumSplashMode.Video -> {
                PremiumSplashVideo(
                    videoResId = videoResId,
                    onFinished = { onFinishedState.value() },
                )
            }
            PremiumSplashMode.Lottie -> {
                val composition by rememberLottieComposition(LottieCompositionSpec.Asset(assetFileName))
                val progress by
                    animateLottieCompositionAsState(
                        composition = composition,
                        iterations = 1,
                        speed = 1f,
                    )
                if (composition != null) {
                    LottieAnimation(
                        composition = composition,
                        progress = { progress },
                        modifier = Modifier.size(160.dp),
                    )
                } else {
                    PremiumSplashStaticMark()
                }
                LaunchedEffect(composition, progress) {
                    if (composition == null) {
                        delay(staticHoldMs)
                        onFinishedState.value()
                    } else if (progress >= 0.99f) {
                        onFinishedState.value()
                    }
                }
            }
            PremiumSplashMode.StaticFallback -> {
                PremiumSplashStaticMark()
                LaunchedEffect(Unit) {
                    delay(staticHoldMs)
                    onFinishedState.value()
                }
            }
        }
    }
}

@Composable
private fun PremiumSplashVideo(
    videoResId: Int,
    onFinished: () -> Unit,
) {
    val overlayAlpha = remember { Animatable(1f) }
    var playbackEnded by remember { mutableStateOf(false) }
    var videoViewRef by remember { mutableStateOf<VideoView?>(null) }
    val finishedOnce = remember { mutableStateOf(false) }

    fun requestEnd() {
        if (!playbackEnded) playbackEnded = true
    }

    LaunchedEffect(playbackEnded) {
        if (!playbackEnded || finishedOnce.value) return@LaunchedEffect
        finishedOnce.value = true
        overlayAlpha.animateTo(0f, animationSpec = tween(PREMIUM_SPLASH_FADE_OUT_MS.toInt()))
        onFinished()
    }

    LaunchedEffect(Unit) {
        delay(PREMIUM_SPLASH_VIDEO_MAX_MS)
        requestEnd()
    }

    DisposableEffect(Unit) {
        onDispose {
            videoViewRef?.stopPlayback()
            videoViewRef = null
        }
    }

    val frameShape = RoundedCornerShape(28.dp)
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .alpha(overlayAlpha.value)
                .background(Color.Black)
                .padding(horizontal = 28.dp, vertical = 48.dp),
        contentAlignment = Alignment.Center,
    ) {
        AndroidView(
            factory = { ctx ->
                VideoView(ctx).apply {
                    videoViewRef = this
                    setVideoURI(
                        Uri.parse("android.resource://${ctx.packageName}/$videoResId"),
                    )
                    setOnPreparedListener { mp ->
                        mp.isLooping = false
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            runCatching {
                                mp.playbackParams =
                                    mp.playbackParams.setSpeed(PREMIUM_SPLASH_VIDEO_SPEED)
                            }
                        }
                        start()
                    }
                    setOnCompletionListener { requestEnd() }
                    setOnErrorListener { _, _, _ ->
                        requestEnd()
                        true
                    }
                }
            },
            modifier =
                Modifier
                    .fillMaxWidth(0.92f)
                    .aspectRatio(9f / 16f)
                    .clip(frameShape)
                    .border(
                        width = 1.5.dp,
                        color = Color.White.copy(alpha = 0.28f),
                        shape = frameShape,
                    ),
            update = { view ->
                videoViewRef = view
            },
        )
    }
}

@Composable
private fun PremiumSplashStaticMark() {
    Text(
        text = "Empery",
        style = MaterialTheme.typography.headlineMedium,
        fontWeight = FontWeight.SemiBold,
        color = MaterialTheme.colorScheme.onBackground,
    )
}
