/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * CompositionLocal for the selected [ChatVisualStyle] enum (cheap identity for AnimatedContent keys).
 *
 * Invariants:
 * - Default is [ChatVisualStyle.ELITE]; an explicit provider can select STANDARD compatibility.
 *
 * Related:
 * - ChatVisualStyle.kt, feature.chat.LocalChatStyle
 */
package world.empery.mobile.core.ui

import androidx.compose.runtime.staticCompositionLocalOf

val LocalChatVisualStyle =
    staticCompositionLocalOf { ChatVisualStyle.ELITE }
