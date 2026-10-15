/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared visual primitives for the mobile AI hub and nested tool screens (chat, images, songs).
 *
 * Invariants:
 * - Visual-only composables; no repository or network calls.
 * - Hub tool grid: 2×2 compact → 3 col medium/expanded → 4 col large+ (UgsHubLayoutPolicy).
 *
 * Related:
 * - UgsHubFeature.kt, UgsAiChatListScreen.kt, PremiumGlass.kt
 */
package feature.ugs

import androidx.annotation.DrawableRes
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.DesktopWindows
import androidx.compose.material.icons.outlined.FolderOpen
import androidx.compose.material.icons.outlined.Image
import androidx.compose.material.icons.outlined.MusicNote
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Slideshow
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import world.empery.mobile.core.ui.MobileIconButton
import world.empery.mobile.core.ui.rememberMobileScaleChromePolicy
import world.empery.mobile.core.ui.LocalMobileSurfaceStyle
import world.empery.mobile.core.ui.LocalMobileWindowLayout
import world.empery.mobile.core.ui.MobileSurfaceStyle
import world.empery.mobile.core.ui.PremiumRowSurface
import world.empery.mobile.core.ui.PremiumBadge
import world.empery.mobile.core.ui.PremiumGlassCard
import world.empery.mobile.core.ui.PremiumGlassShape
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics

@Immutable
private data class AiToolAccent(
    val icon: ImageVector,
    val tint: Color,
    val glow: Color,
)

@Composable
private fun rememberAiToolSurface(): Triple<Float, Float, Dp> {
    val style = LocalMobileSurfaceStyle.current
    return remember(style) {
        when (style) {
            MobileSurfaceStyle.GLASS -> Triple(0.52f, 0.38f, 0.dp)
            MobileSurfaceStyle.PREMIUM -> Triple(0.88f, 0.48f, 2.dp)
            MobileSurfaceStyle.SYSTEM -> Triple(1f, 0.24f, 1.dp)
        }
    }
}

@Composable
private fun AiToolAccentIcon(
    accent: AiToolAccent,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .size(46.dp)
                .clip(CircleShape)
                .background(
                    Brush.radialGradient(
                        colors =
                            listOf(
                                accent.glow.copy(alpha = 0.34f),
                                accent.tint.copy(alpha = 0.12f),
                                Color.Transparent,
                            ),
                    ),
                ),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = accent.icon,
            contentDescription = null,
            tint = accent.tint,
            modifier = Modifier.size(24.dp),
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun UgsAiCompactToolCell(
    title: String,
    caption: String,
    accent: AiToolAccent,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val chrome = rememberMobileScaleChromePolicy()
    val captionMaxLines = if (chrome.shouldStackChromeActions) 1 else 2
    val (containerAlpha, borderAlpha, elevation) = rememberAiToolSurface()
    Card(
        onClick = onClick,
        modifier = modifier.aspectRatio(0.92f),
        shape = RoundedCornerShape(18.dp),
        colors =
            CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surface.copy(alpha = containerAlpha),
            ),
        border =
            BorderStroke(
                1.dp,
                MaterialTheme.colorScheme.outlineVariant.copy(alpha = borderAlpha),
            ),
        elevation = CardDefaults.cardElevation(defaultElevation = elevation),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(horizontal = 10.dp, vertical = 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            AiToolAccentIcon(accent = accent)
            Spacer(modifier = Modifier.height(10.dp))
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface,
                textAlign = TextAlign.Center,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = caption,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.92f),
                textAlign = TextAlign.Center,
                maxLines = captionMaxLines,
                overflow = TextOverflow.Ellipsis,
                lineHeight = MaterialTheme.typography.labelSmall.lineHeight,
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun UgsAiWideToolRow(
    title: String,
    subtitle: String,
    accent: AiToolAccent,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val chrome = rememberMobileScaleChromePolicy()
    val subtitleMaxLines = if (chrome.shouldStackChromeActions) 1 else 2
    val (containerAlpha, borderAlpha, elevation) = rememberAiToolSurface()
    Card(
        onClick = onClick,
        modifier = modifier.fillMaxWidth(),
        shape = PremiumGlassShape,
        colors =
            CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surface.copy(alpha = containerAlpha),
            ),
        border =
            BorderStroke(
                1.dp,
                MaterialTheme.colorScheme.outlineVariant.copy(alpha = borderAlpha),
            ),
        elevation = CardDefaults.cardElevation(defaultElevation = elevation),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 72.dp)
                    .padding(horizontal = 14.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            AiToolAccentIcon(accent = accent)
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = subtitleMaxLines,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Icon(
                imageVector = Icons.AutoMirrored.Outlined.ArrowForward,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.7f),
                modifier = Modifier.size(18.dp),
            )
        }
    }
}

