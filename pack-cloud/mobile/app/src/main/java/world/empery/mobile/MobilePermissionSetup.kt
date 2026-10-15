/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Post-login permission rationale dialog and denied-state banner for camera, mic, notifications, media/storage.
 *
 * Invariants:
 * - Rationale shown once per install until operator clears app data (SharedPreferences gate).
 *
 * Related:
 * - MainActivity, MobilePermissions.kt, NotificationPermissionUi.kt
 */
package world.empery.mobile

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
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

object MobilePermissionSetupPrefs {
    private const val PREFS = "empery_mobile_permission_setup"
    private const val KEY_HANDLED = "handled_v1"

    fun shouldShowRationale(context: Context): Boolean =
        !context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_HANDLED, false)

    fun markHandled(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_HANDLED, true)
            .apply()
    }
}

@Composable
fun AppPermissionsRationaleDialog(
    visible: Boolean,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    if (!visible) return
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.app_permissions_rationale_title)) },
        text = { Text(stringResource(R.string.app_permissions_rationale_body)) },
        confirmButton = {
            TextButton(onClick = onConfirm) {
                Text(stringResource(R.string.app_permissions_rationale_allow))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.app_permissions_rationale_later))
            }
        },
    )
}

@Composable
fun AppPermissionsDeniedBanner(
    visible: Boolean,
    onOpenSettings: () -> Unit,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (!visible) return
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.92f),
        tonalElevation = 2.dp,
    ) {
        Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp)) {
            Text(
                text = stringResource(R.string.app_permissions_denied_banner),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onErrorContainer,
            )
            TextButton(onClick = onRetry) {
                Text(stringResource(R.string.app_permissions_retry))
            }
            TextButton(onClick = onOpenSettings) {
                Text(stringResource(R.string.app_permissions_open_settings))
            }
        }
    }
}

fun openAppPermissionSettings(context: Context) {
    context.startActivity(
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
    )
}
