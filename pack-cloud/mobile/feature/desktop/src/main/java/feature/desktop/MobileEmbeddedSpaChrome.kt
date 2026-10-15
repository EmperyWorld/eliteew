// ---
// EliteEW · Empery World
// https://empery.world
// Author: po&T && TZBrand
// ---
// Purpose:
// Compose chrome for embedded SPA WebView host — matches `#/mobile-*` shell on app.eliteew.ru.
// Invariants:
// - Background aligns with SPA `--theme-background` (#0B0F17); close uses scale-aware outlined control.
// Related:
// - EmperyMobileEmbeddedSpaWebViewActivity.kt, MobileEmbeddedShell.tsx
// ---
package feature.desktop

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat
import world.empery.mobile.core.ui.ScaledOutlinedButton

private val EmbeddedSpaBackground = Color(0xFF0B0F17)
private val EmbeddedSpaSurface = Color(0xFF121820)
private val EmbeddedSpaAccent = Color(0xFFC4E830)

@Composable
fun MobileEmbeddedSpaTheme(content: @Composable () -> Unit) {
    val view = LocalView.current
    SideEffect {
        val window = view.context.findActivity()?.window ?: return@SideEffect
        WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = false
    }
    MaterialTheme(
        colorScheme =
            darkColorScheme(
                primary = EmbeddedSpaAccent,
                onPrimary = Color(0xFF0B0F17),
                background = EmbeddedSpaBackground,
                onBackground = Color(0xFFE8ECF2),
                surface = EmbeddedSpaSurface,
                onSurface = Color(0xFFE8ECF2),
                onSurfaceVariant = Color(0xFF96A0B4),
                outline = Color(0x33FFFFFF),
                outlineVariant = Color(0x1FFFFFFF),
            ),
        content = content,
    )
}

@Composable
fun MobileEmbeddedSpaHost(
    closeLabel: String,
    title: String?,
    onClose: () -> Unit,
    content: @Composable () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(EmbeddedSpaBackground),
    ) {
        MobileEmbeddedSpaTopBar(
            closeLabel = closeLabel,
            title = title,
            onClose = onClose,
        )
        Box(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .background(EmbeddedSpaBackground)
                    .windowInsetsPadding(WindowInsets.navigationBars),
        ) {
            content()
        }
    }
}

@Composable
private fun MobileEmbeddedSpaTopBar(
    closeLabel: String,
    title: String?,
    onClose: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(
                    Brush.verticalGradient(
                        colors =
                            listOf(
                                EmbeddedSpaSurface.copy(alpha = 0.98f),
                                EmbeddedSpaBackground,
                            ),
                    ),
                )
                .windowInsetsPadding(WindowInsets.statusBars),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            ScaledOutlinedButton(
                onClick = onClose,
                enabled = true,
                label = closeLabel,
                icon = Icons.AutoMirrored.Outlined.ArrowBack,
                modifier = Modifier,
            )
            if (!title.isNullOrBlank()) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
            }
        }
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
    }
}

private fun android.content.Context.findActivity(): android.app.Activity? {
    var ctx = this
    while (ctx is android.content.ContextWrapper) {
        if (ctx is android.app.Activity) return ctx
        ctx = ctx.baseContext
    }
    return null
}