@Composable
private fun UgsHubToolsAdaptiveColumns(
    modifier: Modifier = Modifier,
    content: @Composable (columnCount: Int) -> Unit,
) {
    val layout = LocalMobileWindowLayout.current
    BoxWithConstraints(modifier = modifier.fillMaxWidth()) {
        val columnCount =
            ugsHubToolsResolvedColumnCount(
                layout = layout,
                availableWidthDp = maxWidth.value.toInt(),
            )
        content(columnCount)
    }
}

@Composable
fun UgsAiHubToolsGrid(
    onOpenAiChat: () -> Unit,
    onOpenImages: () -> Unit,
    onOpenSongs: () -> Unit,
    onOpenPresentations: () -> Unit,
    onOpenDesktop: () -> Unit,
    onOpenContentLibrary: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val scheme = MaterialTheme.colorScheme
    val chatAccent =
        remember(scheme) {
            AiToolAccent(
                icon = Icons.Outlined.ChatBubbleOutline,
                tint = scheme.primary,
                glow = scheme.primary,
            )
        }
    val imagesAccent =
        remember(scheme) {
            AiToolAccent(
                icon = Icons.Outlined.Image,
                tint = scheme.secondary,
                glow = scheme.secondary,
            )
        }
    val songsAccent =
        remember(scheme) {
            AiToolAccent(
                icon = Icons.Outlined.MusicNote,
                tint = scheme.tertiary,
                glow = scheme.tertiary,
            )
        }
    val presentationsAccent =
        remember(scheme) {
            AiToolAccent(
                icon = Icons.Outlined.Slideshow,
                tint = scheme.primary.copy(alpha = 0.88f),
                glow = scheme.tertiary.copy(alpha = 0.85f),
            )
        }
    val desktopAccent =
        remember(scheme) {
            AiToolAccent(
                icon = Icons.Outlined.DesktopWindows,
                tint = scheme.onSurface.copy(alpha = 0.82f),
                glow = scheme.outline,
            )
        }
    val filesAccent =
        remember(scheme) {
            AiToolAccent(
                icon = Icons.Outlined.FolderOpen,
                tint = scheme.secondary.copy(alpha = 0.92f),
                glow = scheme.primary.copy(alpha = 0.75f),
            )
        }

    UgsHubToolsAdaptiveColumns(modifier = modifier) { columnCount ->
        when {
            columnCount >= 4 ->
                UgsAiHubToolsGridFourCol(
                    chatAccent = chatAccent,
                    imagesAccent = imagesAccent,
                    songsAccent = songsAccent,
                    presentationsAccent = presentationsAccent,
                    desktopAccent = desktopAccent,
                    filesAccent = filesAccent,
                    onOpenAiChat = onOpenAiChat,
                    onOpenImages = onOpenImages,
                    onOpenSongs = onOpenSongs,
                    onOpenPresentations = onOpenPresentations,
                    onOpenDesktop = onOpenDesktop,
                    onOpenContentLibrary = onOpenContentLibrary,
                    modifier = modifier,
                )
            columnCount >= 3 ->
                UgsAiHubToolsGridThreeCol(
                    chatAccent = chatAccent,
                    imagesAccent = imagesAccent,
                    songsAccent = songsAccent,
                    presentationsAccent = presentationsAccent,
                    desktopAccent = desktopAccent,
                    filesAccent = filesAccent,
                    onOpenAiChat = onOpenAiChat,
                    onOpenImages = onOpenImages,
                    onOpenSongs = onOpenSongs,
                    onOpenPresentations = onOpenPresentations,
                    onOpenDesktop = onOpenDesktop,
                    onOpenContentLibrary = onOpenContentLibrary,
                    modifier = modifier,
                )
            columnCount >= 2 ->
                UgsAiHubToolsGridTwoCol(
                    chatAccent = chatAccent,
                    imagesAccent = imagesAccent,
                    songsAccent = songsAccent,
                    presentationsAccent = presentationsAccent,
                    desktopAccent = desktopAccent,
                    filesAccent = filesAccent,
                    onOpenAiChat = onOpenAiChat,
                    onOpenImages = onOpenImages,
                    onOpenSongs = onOpenSongs,
                    onOpenPresentations = onOpenPresentations,
                    onOpenDesktop = onOpenDesktop,
                    onOpenContentLibrary = onOpenContentLibrary,
                    modifier = modifier,
                )
            else ->
                UgsAiHubToolsListPhone(
                    chatAccent = chatAccent,
                    imagesAccent = imagesAccent,
                    songsAccent = songsAccent,
                    presentationsAccent = presentationsAccent,
                    desktopAccent = desktopAccent,
                    filesAccent = filesAccent,
                    onOpenAiChat = onOpenAiChat,
                    onOpenImages = onOpenImages,
                    onOpenSongs = onOpenSongs,
                    onOpenPresentations = onOpenPresentations,
                    onOpenDesktop = onOpenDesktop,
                    onOpenContentLibrary = onOpenContentLibrary,
                    modifier = modifier,
                )
        }
    }
}

