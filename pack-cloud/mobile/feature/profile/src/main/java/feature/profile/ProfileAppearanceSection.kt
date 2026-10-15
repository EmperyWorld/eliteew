/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unified Profile appearance settings — style, brightness, scale, wallpaper, comfort in one card.
 *
 * Invariants:
 * - User-facing copy from string resources; no nested PremiumSectionCard stacks.
 *
 * Related:
 * - ProfileFeature.kt, MobileUiStylePreferences, ProfileControlCenterSections.kt
 */
package feature.profile

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.outlined.Image
import androidx.compose.material.icons.outlined.Palette
import androidx.compose.material.icons.outlined.PhotoLibrary
import androidx.compose.material.icons.outlined.RestartAlt
import androidx.compose.material.icons.outlined.TextFields
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import world.empery.mobile.core.ui.ChatFontColorOption
import world.empery.mobile.core.ui.ChatFontFamilyOption
import world.empery.mobile.core.ui.ChatFontSizeOption
import world.empery.mobile.core.ui.ChatTypographyPreset
import world.empery.mobile.core.ui.ChatTypographySettings
import world.empery.mobile.core.ui.ChatVisualStyle
import world.empery.mobile.core.ui.MobileUiScale
import world.empery.mobile.core.ui.PremiumRowSurface
import world.empery.mobile.core.ui.PremiumSectionCard
import world.empery.mobile.core.ui.ScaledButton
import world.empery.mobile.core.ui.ScaledOutlinedButton

