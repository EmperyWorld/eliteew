/*
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared premium/glass Compose primitives for the native MobileAndroid feature modules.
 *
 * Invariants:
 * - Components are visual-only and must not hold product state or perform network/storage work.
 * - GLASS uses frosted translucent surfaces; PREMIUM uses richer opaque gold-accent panels.
 *
 * Related:
 * - MobileSurfaceStyle.kt, MobileAppTheme.kt, MainActivity.kt
 */
package world.empery.mobile.core.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

val PremiumGlassShape = RoundedCornerShape(22.dp)

private val PremiumComposerShape = RoundedCornerShape(26.dp)
private val PremiumChipShape = RoundedCornerShape(999.dp)

/** Shared rounded shape for chat/UGS composer text fields. */
val PremiumComposerFieldShape = PremiumComposerShape

@Immutable
private data class GlassSurfaceTokens(
    val containerAlpha: Float,
    val borderAlpha: Float,
    val borderAccent: Color,
    val overlayBrush: Brush,
    val elevation: Dp,
)

@Composable
private fun rememberGlassSurfaceTokens(): GlassSurfaceTokens {
    val scheme = MaterialTheme.colorScheme
    val style = LocalMobileSurfaceStyle.current
    return remember(style, scheme) {
        when (style) {
            MobileSurfaceStyle.GLASS ->
                GlassSurfaceTokens(
                    containerAlpha = 0.58f,
                    borderAlpha = 0.52f,
                    borderAccent = Color.White.copy(alpha = 0.55f),
                    overlayBrush =
                        Brush.linearGradient(
                            listOf(
                                Color.White.copy(alpha = 0.28f),
                                Color.Transparent,
                                scheme.primary.copy(alpha = 0.08f),
                            ),
                        ),
                    elevation = 0.dp,
                )
            MobileSurfaceStyle.PREMIUM ->
                GlassSurfaceTokens(
                    containerAlpha = 0.94f,
                    borderAlpha = 0.72f,
                    borderAccent = scheme.primary.copy(alpha = 0.42f),
                    overlayBrush =
                        Brush.linearGradient(
                            listOf(
                                scheme.primary.copy(alpha = 0.16f),
                                Color.Transparent,
                                scheme.tertiary.copy(alpha = 0.12f),
                            ),
                        ),
                    elevation = 4.dp,
                )
            MobileSurfaceStyle.SYSTEM ->
                GlassSurfaceTokens(
                    containerAlpha = 1f,
                    borderAlpha = 0.28f,
                    borderAccent = scheme.outlineVariant,
                    overlayBrush = Brush.linearGradient(listOf(Color.Transparent, Color.Transparent)),
                    elevation = 1.dp,
                )
        }
    }
}

@Composable
fun PremiumGlassCard(
    modifier: Modifier = Modifier,
    tonalElevation: Dp? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val tokens = rememberGlassSurfaceTokens()
    val elevation = tonalElevation ?: tokens.elevation
    Card(
        modifier = modifier,
        shape = PremiumGlassShape,
        colors =
            CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surface.copy(alpha = tokens.containerAlpha),
            ),
        border =
            BorderStroke(
                1.dp,
                tokens.borderAccent.copy(alpha = tokens.borderAlpha),
            ),
        elevation = CardDefaults.cardElevation(defaultElevation = elevation),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(tokens.overlayBrush)
                    .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            content = content,
        )
    }
}

@Composable
fun PremiumIconTile(
    icon: ImageVector,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    size: Dp = 46.dp,
    containerColor: Color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.9f),
    contentColor: Color = MaterialTheme.colorScheme.onPrimaryContainer,
) {
    val style = LocalMobileSurfaceStyle.current
    val tileAlpha =
        when (style) {
            MobileSurfaceStyle.GLASS -> 0.72f
            MobileSurfaceStyle.PREMIUM -> 0.96f
            MobileSurfaceStyle.SYSTEM -> 1f
        }
    val borderAlpha =
        when (style) {
            MobileSurfaceStyle.GLASS -> 0.48f
            MobileSurfaceStyle.PREMIUM -> 0.55f
            MobileSurfaceStyle.SYSTEM -> 0.28f
        }
    val iconSize = (size.value * 0.48f).dp
    Surface(
        modifier = modifier.size(size),
        shape = RoundedCornerShape((size.value * 0.35f).dp.coerceAtLeast(14.dp)),
        color = containerColor.copy(alpha = tileAlpha),
        tonalElevation = if (style == MobileSurfaceStyle.PREMIUM) 3.dp else 1.dp,
        border =
            BorderStroke(
                1.dp,
                MaterialTheme.colorScheme.outlineVariant.copy(alpha = borderAlpha),
            ),
    ) {
        Box(contentAlignment = Alignment.Center) {
            Icon(
                imageVector = icon,
                contentDescription = contentDescription,
                tint = contentColor,
                modifier = Modifier.size(iconSize),
            )
        }
    }
}

