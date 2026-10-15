/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared message chrome shell driven by [ChatVisualStrategy] (bubble Surface vs text-only Column).
 *
 * Invariants:
 * - Same content slot for both strategies — no duplicated message body logic.
 *
 * Related:
 * - ChatVisualStrategy.kt, ChatFeature.kt
 */
package feature.chat

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ChatMessageVisualChrome(
    strategy: ChatVisualStrategy,
    isMine: Boolean,
    isGroupedWithPrev: Boolean,
    maxWidth: Dp,
    onLongClick: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    val shape = strategy.bubbleShape(isMine = isMine, isGroupedWithPrev = isGroupedWithPrev)
    val clickable =
        Modifier.combinedClickable(
            onClick = {},
            onLongClick = onLongClick,
        )
    val body: @Composable ColumnScope.() -> Unit = content

    Row(
        modifier =
            modifier
                .widthIn(max = maxWidth)
                .height(IntrinsicSize.Min),
        verticalAlignment = Alignment.Top,
    ) {
        if (strategy.showStructuralTimeline && !isMine) {
            // Thread-line: thin vertical rail tying consecutive partner messages in a flow.
            Box(
                modifier =
                    Modifier
                        .padding(
                            top = if (isGroupedWithPrev) 0.dp else 4.dp,
                            end = 10.dp,
                        )
                        .width(strategy.structuralLineWidth)
                        .fillMaxHeight()
                        .background(
                            MaterialTheme.colorScheme.onSurface.copy(
                                alpha = strategy.threadLineAlpha,
                            ),
                        )
                        .testTag(CHAT_STRUCTURAL_TIMELINE_TAG),
            )
        }

        if (strategy.showBubbleSurface) {
            Surface(
                modifier = Modifier.weight(1f, fill = false).then(clickable),
                color =
                    if (isMine) {
                        MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.95f)
                    } else {
                        MaterialTheme.colorScheme.surface.copy(alpha = 0.94f)
                    },
                contentColor =
                    if (isMine) {
                        MaterialTheme.colorScheme.onPrimaryContainer
                    } else {
                        MaterialTheme.colorScheme.onSurface
                    },
                shape = shape,
                tonalElevation =
                    if (isMine) strategy.bubbleTonalElevationMine else strategy.bubbleTonalElevationOther,
                shadowElevation = strategy.bubbleShadowElevation,
                border =
                    if (strategy.bubbleBorderWidth > 0.dp) {
                        BorderStroke(
                            strategy.bubbleBorderWidth,
                            if (isMine) {
                                MaterialTheme.colorScheme.primary.copy(alpha = 0.24f)
                            } else {
                                MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.42f)
                            },
                        )
                    } else {
                        null
                    },
            ) {
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(
                                horizontal = strategy.bubbleHorizontalPadding,
                                vertical = strategy.bubbleVerticalPadding,
                            ),
                    content = body,
                )
            }
        } else {
            Column(
                modifier =
                    Modifier
                        .weight(1f, fill = false)
                        .fillMaxWidth()
                        .then(clickable)
                        .padding(
                            horizontal = strategy.bubbleHorizontalPadding,
                            vertical = strategy.bubbleVerticalPadding,
                        )
                        .background(Color.Transparent),
                content = body,
            )
        }
    }
}
