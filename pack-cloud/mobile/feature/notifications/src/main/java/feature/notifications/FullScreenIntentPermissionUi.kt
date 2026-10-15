/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Android 14+ USE_FULL_SCREEN_INTENT special-access prompt for incoming video calls.
 * Not a runtime permission dialog — opens system Manage full-screen intents settings.
 *
 * Invariants:
 * - Pre-API 34 treated as granted (legacy auto-grant / no canUseFullScreenIntent API).
 * - Settings intent always includes package data URI (OEM ActivityNotFound otherwise).
 *
 * Related:
 * - MobilePermissionShell.kt, NotificationHelper.showIncomingVideoCall,
 *   documentation/product/mobile/MOBILE-ANDROID-PUSH-DEEPLINK-REGISTRY.md
 */
package feature.notifications

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp

object FullScreenIntentPermissionSetupPrefs {
    private const val PREFS = "empery_mobile_fullscreen_intent_permission"
    private const val KEY_RATIONALE_HANDLED = "rationale_handled_v1"

    fun shouldShowRationale(context: Context): Boolean =
        !context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getBoolean(KEY_RATIONALE_HANDLED, false)

    fun markRationaleHandled(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_RATIONALE_HANDLED, true)
            .apply()
    }
}

fun requiresFullScreenIntentPermissionPrompt(): Boolean =
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE

fun canUseFullScreenIntent(context: Context): Boolean {
    if (!requiresFullScreenIntentPermissionPrompt()) return true
    val nm = context.getSystemService(NotificationManager::class.java) ?: return true
    return nm.canUseFullScreenIntent()
}

fun openFullScreenIntentSettings(context: Context) {
    if (!requiresFullScreenIntentPermissionPrompt()) {
        openAppDetailsSettingsForFsi(context)
        return
    }
    val intent =
        Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT).apply {
            data = Uri.parse("package:${context.packageName}")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
    runCatching { context.startActivity(intent) }.onFailure {
        openAppDetailsSettingsForFsi(context)
    }
}

/** Activity-scoped launch (no NEW_TASK) for StartActivityForResult from Compose. */
fun fullScreenIntentSettingsIntent(context: Context): Intent {
    if (!requiresFullScreenIntentPermissionPrompt()) {
        return Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.parse("package:${context.packageName}"),
        )
    }
    return Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT).apply {
        data = Uri.parse("package:${context.packageName}")
    }
}

private fun openAppDetailsSettingsForFsi(context: Context) {
    context.startActivity(
        Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.parse("package:${context.packageName}"),
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
    )
}

@Composable
fun FullScreenIntentPermissionRationaleDialog(
    visible: Boolean,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    if (!visible) return
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.fullscreen_intent_permission_rationale_title)) },
        text = { Text(stringResource(R.string.fullscreen_intent_permission_rationale_body)) },
        confirmButton = {
            TextButton(onClick = onConfirm) {
                Text(stringResource(R.string.fullscreen_intent_permission_rationale_allow))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.fullscreen_intent_permission_rationale_later))
            }
        },
    )
}

@Composable
fun FullScreenIntentPermissionDeniedBanner(
    visible: Boolean,
    onOpenSettings: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (!visible) return
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.92f),
        tonalElevation = 2.dp,
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = stringResource(R.string.fullscreen_intent_permission_denied_banner),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onErrorContainer,
            )
            TextButton(onClick = onOpenSettings) {
                Text(stringResource(R.string.fullscreen_intent_permission_open_settings))
            }
        }
    }
}