@Composable
private fun UgsAiHubToolsGridTwoCol(
    chatAccent: AiToolAccent,
    imagesAccent: AiToolAccent,
    songsAccent: AiToolAccent,
    presentationsAccent: AiToolAccent,
    desktopAccent: AiToolAccent,
    filesAccent: AiToolAccent,
    onOpenAiChat: () -> Unit,
    onOpenImages: () -> Unit,
    onOpenSongs: () -> Unit,
    onOpenPresentations: () -> Unit,
    onOpenDesktop: () -> Unit,
    onOpenContentLibrary: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            UgsAiCompactToolCell(
                title = stringResource(R.string.ugs_tool_ai_chat),
                caption = stringResource(R.string.ugs_tool_grid_chat_caption),
                accent = chatAccent,
                onClick = onOpenAiChat,
                modifier = Modifier.weight(1f),
            )
            UgsAiCompactToolCell(
                title = stringResource(R.string.ugs_tool_images),
                caption = stringResource(R.string.ugs_tool_grid_images_caption),
                accent = imagesAccent,
                onClick = onOpenImages,
                modifier = Modifier.weight(1f),
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            UgsAiCompactToolCell(
                title = stringResource(R.string.ugs_tool_songs),
                caption = stringResource(R.string.ugs_tool_grid_songs_caption),
                accent = songsAccent,
                onClick = onOpenSongs,
                modifier = Modifier.weight(1f),
            )
            UgsAiCompactToolCell(
                title = stringResource(R.string.ugs_tool_presentations),
                caption = stringResource(R.string.ugs_tool_grid_presentations_caption),
                accent = presentationsAccent,
                onClick = onOpenPresentations,
                modifier = Modifier.weight(1f),
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            UgsAiCompactToolCell(
                title = stringResource(R.string.ugs_tool_desktop_hub),
                caption = stringResource(R.string.ugs_tool_desktop_hub_hint),
                accent = desktopAccent,
                onClick = onOpenDesktop,
                modifier = Modifier.weight(1f),
            )
            UgsAiCompactToolCell(
                title = stringResource(R.string.ugs_tool_files),
                caption = stringResource(R.string.ugs_tool_files_hint),
                accent = filesAccent,
                onClick = onOpenContentLibrary,
                modifier = Modifier.weight(1f),
            )
        }
        UgsAiInlineHint(
            text = stringResource(R.string.ugs_xl_base_only_note),
            icon = Icons.Outlined.MusicNote,
        )
    }
}

