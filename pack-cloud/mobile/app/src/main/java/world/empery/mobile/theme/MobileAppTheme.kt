package world.empery.mobile.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat
import feature.profile.MobileUiStyle

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/**
 * GLASS — холодное «матовое стекло» (голубой/cyan); PREMIUM — тёплое золото + фиолетовый акцент; SYSTEM — dynamic color.
 * Скругления — [MobileShapes] на всём Material 3.
 */
private val GlassDarkScheme =
    darkColorScheme(
        primary = Color(0xFF7DD3FC),
        onPrimary = Color(0xFF062033),
        primaryContainer = Color(0xFF0C4A6E),
        onPrimaryContainer = Color(0xFFD7F3FF),
        secondary = Color(0xFFA5F3FC),
        onSecondary = Color(0xFF062028),
        secondaryContainer = Color(0xFF155E75),
        onSecondaryContainer = Color(0xFFCFFAFE),
        tertiary = Color(0xFFBAE6FD),
        onTertiary = Color(0xFF082F49),
        tertiaryContainer = Color(0xFF0E7490),
        onTertiaryContainer = Color(0xFFE0F2FE),
        background = Color(0xFF0A1018),
        onBackground = Color(0xFFEAF6FF),
        surface = Color(0xFF121A24),
        onSurface = Color(0xFFEAF6FF),
        surfaceVariant = Color(0xFF243244),
        onSurfaceVariant = Color(0xFFC8D9E8),
        surfaceContainerLowest = Color(0xFF070B10),
        surfaceContainerLow = Color(0xFF101820),
        surfaceContainer = Color(0xFF16202C),
        surfaceContainerHigh = Color(0xFF1E2A38),
        surfaceContainerHighest = Color(0xFF273545),
        outline = Color(0x66FFFFFF),
        outlineVariant = Color(0x3DFFFFFF),
        error = Color(0xFFFFB4AB),
        onError = Color(0xFF690005),
    )

private val GlassLightScheme =
    lightColorScheme(
        primary = Color(0xFF0284C7),
        onPrimary = Color(0xFFFFFFFF),
        primaryContainer = Color(0xFFDFF4FF),
        onPrimaryContainer = Color(0xFF00344F),
        secondary = Color(0xFF0891B2),
        onSecondary = Color(0xFFFFFFFF),
        secondaryContainer = Color(0xFFCFFAFE),
        onSecondaryContainer = Color(0xFF003544),
        background = Color(0xFFF0F9FF),
        onBackground = Color(0xFF0C1824),
        surface = Color(0xFFFAFEFF),
        onSurface = Color(0xFF0C1824),
        surfaceVariant = Color(0xFFE2EEF7),
        onSurfaceVariant = Color(0xFF3E5568),
        surfaceContainer = Color(0xFFEAF4FB),
        surfaceContainerHigh = Color(0xFFDFECF6),
        surfaceContainerHighest = Color(0xFFD3E4F0),
        outline = Color(0x66708999),
        outlineVariant = Color(0x3D708999),
        tertiary = Color(0xFF0369A1),
        onTertiary = Color(0xFFFFFFFF),
        tertiaryContainer = Color(0xFFBAE6FD),
        onTertiaryContainer = Color(0xFF002538),
        error = Color(0xFFB3261E),
        onError = Color(0xFFFFFFFF),
    )

private val PremiumDarkScheme =
    darkColorScheme(
        primary = Color(0xFFD4AF6A),
        onPrimary = Color(0xFF1A1208),
        primaryContainer = Color(0xFF6B3A12),
        onPrimaryContainer = Color(0xFFFFF0D4),
        secondary = Color(0xFFFFD89C),
        onSecondary = Color(0xFF271800),
        secondaryContainer = Color(0xFF92400E),
        onSecondaryContainer = Color(0xFFFFFBEB),
        tertiary = Color(0xFFC4B5FD),
        onTertiary = Color(0xFF2E1065),
        tertiaryContainer = Color(0xFF4C1D95),
        onTertiaryContainer = Color(0xFFEDE9FE),
        background = Color(0xFF050408),
        onBackground = Color(0xFFFFF6ED),
        surface = Color(0xFF121018),
        onSurface = Color(0xFFFFF6ED),
        surfaceVariant = Color(0xFF2A2430),
        onSurfaceVariant = Color(0xFFE8DCCD),
        surfaceContainer = Color(0xFF1A161F),
        surfaceContainerHigh = Color(0xFF241F2A),
        surfaceContainerHighest = Color(0xFF2F2836),
        outline = Color(0x66D4AF6A),
        outlineVariant = Color(0x40D4AF6A),
        error = Color(0xFFFCA5A5),
        onError = Color(0xFF450A0A),
    )

