/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Swipe-down gesture on media dock to stop playback and dismiss the mini player.
 */
package world.empery.mobile.core.media

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

fun Modifier.emperyDockSwipeToDismiss(
    onDismiss: () -> Unit,
    enabled: Boolean = true,
): Modifier =
    composed {
        if (!enabled) return@composed this
        val density = LocalDensity.current
        val dismissThresholdPx = with(density) { 72.dp.toPx() }
        var offsetY by remember { mutableFloatStateOf(0f) }
        val scope = rememberCoroutineScope()
        this
            .graphicsLayer {
                translationY = offsetY
                val progress = (offsetY / dismissThresholdPx).coerceIn(0f, 1f)
                alpha = 1f - progress * 0.35f
            }
            .pointerInput(onDismiss) {
                detectVerticalDragGestures(
                    onDragEnd = {
                        if (offsetY >= dismissThresholdPx) {
                            onDismiss()
                            offsetY = 0f
                        } else {
                            scope.launch {
                                val anim = Animatable(offsetY)
                                anim.animateTo(0f, tween(durationMillis = 180))
                                offsetY = 0f
                            }
                        }
                    },
                    onVerticalDrag = { _, dragAmount ->
                        offsetY = (offsetY + dragAmount).coerceAtLeast(0f)
                    },
                )
            }
    }