@Composable
private fun UgsAiHubToolsGridThreeCol(
    chatAccent: AiToolAccent,
    imagesAccent: AiToolAccent,
    songsAccent: AiToolAccent,
    presentationsAccent: AiToolAccent,
    desktopAccent: AiToolAccent,
    filesAccent: AiToolAccent,
    onOpenAiChat: () -> Unit,
    onOpenImages: () -> Unit,
    onOpenSongs: () -> Unit,
    onOpenPresentations: () -> Unit,
    onOpenDesktop: () -> Unit,
    onOpenContentLibrary: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            UgsAiCompactToolCell(
                title = stringResource(R.string.ugs_tool_ai_chat),
                caption = stringResource(R.string.ugs_tool_grid_chat_caption),
                accent = chatAccent,
                onClick = onOpenAiChat,
                modifier = Modifier.weight(1f),
            )
            UgsAiCompactToolCell(
                title = stringResource(R.string.ugs_tool_images),
                caption = stringResource(R.string.ugs_tool_grid_images_caption),
                accent = imagesAccent,
                onClick = onOpenImages,
                modifier = Modifier.weight(1f),
            )
            UgsAiCompactToolCell(
                title = stringResource(R.string.ugs_tool_songs),
                caption = stringResource(R.string.ugs_tool_grid_songs_caption),
                accent = songsAccent,
                onClick = onOpenSongs,
                modifier = Modifier.weight(1f),
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            UgsAiCompactToolCell(
                title = stringResource(R.string.ugs_tool_presentations),
                caption = stringResource(R.string.ugs_tool_grid_presentations_caption),
                accent = presentationsAccent,
                onClick = onOpenPresentations,
                modifier = Modifier.weight(1f),
            )
            UgsAiCompactToolCell(
                title = stringResource(R.string.ugs_tool_desktop_hub),
                caption = stringResource(R.string.ugs_tool_desktop_hub_hint),
                accent = desktopAccent,
                onClick = onOpenDesktop,
                modifier = Modifier.weight(1f),
            )
            UgsAiCompactToolCell(
                title = stringResource(R.string.ugs_tool_files),
                caption = stringResource(R.string.ugs_tool_files_hint),
                accent = filesAccent,
                onClick = onOpenContentLibrary,
                modifier = Modifier.weight(1f),
            )
        }
        UgsAiInlineHint(
            text = stringResource(R.string.ugs_xl_base_only_note),
            icon = Icons.Outlined.MusicNote,
        )
    }
}

@Composable
private fun UgsAiHubToolsGridFourCol(
    chatAccent: AiToolAccent,
    imagesAccent: AiToolAccent,
    songsAccent: AiToolAccent,
    presentationsAccent: AiToolAccent,
    desktopAccent: AiToolAccent,
    filesAccent: AiToolAccent,
    onOpenAiChat: () -> Unit,
    onOpenImages: () -> Unit,
    onOpenSongs: () -> Unit,
    onOpenPresentations: () -> Unit,
    onOpenDesktop: () -> Unit,
    onOpenContentLibrary: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            UgsAiCompactToolCell(
                title = stringResource(R.string.ugs_tool_ai_chat),
                caption = stringResource(R.string.ugs_tool_grid_chat_caption),
                accent = chatAccent,
                onClick = onOpenAiChat,
                modifier = Modifier.weight(1f),
            )
            UgsAiCompactToolCell(
                title = stringResource(R.string.ugs_tool_images),
                caption = stringResource(R.string.ugs_tool_grid_images_caption),
                accent = imagesAccent,
                onClick = onOpenImages,
                modifier = Modifier.weight(1f),
            )
            UgsAiCompactToolCell(
                title = stringResource(R.string.ugs_tool_songs),
                caption = stringResource(R.string.ugs_tool_grid_songs_caption),
                accent = songsAccent,
                onClick = onOpenSongs,
                modifier = Modifier.weight(1f),
            )
            UgsAiCompactToolCell(
                title = stringResource(R.string.ugs_tool_presentations),
                caption = stringResource(R.string.ugs_tool_grid_presentations_caption),
                accent = presentationsAccent,
                onClick = onOpenPresentations,
                modifier = Modifier.weight(1f),
            )
        }
        UgsAiWideToolRow(
            title = stringResource(R.string.ugs_tool_desktop_hub),
            subtitle = stringResource(R.string.ugs_tool_desktop_hub_hint),
            accent = desktopAccent,
            onClick = onOpenDesktop,
        )
        UgsAiWideToolRow(
            title = stringResource(R.string.ugs_tool_files),
            subtitle = stringResource(R.string.ugs_tool_files_hint),
            accent = filesAccent,
            onClick = onOpenContentLibrary,
        )
        UgsAiInlineHint(
            text = stringResource(R.string.ugs_xl_base_only_note),
            icon = Icons.Outlined.MusicNote,
        )
    }
}