@Composable
@Suppress("UNUSED_PARAMETER")
fun PremiumHeroHeader(
    title: String,
    subtitle: String,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    badge: String? = null,
    contentDescription: String? = null,
    trailing: @Composable (() -> Unit)? = null,
) {
    // Compact action strip only — no oversized title/subtitle hat.
    val chrome = rememberMobileScaleChromePolicy()
    val trailingContent = trailing
    if (trailingContent != null || !badge.isNullOrBlank()) {
        Row(
            modifier =
                modifier
                    .fillMaxWidth()
                    .semantics(mergeDescendants = true) {
                        this.contentDescription =
                            contentDescription
                                ?: buildString {
                                    append(title)
                                    if (subtitle.isNotBlank()) {
                                        append(". ")
                                        append(subtitle)
                                    }
                                }
                    },
            horizontalArrangement = Arrangement.End,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (!badge.isNullOrBlank()) {
                PremiumBadge(text = badge)
            }
            if (trailingContent != null) {
                Box(modifier = Modifier.widthIn(max = chrome.heroTrailingMaxWidthDp)) {
                    trailingContent()
                }
            }
        }
    }
}

@Composable
@Suppress("UNUSED_PARAMETER")
fun PremiumSpotlightCard(
    title: String,
    body: String,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    overline: String? = null,
    metricLabel: String? = null,
    metricValue: String? = null,
    contentDescription: String? = null,
    messageContent: @Composable (() -> Unit)? = null,
    action: @Composable (() -> Unit)? = null,
) {
    val actionContent = action ?: return
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .semantics(mergeDescendants = true) {
                    if (!contentDescription.isNullOrBlank()) {
                        this.contentDescription = contentDescription
                    }
                },
        contentAlignment = Alignment.TopStart,
    ) {
        actionContent()
    }
}

@Composable
fun PremiumBadge(
    text: String,
    modifier: Modifier = Modifier,
) {
    val style = LocalMobileSurfaceStyle.current
    val alpha =
        when (style) {
            MobileSurfaceStyle.GLASS -> 0.78f
            MobileSurfaceStyle.PREMIUM -> 0.96f
            MobileSurfaceStyle.SYSTEM -> 1f
        }
    Surface(
        modifier = modifier,
        shape = CircleShape,
        color = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = alpha),
        contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.36f)),
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Bold,
        )
    }
}

@Composable
fun PremiumStateCard(
    title: String,
    message: String = "",
    modifier: Modifier = Modifier,
    icon: ImageVector = Icons.Outlined.AutoAwesome,
    isError: Boolean = false,
    messageContent: @Composable (() -> Unit)? = null,
    action: @Composable (() -> Unit)? = null,
) {
    PremiumGlassCard(modifier = modifier) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(14.dp),
            verticalAlignment = Alignment.Top,
        ) {
            PremiumIconTile(
                icon = if (isError) Icons.Outlined.ErrorOutline else icon,
                contentDescription = null,
                containerColor =
                    if (isError) {
                        MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.9f)
                    } else {
                        MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.9f)
                    },
                contentColor =
                    if (isError) {
                        MaterialTheme.colorScheme.onErrorContainer
                    } else {
                        MaterialTheme.colorScheme.onPrimaryContainer
                    },
            )
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                if (messageContent != null) {
                    messageContent()
                } else if (message.isNotBlank()) {
                    Text(
                        text = message,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                val actionContent = action
                if (actionContent != null) {
                    Spacer(modifier = Modifier.height(2.dp))
                    actionContent()
                }
            }
        }
    }
}

@Composable
@Suppress("UNUSED_PARAMETER")
fun PremiumSectionCard(
    title: String,
    subtitle: String?,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    // Section hats (icon tile + title + subtitle) removed — content owns the panel; title stays for a11y.
    PremiumGlassCard(
        modifier =
            modifier.semantics(mergeDescendants = true) {
                contentDescription =
                    buildString {
                        append(title)
                        if (!subtitle.isNullOrBlank()) {
                            append(". ")
                            append(subtitle)
                        }
                    }
            },
    ) {
        content()
    }
}