@Composable
fun ProfileAppearanceSection(
    mobileUiStyle: MobileUiStyle,
    onMobileUiStyleChange: (MobileUiStyle) -> Unit,
    mobileColorMode: MobileColorMode,
    onMobileColorModeChange: (MobileColorMode) -> Unit,
    mobileUiScale: MobileUiScale,
    onMobileUiScaleChange: (MobileUiScale) -> Unit,
    chatVisualStyle: ChatVisualStyle,
    onChatVisualStyleChange: (ChatVisualStyle) -> Unit,
    chatTypography: ChatTypographySettings,
    onChatTypographyChange: (ChatTypographySettings) -> Unit,
    currentBg: String?,
    onPickGallery: () -> Unit,
    onResetWallpaper: () -> Unit,
    onSelectPreset: (String) -> Unit,
    reduceMotion: Boolean,
    highContrastHint: Boolean,
    onReduceMotionChange: (Boolean) -> Unit,
    onHighContrastChange: (Boolean) -> Unit,
    introSplashEnabled: Boolean,
    onIntroSplashEnabledChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    val matchedTypoPreset = ChatTypographyPreset.matching(chatTypography)
    PremiumSectionCard(
        modifier = modifier.fillMaxWidth(),
        title = stringResource(R.string.profile_appearance_section_title),
        subtitle = stringResource(R.string.profile_appearance_section_subtitle),
        icon = Icons.Outlined.Palette,
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            AppearanceSubheading(stringResource(R.string.profile_appearance_style_heading))
            Row(
                modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                MobileUiStyle.entries.forEach { style ->
                    val selected = mobileUiStyle == style
                    AppearanceStyleChip(
                        style = style,
                        selected = selected,
                        onClick = { onMobileUiStyleChange(style) },
                    )
                }
            }
            Text(
                text = stringResource(mobileUiStyleDescriptionRes(mobileUiStyle)),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            AppearanceSubheading(stringResource(R.string.profile_chat_visual_heading))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ChatVisualStyle.entries.forEach { style ->
                    FilterChip(
                        selected = chatVisualStyle == style,
                        onClick = { onChatVisualStyleChange(style) },
                        label = { Text(stringResource(chatVisualStyleLabelRes(style))) },
                    )
                }
            }
            Text(
                text = stringResource(chatVisualStyleDescriptionRes(chatVisualStyle)),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            AppearanceSubheading(
                text = stringResource(R.string.profile_chat_typo_heading),
                icon = Icons.Outlined.TextFields,
            )
            Text(
                text = stringResource(R.string.profile_chat_typo_presets),
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.SemiBold,
            )
            Row(
                modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                ChatTypographyPreset.entries.forEach { preset ->
                    FilterChip(
                        selected = matchedTypoPreset == preset,
                        onClick = { onChatTypographyChange(preset.toSettings()) },
                        label = { Text(stringResource(chatTypographyPresetLabelRes(preset))) },
                    )
                }
            }
            Text(
                text = stringResource(R.string.profile_chat_typo_custom_hint),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = stringResource(R.string.profile_chat_typo_family),
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.SemiBold,
            )
            Row(
                modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                ChatFontFamilyOption.entries.forEach { family ->
                    FilterChip(
                        selected = chatTypography.family == family,
                        onClick = {
                            onChatTypographyChange(chatTypography.copy(family = family))
                        },
                        label = { Text(stringResource(chatFontFamilyLabelRes(family))) },
                    )
                }
            }
            Text(
                text = stringResource(R.string.profile_chat_typo_size),
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.SemiBold,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ChatFontSizeOption.entries.forEach { size ->
                    FilterChip(
                        selected = chatTypography.size == size,
                        onClick = { onChatTypographyChange(chatTypography.copy(size = size)) },
                        label = { Text(stringResource(chatFontSizeLabelRes(size))) },
                    )
                }
            }
            Text(
                text = stringResource(R.string.profile_chat_typo_color),
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.SemiBold,
            )
            Row(
                modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                ChatFontColorOption.entries.forEach { color ->
                    FilterChip(
                        selected = chatTypography.color == color,
                        onClick = { onChatTypographyChange(chatTypography.copy(color = color)) },
                        label = { Text(stringResource(chatFontColorLabelRes(color))) },
                    )
                }
            }

            AppearanceSubheading(stringResource(R.string.profile_color_mode_section))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                MobileColorMode.entries.forEach { mode ->
                    FilterChip(
                        selected = mobileColorMode == mode,
                        onClick = { onMobileColorModeChange(mode) },
                        label = { Text(stringResource(mobileColorModeLabelRes(mode))) },
                    )
                }
            }

            AppearanceSubheading(stringResource(R.string.profile_scale_section))
            ProfileUiScalePicker(
                selected = mobileUiScale,
                onSelect = onMobileUiScaleChange,
            )

            AppearanceSubheading(stringResource(R.string.profile_wallpaper_section))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                ScaledButton(
                    onClick = onPickGallery,
                    label = stringResource(R.string.profile_gallery),
                    icon = Icons.Outlined.Image,
                    enabled = true,
                    modifier = Modifier.weight(1f),
                )
                ScaledOutlinedButton(
                    onClick = onResetWallpaper,
                    label = stringResource(R.string.profile_reset_wallpaper),
                    icon = Icons.Outlined.RestartAlt,
                    enabled = true,
                    modifier = Modifier.weight(1f),
                )
            }
            ProfileWallpaperPresetsRow(
                currentBg = currentBg,
                onSelectPreset = onSelectPreset,
            )

            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                color = MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = 0.55f),
            ) {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    AppearanceSubheading(
                        text = stringResource(R.string.profile_a11y_title),
                        icon = Icons.Outlined.Visibility,
                    )
                    PremiumRowSurface(modifier = Modifier.fillMaxWidth()) {
                        Text(
                            text = stringResource(R.string.profile_a11y_reduce_motion),
                            modifier = Modifier.weight(1f),
                        )
                        Switch(checked = reduceMotion, onCheckedChange = onReduceMotionChange)
                    }
                    PremiumRowSurface(modifier = Modifier.fillMaxWidth()) {
                        Text(
                            text = stringResource(R.string.profile_a11y_high_contrast),
                            modifier = Modifier.weight(1f),
                        )
                        Switch(checked = highContrastHint, onCheckedChange = onHighContrastChange)
                    }
                    PremiumRowSurface(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(text = stringResource(R.string.profile_intro_splash_title))
                            Text(
                                text = stringResource(R.string.profile_intro_splash_subtitle),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        Switch(
                            checked = introSplashEnabled,
                            onCheckedChange = onIntroSplashEnabledChange,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun AppearanceSubheading(
    text: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector? = null,
) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        icon?.let {
            androidx.compose.material3.Icon(
                imageVector = it,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.85f),
                modifier = Modifier.size(18.dp),
            )
        }
        Text(
            text = text,
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.primary,
        )
    }
}

@Composable
private fun AppearanceStyleChip(
    style: MobileUiStyle,
    selected: Boolean,
    onClick: () -> Unit,
) {
    val accent =
        when (style) {
            MobileUiStyle.SYSTEM -> MaterialTheme.colorScheme.primary
            MobileUiStyle.GLASS -> Color(0xFF0284C7)
            MobileUiStyle.PREMIUM -> Color(0xFF9A6B2E)
            MobileUiStyle.EMERALD -> Color(0xFF059669)
            MobileUiStyle.MIDNIGHT -> Color(0xFF4338CA)
            MobileUiStyle.OBSIDIAN -> Color(0xFFE8E8E8)
        }
    Surface(
        shape = RoundedCornerShape(14.dp),
        color =
            if (selected) {
                MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.72f)
            } else {
                MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = 0.82f)
            },
        border =
            BorderStroke(
                1.dp,
                if (selected) MaterialTheme.colorScheme.primary.copy(alpha = 0.55f) else MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f),
            ),
        modifier = Modifier.clickable(onClick = onClick),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(28.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(accent.copy(alpha = 0.22f))
                        .padding(6.dp),
            ) {
                Box(
                    modifier =
                        Modifier
                            .fillMaxSize()
                            .clip(RoundedCornerShape(4.dp))
                            .background(accent),
                )
            }
            Text(
                text = stringResource(mobileUiStyleLabelRes(style)),
                style = MaterialTheme.typography.labelMedium,
                fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium,
            )
        }
    }
}

