package world.empery.mobile.theme

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import feature.profile.MobileUiStyle

/** Дополнительный фон под контентом (градиенты в духе веб glass / premium). */
@Composable
fun MobileThemeGradientLayer(
    style: MobileUiStyle,
    darkTheme: Boolean,
    modifier: Modifier = Modifier,
) {
    if (style == MobileUiStyle.SYSTEM) return

    val brush =
        when (style) {
            MobileUiStyle.GLASS -> {
                if (darkTheme) {
                    Brush.verticalGradient(
                        colors =
                            listOf(
                                Color(0xFF060A10),
                                Color(0xFF0F2438),
                                Color(0xFF1E3A52),
                                Color(0xFF102030),
                                Color(0xFF060A10),
                            ),
                    )
                } else {
                    Brush.verticalGradient(
                        colors =
                            listOf(
                                Color(0xFFF8FDFF),
                                Color(0xFFE8F6FF),
                                Color(0xFFD6EEFF),
                                Color(0xFFEAF7FF),
                                Color(0xFFF8FDFF),
                            ),
                    )
                }
            }
            MobileUiStyle.PREMIUM -> {
                if (darkTheme) {
                    Brush.verticalGradient(
                        colors =
                            listOf(
                                Color(0xFF000000),
                                Color(0xFF2E1065),
                                Color(0xFF451A03),
                                Color(0xFF1A1208),
                                Color(0xFF000000),
                            ),
                    )
                } else {
                    Brush.verticalGradient(
                        colors =
                            listOf(
                                Color(0xFFFFF0DC),
                                Color(0xFFFFE4B5),
                                Color(0xFFFEF3C7),
                                Color(0xFFEDE9FE),
                                Color(0xFFFFF0DC),
                            ),
                    )
                }
            }
            MobileUiStyle.EMERALD -> {
                if (darkTheme) {
                    Brush.verticalGradient(
                        colors =
                            listOf(
                                Color(0xFF03140E),
                                Color(0xFF064E3B),
                                Color(0xFF065F46),
                                Color(0xFF042F2E),
                                Color(0xFF03140E),
                            ),
                    )
                } else {
                    Brush.verticalGradient(
                        colors =
                            listOf(
                                Color(0xFFF7FEF9),
                                Color(0xFFECFDF5),
                                Color(0xFFD1FAE5),
                                Color(0xFFCCFBF1),
                                Color(0xFFF7FEF9),
                            ),
                    )
                }
            }
            MobileUiStyle.MIDNIGHT -> {
                if (darkTheme) {
                    Brush.verticalGradient(
                        colors =
                            listOf(
                                Color(0xFF020617),
                                Color(0xFF1E1B4B),
                                Color(0xFF312E81),
                                Color(0xFF0F172A),
                                Color(0xFF020617),
                            ),
                    )
                } else {
                    Brush.verticalGradient(
                        colors =
                            listOf(
                                Color(0xFFF8FAFF),
                                Color(0xFFEEF2FF),
                                Color(0xFFE0E7FF),
                                Color(0xFFEDE9FE),
                                Color(0xFFF8FAFF),
                            ),
                    )
                }
            }
            MobileUiStyle.OBSIDIAN -> {
                if (darkTheme) {
                    Brush.verticalGradient(
                        colors =
                            listOf(
                                Color(0xFF000000),
                                Color(0xFF0A0A0A),
                                Color(0xFF121212),
                                Color(0xFF0A0A0A),
                                Color(0xFF000000),
                            ),
                    )
                } else {
                    Brush.verticalGradient(
                        colors =
                            listOf(
                                Color(0xFFFAFAFA),
                                Color(0xFFF0F0F0),
                                Color(0xFFE8E8E8),
                                Color(0xFFF5F5F5),
                                Color(0xFFFAFAFA),
                            ),
                    )
                }
            }
            MobileUiStyle.SYSTEM -> return
        }

    Box(
        modifier =
            modifier
                .fillMaxSize()
                .background(brush),
    )
}
