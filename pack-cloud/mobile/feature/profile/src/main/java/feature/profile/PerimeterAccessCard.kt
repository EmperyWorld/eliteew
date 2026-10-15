/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Profile card showing network access status and auto-renew controls (user-facing copy only).
 *
 * Invariants:
 * - Does not display IP addresses or SG TTL values.
 *
 * Related:
 * - ProfileScreen, PerimeterAccessRepository
 */
package feature.profile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material3.MaterialTheme
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.VerifiedUser
import world.empery.mobile.core.ui.ScaledButton
import world.empery.mobile.core.ui.ScaledOutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import world.empery.mobile.core.ui.PremiumRowSurface
import world.empery.mobile.core.ui.PremiumSectionCard
import java.text.DateFormat
import java.util.Date

@Composable
fun PerimeterAccessCard(
    state: PerimeterAccessUiState,
    appSessionActive: Boolean,
    onRenewAccess: () -> Unit,
    onAutoRenewChange: (Boolean) -> Unit,
    onCheckAccess: () -> Unit,
    modifier: Modifier = Modifier,
) {
    PremiumSectionCard(
        modifier = modifier.fillMaxWidth(),
        title = stringResource(R.string.perimeter_card_title),
        subtitle = stringResource(R.string.perimeter_card_subtitle),
        icon = Icons.Outlined.Shield,
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            PerimeterStatusRow(
                label = stringResource(R.string.perimeter_yandex_row_label),
                value = perimeterStatusLabel(state.status),
                pill = { PerimeterStatusPill(status = state.status) },
            )

            PerimeterStatusRow(
                label = stringResource(R.string.perimeter_keycloak_row_label),
                value =
                    if (appSessionActive) {
                        stringResource(R.string.perimeter_app_session_active)
                    } else {
                        stringResource(R.string.perimeter_app_session_required)
                    },
                pill = {
                    PerimeterSessionPill(active = appSessionActive)
                },
            )

            state.lastCheckedAtMs?.let { checkedAt ->
                Text(
                    text =
                        stringResource(
                            R.string.perimeter_last_probe,
                            DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT)
                                .format(Date(checkedAt)),
                        ),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            if (state.healthUnavailable) {
                Text(
                    text = stringResource(R.string.perimeter_health_unavailable),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                )
            }

            if (state.requiresManualYandexAuth()) {
                PerimeterManualAuthSection(
                    autoRenewFailed = state.autoRenewFailed,
                    renewing = state.status == PerimeterAccessStatus.Renewing,
                    onSignInWithYandex = onRenewAccess,
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                if (!state.requiresManualYandexAuth()) {
                    ScaledButton(
                        onClick = onRenewAccess,
                        enabled = state.status != PerimeterAccessStatus.Renewing,
                        label = stringResource(R.string.perimeter_renew_action),
                        icon = Icons.Outlined.VerifiedUser,
                        modifier = Modifier.weight(1f),
                    )
                }
                ScaledOutlinedButton(
                    onClick = onCheckAccess,
                    enabled = state.status != PerimeterAccessStatus.Checking && state.status != PerimeterAccessStatus.Renewing,
                    label = stringResource(R.string.perimeter_check_action),
                    icon = Icons.Outlined.Refresh,
                    modifier = if (state.requiresManualYandexAuth()) Modifier.fillMaxWidth() else Modifier.weight(1f),
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = stringResource(R.string.perimeter_auto_renew_title),
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium,
                    )
                    Text(
                        text = stringResource(R.string.perimeter_auto_renew_hint),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Switch(
                    checked = state.autoRenewEnabled,
                    onCheckedChange = onAutoRenewChange,
                )
            }
        }
    }
}

@Composable
private fun perimeterStatusLabel(status: PerimeterAccessStatus): String =
    when (status) {
        PerimeterAccessStatus.Checking -> stringResource(R.string.perimeter_status_checking)
        PerimeterAccessStatus.Open -> stringResource(R.string.perimeter_status_open)
        PerimeterAccessStatus.Closed -> stringResource(R.string.perimeter_status_closed)
        PerimeterAccessStatus.Renewing -> stringResource(R.string.perimeter_status_renewing)
        PerimeterAccessStatus.Unknown -> stringResource(R.string.perimeter_status_unknown)
    }

@Composable
private fun PerimeterStatusPill(status: PerimeterAccessStatus) {
    val (label, container, content) =
        when (status) {
            PerimeterAccessStatus.Open ->
                Triple(
                    stringResource(R.string.perimeter_pill_open),
                    MaterialTheme.colorScheme.primaryContainer,
                    MaterialTheme.colorScheme.onPrimaryContainer,
                )
            PerimeterAccessStatus.Closed ->
                Triple(
                    stringResource(R.string.perimeter_pill_closed),
                    MaterialTheme.colorScheme.errorContainer,
                    MaterialTheme.colorScheme.onErrorContainer,
                )
            PerimeterAccessStatus.Renewing, PerimeterAccessStatus.Checking ->
                Triple(
                    stringResource(R.string.perimeter_pill_pending),
                    MaterialTheme.colorScheme.secondaryContainer,
                    MaterialTheme.colorScheme.onSecondaryContainer,
                )
            PerimeterAccessStatus.Unknown ->
                Triple(
                    stringResource(R.string.perimeter_pill_unknown),
                    MaterialTheme.colorScheme.surfaceVariant,
                    MaterialTheme.colorScheme.onSurfaceVariant,
                )
        }
    Surface(
        shape = RoundedCornerShape(999.dp),
        color = container,
    ) {
        Text(
            text = label,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelMedium,
            color = content,
        )
    }
}

fun PerimeterAccessUiState.requiresManualYandexAuth(): Boolean =
    status == PerimeterAccessStatus.Closed || autoRenewFailed

@Composable
fun PerimeterManualAuthSection(
    autoRenewFailed: Boolean,
    renewing: Boolean,
    onSignInWithYandex: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            text =
                if (autoRenewFailed) {
                    stringResource(R.string.perimeter_manual_auth_failed_hint)
                } else {
                    stringResource(R.string.perimeter_manual_auth_required_hint)
                },
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.error,
        )
        ScaledButton(
            onClick = onSignInWithYandex,
            enabled = !renewing,
            label = stringResource(R.string.perimeter_manual_yandex_action),
            icon = Icons.Outlined.VerifiedUser,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
fun PerimeterManualAuthBanner(
    autoRenewFailed: Boolean,
    renewing: Boolean,
    onSignInWithYandex: () -> Unit,
    modifier: Modifier = Modifier,
) {
    PremiumRowSurface(
        modifier = modifier.fillMaxWidth(),
        containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.72f),
        borderColor = MaterialTheme.colorScheme.error.copy(alpha = 0.28f),
        tonalElevation = 2.dp,
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text =
                    if (autoRenewFailed) {
                        stringResource(R.string.perimeter_banner_failed)
                    } else {
                        stringResource(R.string.perimeter_banner_closed)
                    },
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onErrorContainer,
            )
            ScaledButton(
                onClick = onSignInWithYandex,
                enabled = !renewing,
                label = stringResource(R.string.perimeter_manual_yandex_action),
                icon = Icons.Outlined.VerifiedUser,
            )
        }
    }
}


@Composable
private fun PerimeterStatusRow(
    label: String,
    value: String,
    pill: @Composable () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = value,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.SemiBold,
            )
        }
        pill()
    }
}

@Composable
private fun PerimeterSessionPill(active: Boolean) {
    val (label, container, content) =
        if (active) {
            Triple(
                stringResource(R.string.perimeter_pill_session_active),
                MaterialTheme.colorScheme.primaryContainer,
                MaterialTheme.colorScheme.onPrimaryContainer,
            )
        } else {
            Triple(
                stringResource(R.string.perimeter_pill_session_inactive),
                MaterialTheme.colorScheme.surfaceVariant,
                MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    Surface(shape = RoundedCornerShape(999.dp), color = container) {
        Text(
            text = label,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelMedium,
            color = content,
        )
    }
}
