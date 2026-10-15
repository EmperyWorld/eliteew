/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Composition locals for authenticated mobile shell runtime (API base URL for Coil/media).
 *
 * Invariants:
 * - [LocalMobileApiBaseUrl] is set once from [AppRuntimeConfig.baseUrl] in MainActivity.
 * - Avatar Coil loads resolve relative paths via this local ([resolveMobileAvatarUrl]).
 *
 * Related:
 * - ProfileAvatarPlaceholder, GafChatPartnerAvatar, MobileAvatarPlaceholder, MainActivity.kt
 */
package world.empery.mobile.core.ui

import androidx.compose.runtime.compositionLocalOf

val LocalMobileApiBaseUrl = compositionLocalOf { "" }