@Composable
private fun UgsAiHubToolsListPhone(
    chatAccent: AiToolAccent,
    imagesAccent: AiToolAccent,
    songsAccent: AiToolAccent,
    presentationsAccent: AiToolAccent,
    desktopAccent: AiToolAccent,
    filesAccent: AiToolAccent,
    onOpenAiChat: () -> Unit,
    onOpenImages: () -> Unit,
    onOpenSongs: () -> Unit,
    onOpenPresentations: () -> Unit,
    onOpenDesktop: () -> Unit,
    onOpenContentLibrary: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        UgsAiWideToolRow(
            title = stringResource(R.string.ugs_tool_ai_chat),
            subtitle = stringResource(R.string.ugs_tool_grid_chat_caption),
            accent = chatAccent,
            onClick = onOpenAiChat,
        )
        UgsAiWideToolRow(
            title = stringResource(R.string.ugs_tool_images),
            subtitle = stringResource(R.string.ugs_tool_grid_images_caption),
            accent = imagesAccent,
            onClick = onOpenImages,
        )
        UgsAiWideToolRow(
            title = stringResource(R.string.ugs_tool_songs),
            subtitle = stringResource(R.string.ugs_tool_grid_songs_caption),
            accent = songsAccent,
            onClick = onOpenSongs,
        )
        UgsAiWideToolRow(
            title = stringResource(R.string.ugs_tool_presentations),
            subtitle = stringResource(R.string.ugs_tool_grid_presentations_caption),
            accent = presentationsAccent,
            onClick = onOpenPresentations,
        )
        UgsAiWideToolRow(
            title = stringResource(R.string.ugs_tool_desktop_hub),
            subtitle = stringResource(R.string.ugs_tool_desktop_hub_hint),
            accent = desktopAccent,
            onClick = onOpenDesktop,
        )
        UgsAiWideToolRow(
            title = stringResource(R.string.ugs_tool_files),
            subtitle = stringResource(R.string.ugs_tool_files_hint),
            accent = filesAccent,
            onClick = onOpenContentLibrary,
        )
        UgsAiInlineHint(
            text = stringResource(R.string.ugs_xl_base_only_note),
            icon = Icons.Outlined.MusicNote,
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UgsAiSubScreenTopBar(
    title: String,
    subtitle: String,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    isRefreshing: Boolean = false,
    onRefresh: (() -> Unit)? = null,
    refreshContentDescription: String? = null,
) {
    // Navigation chrome only — no title/subtitle hat (route context is enough).
    TopAppBar(
        modifier =
            modifier.semantics(mergeDescendants = true) {
                contentDescription =
                    buildString {
                        append(title)
                        if (subtitle.isNotBlank()) {
                            append(". ")
                            append(subtitle)
                        }
                    }
            },
        title = { },
        navigationIcon = {
            MobileIconButton(
                onClick = onBack,
                contentDescription = stringResource(R.string.ugs_nav_back),
            ) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
            }
        },
        actions = {
            if (onRefresh != null) {
                MobileIconButton(
                    onClick = onRefresh,
                    enabled = !isRefreshing,
                    contentDescription = refreshContentDescription.orEmpty(),
                ) {
                    if (isRefreshing) {
                        CircularProgressIndicator(modifier = Modifier.size(22.dp), strokeWidth = 2.dp)
                    } else {
                        Icon(
                            Icons.Outlined.Refresh,
                            contentDescription = null,
                        )
                    }
                }
            }
        },
        colors =
            TopAppBarDefaults.topAppBarColors(
                containerColor = Color.Transparent,
                scrolledContainerColor = Color.Transparent,
            ),
    )
}

@Composable
fun UgsAiInlineHint(
    text: String,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
) {
    val style = LocalMobileSurfaceStyle.current
    val alpha =
        when (style) {
            MobileSurfaceStyle.GLASS -> 0.38f
            MobileSurfaceStyle.PREMIUM -> 0.5f
            MobileSurfaceStyle.SYSTEM -> 0.32f
        }
    PremiumRowSurface(
        modifier = modifier.fillMaxWidth(),
        containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = alpha),
        borderColor = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.22f),
    ) {
        if (icon != null) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(16.dp),
            )
        }
        Text(
            text = text,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f, fill = false),
        )
    }
}

