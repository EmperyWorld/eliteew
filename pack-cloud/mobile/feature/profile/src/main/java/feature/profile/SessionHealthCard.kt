/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Profile diagnostics card for SSO session health, token expiry hint, and socket lifecycle.
 *
 * Invariants:
 * - Never displays raw access or refresh tokens.
 *
 * Related:
 * - ProfileScreen, MainViewModel, AuthRepository
 */
package feature.profile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.HealthAndSafety
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import java.text.DateFormat
import java.util.Date
import world.empery.mobile.core.network.SocketLifecycleState
import world.empery.mobile.core.ui.PremiumSectionCard

data class SessionHealthUiState(
    val signedIn: Boolean = false,
    val displayName: String? = null,
    val email: String? = null,
    val accessTokenExpiresAtEpochSec: Long? = null,
    val socketLifecycle: SocketLifecycleState = SocketLifecycleState.Disconnected,
)

@Composable
fun SessionHealthCard(
    state: SessionHealthUiState,
    modifier: Modifier = Modifier,
) {
    PremiumSectionCard(
        modifier = modifier.fillMaxWidth(),
        title = stringResource(R.string.session_health_title),
        subtitle = stringResource(R.string.session_health_subtitle),
        icon = Icons.Outlined.HealthAndSafety,
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            SessionHealthRow(
                label = stringResource(R.string.session_health_sso_label),
                value =
                    if (state.signedIn) {
                        stringResource(R.string.session_health_sso_active)
                    } else {
                        stringResource(R.string.session_health_sso_inactive)
                    },
            )
            state.displayName?.takeIf { it.isNotBlank() }?.let { name ->
                SessionHealthRow(
                    label = stringResource(R.string.session_health_user_label),
                    value = name,
                )
            }
            state.email?.takeIf { it.isNotBlank() }?.let { email ->
                SessionHealthRow(
                    label = stringResource(R.string.session_health_email_label),
                    value = email,
                )
            }
            SessionHealthRow(
                label = stringResource(R.string.session_health_token_expiry_label),
                value = tokenExpiryLabel(state.accessTokenExpiresAtEpochSec),
            )
            SessionHealthRow(
                label = stringResource(R.string.session_health_socket_label),
                value = socketLifecycleLabel(state.socketLifecycle),
            )
        }
    }
}

@Composable
private fun SessionHealthRow(label: String, value: String) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Medium,
        )
    }
}

@Composable
private fun tokenExpiryLabel(expiresAtEpochSec: Long?): String {
    if (expiresAtEpochSec == null || expiresAtEpochSec <= 0L) {
        return stringResource(R.string.session_health_token_expiry_unknown)
    }
    val now = System.currentTimeMillis() / 1000L
    val remainingSec = expiresAtEpochSec - now
    return when {
        remainingSec <= 0L -> stringResource(R.string.session_health_token_expiry_expired)
        remainingSec < 120L -> stringResource(R.string.session_health_token_expiry_soon)
        else ->
            stringResource(
                R.string.session_health_token_expiry_at,
                DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT)
                    .format(Date(expiresAtEpochSec * 1000L)),
            )
    }
}

@Composable
private fun socketLifecycleLabel(state: SocketLifecycleState): String =
    when (state) {
        SocketLifecycleState.Disconnected -> stringResource(R.string.session_health_socket_disconnected)
        SocketLifecycleState.Connecting -> stringResource(R.string.session_health_socket_connecting)
        SocketLifecycleState.Connected -> stringResource(R.string.session_health_socket_connected)
        SocketLifecycleState.Reconnecting -> stringResource(R.string.session_health_socket_reconnecting)
        SocketLifecycleState.Error -> stringResource(R.string.session_health_socket_error)
    }