private val PremiumLightScheme =
    lightColorScheme(
        primary = Color(0xFF9A6B2E),
        onPrimary = Color(0xFFFFFFFF),
        primaryContainer = Color(0xFFFFEFD2),
        onPrimaryContainer = Color(0xFF3D2608),
        secondary = Color(0xFF7C4A1A),
        onSecondary = Color(0xFFFFFFFF),
        secondaryContainer = Color(0xFFFFE8C8),
        onSecondaryContainer = Color(0xFF4A2800),
        background = Color(0xFFFFF4E8),
        onBackground = Color(0xFF1A1208),
        surface = Color(0xFFFFFAF4),
        onSurface = Color(0xFF1A1208),
        surfaceVariant = Color(0xFFF0E0D0),
        onSurfaceVariant = Color(0xFF5C4A3A),
        surfaceContainer = Color(0xFFF8EBDD),
        surfaceContainerHigh = Color(0xFFEFE0D0),
        surfaceContainerHighest = Color(0xFFE5D4C2),
        outline = Color(0xFF9A7B5C),
        outlineVariant = Color(0xFFD4C0A8),
        tertiary = Color(0xFF6D28D9),
        onTertiary = Color(0xFFFFFFFF),
        tertiaryContainer = Color(0xFFEDE9FE),
        onTertiaryContainer = Color(0xFF2E1065),
        error = Color(0xFFB91C1C),
        onError = Color(0xFFFFFFFF),
    )

private val EmeraldDarkScheme =
    darkColorScheme(
        primary = Color(0xFF6EE7B7),
        onPrimary = Color(0xFF052E1C),
        primaryContainer = Color(0xFF065F46),
        onPrimaryContainer = Color(0xFFD1FAE5),
        secondary = Color(0xFF5EEAD4),
        onSecondary = Color(0xFF042F2E),
        secondaryContainer = Color(0xFF115E59),
        onSecondaryContainer = Color(0xFFCCFBF1),
        tertiary = Color(0xFFA7F3D0),
        onTertiary = Color(0xFF064E3B),
        tertiaryContainer = Color(0xFF047857),
        onTertiaryContainer = Color(0xFFECFDF5),
        background = Color(0xFF071510),
        onBackground = Color(0xFFE8FFF4),
        surface = Color(0xFF0F1F18),
        onSurface = Color(0xFFE8FFF4),
        surfaceVariant = Color(0xFF1F3A2E),
        onSurfaceVariant = Color(0xFFB7E4CE),
        surfaceContainer = Color(0xFF142820),
        surfaceContainerHigh = Color(0xFF1A3328),
        surfaceContainerHighest = Color(0xFF214032),
        outline = Color(0x6634D399),
        outlineVariant = Color(0x4034D399),
        error = Color(0xFFFFB4AB),
        onError = Color(0xFF690005),
    )

private val EmeraldLightScheme =
    lightColorScheme(
        primary = Color(0xFF059669),
        onPrimary = Color(0xFFFFFFFF),
        primaryContainer = Color(0xFFD1FAE5),
        onPrimaryContainer = Color(0xFF064E3B),
        secondary = Color(0xFF0D9488),
        onSecondary = Color(0xFFFFFFFF),
        secondaryContainer = Color(0xFFCCFBF1),
        onSecondaryContainer = Color(0xFF134E4A),
        background = Color(0xFFF0FDF4),
        onBackground = Color(0xFF052E16),
        surface = Color(0xFFFAFFFC),
        onSurface = Color(0xFF052E16),
        surfaceVariant = Color(0xFFDCEFE4),
        onSurfaceVariant = Color(0xFF355945),
        surfaceContainer = Color(0xFFE8F7EE),
        surfaceContainerHigh = Color(0xFFDAF0E3),
        surfaceContainerHighest = Color(0xFFCBE8D8),
        outline = Color(0xFF6B9B7F),
        outlineVariant = Color(0xFFB8D4C4),
        tertiary = Color(0xFF047857),
        onTertiary = Color(0xFFFFFFFF),
        tertiaryContainer = Color(0xFFA7F3D0),
        onTertiaryContainer = Color(0xFF064E3B),
        error = Color(0xFFB3261E),
        onError = Color(0xFFFFFFFF),
    )