@Composable
private fun ProfileWallpaperPresetsRow(
    currentBg: String?,
    onSelectPreset: (String) -> Unit,
) {
    val context = LocalContext.current
    var presetsExpanded by rememberSaveable { mutableStateOf(false) }

    ScaledOutlinedButton(
        onClick = { presetsExpanded = !presetsExpanded },
        label =
            stringResource(
                if (presetsExpanded) {
                    R.string.profile_wallpaper_collapse
                } else {
                    R.string.profile_wallpaper_expand
                },
            ),
        icon = if (presetsExpanded) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore,
        enabled = true,
        modifier = Modifier.fillMaxWidth(),
    )
    if (presetsExpanded) {
        LazyRow(
            modifier = Modifier.fillMaxWidth().padding(bottom = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            items(29) { index ->
                val i = index + 1
                val resName = "wp_$i"
                val resId = context.resources.getIdentifier(resName, "drawable", context.packageName)
                if (resId != 0) {
                    val uriString = "android.resource://${context.packageName}/drawable/$resName"
                    val isSelected = currentBg == uriString
                    val thumbShape = RoundedCornerShape(16.dp)
                    Surface(
                        modifier =
                            Modifier
                                .size(width = 88.dp, height = 132.dp)
                                .clip(thumbShape)
                                .clickable { onSelectPreset(uriString) },
                        shape = thumbShape,
                        tonalElevation = if (isSelected) 5.dp else 2.dp,
                        border =
                            if (isSelected) {
                                BorderStroke(3.dp, MaterialTheme.colorScheme.primary)
                            } else {
                                BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
                            },
                        color =
                            if (isSelected) {
                                MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.44f)
                            } else {
                                MaterialTheme.colorScheme.surfaceContainerHigh
                            },
                    ) {
                        coil.compose.AsyncImage(
                            model = resId,
                            contentDescription = stringResource(R.string.profile_wallpaper_thumb_cd, i),
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxSize(),
                        )
                    }
                }
            }
        }
    }
}
