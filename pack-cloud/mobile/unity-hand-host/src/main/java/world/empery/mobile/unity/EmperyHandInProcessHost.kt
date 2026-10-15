package world.empery.mobile.unity

import android.app.Activity
import android.util.Log
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import androidx.lifecycle.setViewTreeLifecycleOwner
import androidx.compose.material3.darkColorScheme

/**
 * Native Compose host for Unity MR palm overlay (same APK / bundled AAR).
 */
object EmperyHandInProcessHost {
    private const val LOG_TAG = "EmperyHandNative"
    private val panels = mutableMapOf<String, PanelEntry>()

    @JvmStatic
    fun attach(
        activity: Activity,
        container: FrameLayout,
        panelId: String,
        route: String,
        x: Int,
        y: Int,
        width: Int,
        height: Int,
    ): Boolean {
        return try {
            val existing = panels[panelId]
            if (existing != null && existing.route == route) {
                return true
            }

            val lifecycleOwner = activity as? LifecycleOwner ?: UnityLifecycleOwner(activity)
            container.removeAllViews()
            val composeView =
                ComposeView(activity).apply {
                    setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
                    setViewTreeLifecycleOwner(lifecycleOwner)
                    setContent {
                        MaterialTheme(colorScheme = darkColorScheme()) {
                            HandEmbedRoute(route = route)
                        }
                    }
                }
            container.addView(
                composeView,
                FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT,
                ),
            )
            panels[panelId] = PanelEntry(composeView, lifecycleOwner, route)
            Log.i(LOG_TAG, "compose attached panel=$panelId route=$route")
            true
        } catch (t: Throwable) {
            Log.e(LOG_TAG, "compose attach failed panel=$panelId", t)
            false
        }
    }

    @JvmStatic
    fun detach(panelId: String) {
        panels.remove(panelId)
    }

    @Composable
    private fun HandEmbedRoute(route: String) {
        val title =
            when (route.lowercase()) {
                "ugs", "ai" -> "Empery AI"
                else -> "Empery Chat"
            }
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(Color(0xFF141820)),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = title,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }

    private data class PanelEntry(
        val composeView: ComposeView,
        val lifecycleOwner: LifecycleOwner,
        val route: String,
    )

    private class UnityLifecycleOwner(activity: Activity) : LifecycleOwner {
        private val registry = LifecycleRegistry(this)

        init {
            registry.currentState = Lifecycle.State.RESUMED
        }

        override val lifecycle: Lifecycle
            get() = registry
    }
}