private val MidnightDarkScheme =
    darkColorScheme(
        primary = Color(0xFFA5B4FC),
        onPrimary = Color(0xFF1E1B4B),
        primaryContainer = Color(0xFF312E81),
        onPrimaryContainer = Color(0xFFE0E7FF),
        secondary = Color(0xFFC4B5FD),
        onSecondary = Color(0xFF2E1065),
        secondaryContainer = Color(0xFF4C1D95),
        onSecondaryContainer = Color(0xFFEDE9FE),
        tertiary = Color(0xFF818CF8),
        onTertiary = Color(0xFF1E1B4B),
        tertiaryContainer = Color(0xFF3730A3),
        onTertiaryContainer = Color(0xFFEEF2FF),
        background = Color(0xFF030712),
        onBackground = Color(0xFFE8EAFF),
        surface = Color(0xFF0B1020),
        onSurface = Color(0xFFE8EAFF),
        surfaceVariant = Color(0xFF1E2238),
        onSurfaceVariant = Color(0xFFC7CBEF),
        surfaceContainer = Color(0xFF111827),
        surfaceContainerHigh = Color(0xFF161D31),
        surfaceContainerHighest = Color(0xFF1C2540),
        outline = Color(0x66818CF8),
        outlineVariant = Color(0x40818CF8),
        error = Color(0xFFFCA5A5),
        onError = Color(0xFF450A0A),
    )

private val MidnightLightScheme =
    lightColorScheme(
        primary = Color(0xFF4338CA),
        onPrimary = Color(0xFFFFFFFF),
        primaryContainer = Color(0xFFE0E7FF),
        onPrimaryContainer = Color(0xFF1E1B4B),
        secondary = Color(0xFF6D28D9),
        onSecondary = Color(0xFFFFFFFF),
        secondaryContainer = Color(0xFFEDE9FE),
        onSecondaryContainer = Color(0xFF2E1065),
        background = Color(0xFFF5F7FF),
        onBackground = Color(0xFF0F172A),
        surface = Color(0xFFFCFDFF),
        onSurface = Color(0xFF0F172A),
        surfaceVariant = Color(0xFFE2E8F8),
        onSurfaceVariant = Color(0xFF475569),
        surfaceContainer = Color(0xFFE8EDFA),
        surfaceContainerHigh = Color(0xFFDCE4F5),
        surfaceContainerHighest = Color(0xFFD0D9F0),
        outline = Color(0xFF94A3B8),
        outlineVariant = Color(0xFFCBD5E1),
        tertiary = Color(0xFF4F46E5),
        onTertiary = Color(0xFFFFFFFF),
        tertiaryContainer = Color(0xFFC7D2FE),
        onTertiaryContainer = Color(0xFF1E1B4B),
        error = Color(0xFFB3261E),
        onError = Color(0xFFFFFFFF),
    )

/** Stealth Premium — pure black, silver text, ultra-thin precision (no rainbow accents). */
private val ObsidianDarkScheme =
    darkColorScheme(
        primary = Color(0xFFE8E8E8),
        onPrimary = Color(0xFF000000),
        primaryContainer = Color(0xFF1A1A1A),
        onPrimaryContainer = Color(0xFFF5F5F5),
        secondary = Color(0xFFB0B0B0),
        onSecondary = Color(0xFF000000),
        secondaryContainer = Color(0xFF121212),
        onSecondaryContainer = Color(0xFFE0E0E0),
        tertiary = Color(0xFFC8C8C8),
        onTertiary = Color(0xFF000000),
        tertiaryContainer = Color(0xFF1C1C1C),
        onTertiaryContainer = Color(0xFFF0F0F0),
        background = Color(0xFF000000),
        onBackground = Color(0xFFF5F5F5),
        surface = Color(0xFF121212),
        onSurface = Color(0xFFF5F5F5),
        surfaceVariant = Color(0xFF1C1C1C),
        onSurfaceVariant = Color(0xFFB8B8B8),
        surfaceContainerLowest = Color(0xFF000000),
        surfaceContainerLow = Color(0xFF0A0A0A),
        surfaceContainer = Color(0xFF121212),
        surfaceContainerHigh = Color(0xFF181818),
        surfaceContainerHighest = Color(0xFF1E1E1E),
        outline = Color(0x66FFFFFF),
        outlineVariant = Color(0x33FFFFFF),
        error = Color(0xFFFFB4AB),
        onError = Color(0xFF690005),
    )

