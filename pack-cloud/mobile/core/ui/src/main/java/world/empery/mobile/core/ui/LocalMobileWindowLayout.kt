/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * CompositionLocal carrying resolved adaptive layout snapshot for feature screens.
 *
 * Invariants:
 * - Provided once at shell root from Configuration; features read-only via current.
 *
 * Related:
 * - MainActivity.kt, MobileAdaptiveLayout.kt, MobileWindowWidthClass.kt
 */
package world.empery.mobile.core.ui

import android.content.pm.PackageManager
import android.content.res.Configuration
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext

@Immutable
data class MobileWindowLayout(
    val screenWidthDp: Int,
    val screenHeightDp: Int,
    val smallestScreenWidthDp: Int,
    val widthClass: MobileWindowWidthClass,
    val profile: MobileLayoutProfile,
) {
    val isVeryFlatLandscape: Boolean
        get() = screenWidthDp > 0 && screenHeightDp * 2 < screenWidthDp

    val useNavigationRail: Boolean
        get() =
            when {
                profile == MobileLayoutProfile.VrPanel -> false
                profile == MobileLayoutProfile.FoldableInner && screenWidthDp < MEDIUM_MIN_WIDTH_DP -> false
                widthClass.supportsNavigationRail -> true
                else -> false
            }

    val useBottomNavigation: Boolean
        get() = !useNavigationRail

    val useExpandedNavigationRail: Boolean
        get() = widthClass >= MobileWindowWidthClass.Large && useNavigationRail

    /** Shell and tabs use full window width; column counts adapt structure, not window size. */
    val shouldCenterShellContent: Boolean
        get() = false

    val contentColumnCount: Int
        get() =
            when (widthClass) {
                MobileWindowWidthClass.ExtraLarge,
                MobileWindowWidthClass.Large,
                -> 4
                MobileWindowWidthClass.Expanded -> 3
                MobileWindowWidthClass.Medium -> 2
                MobileWindowWidthClass.Compact ->
                    if (profile.prefersTwoColumnCards) {
                        2
                    } else {
                        1
                    }
            }

    val effectiveContentColumnCount: Int
        get() {
            val base = contentColumnCount
            if (isVeryFlatLandscape && widthClass >= MobileWindowWidthClass.Expanded) {
                return (base - 1).coerceAtLeast(2)
            }
            return base
        }

    val useChatMasterDetail: Boolean
        get() = widthClass >= MobileWindowWidthClass.Medium

    val contentMaxWidthDp: Int
        get() = MobileDesignTokens.contentMaxWidthFor(widthClass)

    val navRailWidthDp: Int
        get() = MobileDesignTokens.navRailWidthFor(widthClass)

    val gridMinCellWidthDp: Int
        get() = MobileDesignTokens.gridMinCellWidthFor(widthClass)

    val chatListPaneWidthDp: Int
        get() = MobileDesignTokens.chatListPaneWidthFor(widthClass)

    val chatThreadMaxWidthDp: Int
        get() = MobileDesignTokens.chatThreadMaxWidthFor(widthClass)

    companion object {
        fun fromConfiguration(
            configuration: Configuration,
            packageManager: PackageManager? = null,
        ): MobileWindowLayout {
            val width = configuration.screenWidthDp
            val height = configuration.screenHeightDp
            return MobileWindowLayout(
                screenWidthDp = width,
                screenHeightDp = height,
                smallestScreenWidthDp = configuration.smallestScreenWidthDp,
                widthClass = MobileWindowWidthClass.fromScreenWidthDp(width),
                profile = MobileLayoutProfile.resolve(configuration, packageManager),
            )
        }

        private const val MEDIUM_MIN_WIDTH_DP = 600
    }
}

val LocalMobileWindowLayout =
    staticCompositionLocalOf {
        MobileWindowLayout(
            screenWidthDp = 360,
            screenHeightDp = 640,
            smallestScreenWidthDp = 360,
            widthClass = MobileWindowWidthClass.Compact,
            profile = MobileLayoutProfile.Phone,
        )
    }

@Composable
fun rememberMobileWindowLayout(): MobileWindowLayout {
    val configuration = LocalConfiguration.current
    val packageManager = LocalContext.current.packageManager
    return androidx.compose.runtime.remember(configuration, packageManager) {
        MobileWindowLayout.fromConfiguration(configuration, packageManager)
    }
}