@Composable
fun UgsAiSearchField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier.fillMaxWidth(),
        placeholder = { Text(placeholder) },
        leadingIcon = {
            Icon(
                Icons.Outlined.Search,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        },
        singleLine = true,
        shape = RoundedCornerShape(16.dp),
        colors =
            OutlinedTextFieldDefaults.colors(
                focusedContainerColor = MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = 0.65f),
                unfocusedContainerColor = MaterialTheme.colorScheme.surfaceContainer.copy(alpha = 0.45f),
                focusedBorderColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.4f),
                unfocusedBorderColor = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.35f),
            ),
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UgsAiHeroPickerCard(
    heroName: String,
    heroDescription: String,
    @DrawableRes avatarRes: Int,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    val (containerAlpha, borderAlpha, elevation) = rememberAiToolSurface()
    Card(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        colors =
            CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surface.copy(alpha = containerAlpha),
            ),
        border =
            BorderStroke(
                1.dp,
                MaterialTheme.colorScheme.outlineVariant.copy(alpha = borderAlpha),
            ),
        elevation = CardDefaults.cardElevation(defaultElevation = elevation),
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Surface(
                shape = CircleShape,
                modifier = Modifier.size(52.dp),
                border =
                    BorderStroke(
                        1.5.dp,
                        MaterialTheme.colorScheme.primary.copy(alpha = 0.28f),
                    ),
                color = Color.Transparent,
            ) {
                Image(
                    painter = painterResource(avatarRes),
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize().clip(CircleShape),
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = heroName,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = heroDescription,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Icon(
                Icons.Filled.Add,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(22.dp),
            )
        }
    }
}

@Composable
fun UgsAiHubHero(
    title: String,
    subtitle: String,
    badge: String?,
    modifier: Modifier = Modifier,
    contentDescription: String? = null,
) {
    val scheme = MaterialTheme.colorScheme
    val chrome = rememberMobileScaleChromePolicy()
    val accent =
        remember(scheme) {
            AiToolAccent(
                icon = Icons.Outlined.AutoAwesome,
                tint = scheme.primary,
                glow = scheme.tertiary,
            )
        }
    PremiumGlassCard(
        modifier =
            modifier.then(
                if (contentDescription.isNullOrBlank()) {
                    Modifier
                } else {
                    Modifier.semantics { this.contentDescription = contentDescription }
                },
            ),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(modifier = Modifier.size(52.dp), contentAlignment = Alignment.Center) {
                AiToolAccentIcon(accent = accent)
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(modifier = Modifier.height(4.dp))
                if (chrome.maxHeroSubtitleLines > 0) {
                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = chrome.maxHeroSubtitleLines,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            if (!badge.isNullOrBlank()) {
                PremiumBadge(text = badge)
            }
        }
    }
}