private val ObsidianLightScheme =
    lightColorScheme(
        primary = Color(0xFF121212),
        onPrimary = Color(0xFFFFFFFF),
        primaryContainer = Color(0xFFE8E8E8),
        onPrimaryContainer = Color(0xFF000000),
        secondary = Color(0xFF424242),
        onSecondary = Color(0xFFFFFFFF),
        secondaryContainer = Color(0xFFF0F0F0),
        onSecondaryContainer = Color(0xFF121212),
        tertiary = Color(0xFF2A2A2A),
        onTertiary = Color(0xFFFFFFFF),
        tertiaryContainer = Color(0xFFE0E0E0),
        onTertiaryContainer = Color(0xFF000000),
        background = Color(0xFFFAFAFA),
        onBackground = Color(0xFF000000),
        surface = Color(0xFFFFFFFF),
        onSurface = Color(0xFF000000),
        surfaceVariant = Color(0xFFF0F0F0),
        onSurfaceVariant = Color(0xFF424242),
        surfaceContainer = Color(0xFFF5F5F5),
        surfaceContainerHigh = Color(0xFFEEEEEE),
        surfaceContainerHighest = Color(0xFFE8E8E8),
        outline = Color(0xFF9E9E9E),
        outlineVariant = Color(0xFFBDBDBD),
        error = Color(0xFFB3261E),
        onError = Color(0xFFFFFFFF),
    )

/** Тёплый нейтральный seed, если dynamic color недоступен (API < 31 или сбой). */
private val SystemFallbackLight =
    lightColorScheme(
        primary = Color(0xFF8B4D2F),
        onPrimary = Color(0xFFFFFFFF),
        primaryContainer = Color(0xFFFFDAD1),
        onPrimaryContainer = Color(0xFF3D0900),
        secondary = Color(0xFF6F5B52),
        onSecondary = Color(0xFFFFFFFF),
        secondaryContainer = Color(0xFFFADFD5),
        onSecondaryContainer = Color(0xFF281712),
        tertiary = Color(0xFF6B6237),
        onTertiary = Color(0xFFFFFFFF),
        tertiaryContainer = Color(0xFFF4E6BB),
        onTertiaryContainer = Color(0xFF221B00),
        background = Color(0xFFFFF8F4),
        onBackground = Color(0xFF1C1512),
        surface = Color(0xFFFFFBF8),
        onSurface = Color(0xFF1C1512),
        surfaceVariant = Color(0xFFF0E2DA),
        onSurfaceVariant = Color(0xFF52443B),
        surfaceContainer = Color(0xFFF7EDE7),
        surfaceContainerHigh = Color(0xFFEFE3DC),
        outline = Color(0xFF85756C),
        outlineVariant = Color(0xFFD7C6BC),
        error = Color(0xFFB3261E),
        onError = Color(0xFFFFFFFF),
    )

private val SystemFallbackDark =
    darkColorScheme(
        primary = Color(0xFFFFB59A),
        onPrimary = Color(0xFF571E0A),
        primaryContainer = Color(0xFF73341F),
        onPrimaryContainer = Color(0xFFFFDBCF),
        secondary = Color(0xFFD7C2B7),
        onSecondary = Color(0xFF3D2D27),
        secondaryContainer = Color(0xFF55433C),
        onSecondaryContainer = Color(0xFFFFE7DE),
        tertiary = Color(0xFFD2C891),
        onTertiary = Color(0xFF383012),
        tertiaryContainer = Color(0xFF4F4626),
        onTertiaryContainer = Color(0xFFECE4B4),
        background = Color(0xFF161210),
        onBackground = Color(0xFFEDE0DA),
        surface = Color(0xFF1E1816),
        onSurface = Color(0xFFEDE0DA),
        surfaceVariant = Color(0xFF44342C),
        onSurfaceVariant = Color(0xFFDCC2B6),
        surfaceContainer = Color(0xFF241E1A),
        surfaceContainerHigh = Color(0xFF2F2722),
        outline = Color(0xFF9B8B81),
        outlineVariant = Color(0xFF52443C),
        error = Color(0xFFF2B8B5),
        onError = Color(0xFF601410),
    )