@Composable
fun PremiumLoadingCard(
    message: String,
    modifier: Modifier = Modifier,
) {
    PremiumGlassCard(modifier = modifier) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            CircularProgressIndicator(strokeWidth = 2.dp, modifier = Modifier.size(24.dp))
            Text(
                text = message,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
fun PremiumRowSurface(
    modifier: Modifier = Modifier,
    containerColor: Color? = null,
    borderColor: Color? = null,
    tonalElevation: Dp? = null,
    verticalAlignment: Alignment.Vertical = Alignment.CenterVertically,
    content: @Composable RowScope.() -> Unit,
) {
    val tokens = rememberGlassSurfaceTokens()
    val style = LocalMobileSurfaceStyle.current
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        color =
            containerColor
                ?: MaterialTheme.colorScheme.surface.copy(alpha = tokens.containerAlpha.coerceAtLeast(0.72f)),
        tonalElevation = tonalElevation ?: if (style == MobileSurfaceStyle.PREMIUM) 3.dp else 1.dp,
        border =
            BorderStroke(
                1.dp,
                borderColor ?: tokens.borderAccent.copy(alpha = tokens.borderAlpha * 0.85f),
            ),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = verticalAlignment,
            content = content,
        )
    }
}

@Composable
fun PremiumComposerShell(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    val tokens = rememberGlassSurfaceTokens()
    val style = LocalMobileSurfaceStyle.current
    Surface(
        modifier = modifier,
        shape = PremiumComposerShape,
        color = MaterialTheme.colorScheme.surface.copy(alpha = tokens.containerAlpha.coerceAtLeast(0.82f)),
        tonalElevation = if (style == MobileSurfaceStyle.PREMIUM) 2.dp else 1.dp,
        border =
            BorderStroke(
                1.dp,
                tokens.borderAccent.copy(alpha = tokens.borderAlpha * 0.85f),
            ),
        content = content,
    )
}

@Composable
fun PremiumChipPill(
    text: String,
    modifier: Modifier = Modifier,
    containerColor: Color? = null,
    contentColor: Color? = null,
) {
    val tokens = rememberGlassSurfaceTokens()
    val style = LocalMobileSurfaceStyle.current
    val chipAlpha =
        when (style) {
            MobileSurfaceStyle.GLASS -> 0.55f
            MobileSurfaceStyle.PREMIUM -> 0.88f
            MobileSurfaceStyle.SYSTEM -> 0.72f
        }
    Surface(
        modifier = modifier,
        shape = PremiumChipShape,
        color = containerColor ?: MaterialTheme.colorScheme.secondaryContainer.copy(alpha = chipAlpha),
        contentColor = contentColor ?: MaterialTheme.colorScheme.onSecondaryContainer,
        border =
            BorderStroke(
                1.dp,
                tokens.borderAccent.copy(alpha = tokens.borderAlpha * 0.65f),
            ),
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelSmall,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
fun PremiumMetricPill(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
) {
    val tokens = rememberGlassSurfaceTokens()
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(18.dp),
        color = MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = tokens.containerAlpha.coerceAtLeast(0.78f)),
        border = BorderStroke(1.dp, tokens.borderAccent.copy(alpha = tokens.borderAlpha * 0.75f)),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 9.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (icon != null) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp),
                    tint = MaterialTheme.colorScheme.primary,
                )
            }
            Column(modifier = Modifier.weight(1f, fill = false)) {
                Text(
                    text = label,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = value,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

@Composable
fun PremiumDividerGlow(modifier: Modifier = Modifier) {
    val style = LocalMobileSurfaceStyle.current
    val scheme = MaterialTheme.colorScheme
    val brush =
        when (style) {
            MobileSurfaceStyle.GLASS ->
                Brush.horizontalGradient(
                    listOf(
                        Color.Transparent,
                        Color.White.copy(alpha = 0.55f),
                        scheme.primary.copy(alpha = 0.35f),
                        Color.Transparent,
                    ),
                )
            MobileSurfaceStyle.PREMIUM ->
                Brush.horizontalGradient(
                    listOf(
                        Color.Transparent,
                        scheme.primary.copy(alpha = 0.55f),
                        Color(0xFFFFE4B5).copy(alpha = 0.35f),
                        scheme.primary.copy(alpha = 0.45f),
                        Color.Transparent,
                    ),
                )
            MobileSurfaceStyle.SYSTEM ->
                Brush.horizontalGradient(
                    listOf(
                        Color.Transparent,
                        scheme.outlineVariant.copy(alpha = 0.55f),
                        Color.Transparent,
                    ),
                )
        }
    Box(
        modifier =
            modifier
                .fillMaxWidth()
                .height(1.dp)
                .clip(RoundedCornerShape(999.dp))
                .background(brush),
    )
}
