/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * CompositionLocal for persisted [ChatTypographySettings] applied to GAF message body text.
 *
 * Invariants:
 * - Default is [ChatTypographySettings.DEFAULT] (Base preset).
 *
 * Related:
 * - ChatTypography.kt, MainActivity CompositionLocalProvider
 */
package world.empery.mobile.core.ui

import androidx.compose.runtime.staticCompositionLocalOf

val LocalChatTypography =
    staticCompositionLocalOf { ChatTypographySettings.DEFAULT }