private val MobileTypography = Typography(
    displayLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 52.sp,
        lineHeight = 60.sp,
        letterSpacing = (-0.25).sp,
    ),
    displayMedium = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 40.sp,
        lineHeight = 48.sp,
        letterSpacing = 0.sp,
    ),
    displaySmall = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 32.sp,
        lineHeight = 40.sp,
        letterSpacing = 0.sp,
    ),
    headlineLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 28.sp,
        lineHeight = 36.sp,
        letterSpacing = 0.sp,
    ),
    headlineMedium = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 24.sp,
        lineHeight = 32.sp,
        letterSpacing = 0.sp,
    ),
    headlineSmall = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 20.sp,
        lineHeight = 28.sp,
        letterSpacing = 0.sp,
    ),
    titleLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Medium,
        fontSize = 18.sp,
        lineHeight = 24.sp,
        letterSpacing = 0.sp,
    ),
    titleMedium = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Medium,
        fontSize = 14.sp,
        lineHeight = 20.sp,
        letterSpacing = 0.1.sp,
    ),
    titleSmall = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Medium,
        fontSize = 12.sp,
        lineHeight = 18.sp,
        letterSpacing = 0.1.sp,
    ),
    bodyLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp,
        lineHeight = 20.sp,
        letterSpacing = 0.25.sp,
    ),
    bodyMedium = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 12.sp,
        lineHeight = 18.sp,
        letterSpacing = 0.25.sp,
    ),
    bodySmall = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 11.sp,
        lineHeight = 16.sp,
        letterSpacing = 0.4.sp,
    ),
    labelLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Medium,
        fontSize = 12.sp,
        lineHeight = 18.sp,
        letterSpacing = 0.1.sp,
    ),
    labelMedium = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Medium,
        fontSize = 10.sp,
        lineHeight = 14.sp,
        letterSpacing = 0.5.sp,
    ),
    labelSmall = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Medium,
        fontSize = 9.sp,
        lineHeight = 14.sp,
        letterSpacing = 0.5.sp,
    ),
)

/** Скругления чуть выше M3 по умолчанию — единый «мягкий» силуэт приложения. */
private val MobileShapes =
    Shapes(
        extraSmall = RoundedCornerShape(12.dp),
        small = RoundedCornerShape(16.dp),
        medium = RoundedCornerShape(22.dp),
        large = RoundedCornerShape(28.dp),
        extraLarge = RoundedCornerShape(36.dp),
    )

@Composable
fun EmperyMobileTheme(
    mobileStyle: MobileUiStyle,
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val context = LocalContext.current
    val view = LocalView.current
    val colorScheme =
        when (mobileStyle) {
            MobileUiStyle.SYSTEM -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    runCatching {
                        if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
                    }.getOrElse {
                        if (darkTheme) SystemFallbackDark else SystemFallbackLight
                    }
                } else {
                    if (darkTheme) SystemFallbackDark else SystemFallbackLight
                }
            }
            MobileUiStyle.GLASS -> if (darkTheme) GlassDarkScheme else GlassLightScheme
            MobileUiStyle.PREMIUM -> if (darkTheme) PremiumDarkScheme else PremiumLightScheme
            MobileUiStyle.EMERALD -> if (darkTheme) EmeraldDarkScheme else EmeraldLightScheme
            MobileUiStyle.MIDNIGHT -> if (darkTheme) MidnightDarkScheme else MidnightLightScheme
            MobileUiStyle.OBSIDIAN -> if (darkTheme) ObsidianDarkScheme else ObsidianLightScheme
        }

    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            val insetsController = WindowCompat.getInsetsController(window, view)
            val useLightStatusBarIcons = !darkTheme
            insetsController.isAppearanceLightStatusBars = useLightStatusBarIcons
            insetsController.isAppearanceLightNavigationBars = useLightStatusBarIcons
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = MobileTypography,
        shapes = MobileShapes,
        content = content,
    )
}
