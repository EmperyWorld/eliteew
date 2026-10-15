/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Auth session gate UI extracted from MainActivity: SSO login shell, browser picker,
 * biometric unlock, and session-replace confirm. Hosts authenticated content via slot.
 *
 * Invariants:
 * - Unauthenticated takes precedence over biometric gate (same as pre-split MobileRoot).
 * - SSO launch plans stay mapped via [ssoLoginShellStepForPlan]; Activity owns launchers.
 * - Package remains [world.empery.mobile] so [SsoLoginShellStep] stays internal for unit tests.
 *
 * Related:
 * - MainActivity MobileRoot, BiometricAuthCoordinator, MOBILE-ANDROID-PRODUCT-PERFECTION-PLAN.md W1
 */
package world.empery.mobile

import android.content.Intent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.VerifiedUser
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import world.empery.mobile.core.auth.MobileSsoBrowserChoiceRequest
import world.empery.mobile.core.auth.MobileSsoLaunchPlan
import world.empery.mobile.core.ui.PremiumDividerGlow
import world.empery.mobile.core.ui.PremiumGlassCard
import world.empery.mobile.core.ui.PremiumIconTile
import world.empery.mobile.core.ui.ScaledButton
import world.empery.mobile.core.ui.ScaledOutlinedButton
import feature.profile.PerimeterAccessStatus
import feature.profile.PerimeterAccessUiState
import feature.profile.requiresManualYandexAuth

/**
 * SSO login uses [MobileSsoLaunchPlan] from [MainViewModel.prepareSsoLoginLaunchPlan]:
 * production login launches in-app WebView; browser/Custom Tabs plans are legacy shell mappings.
 */
internal sealed class SsoLoginShellStep {
    data class LaunchIntent(val intent: Intent) : SsoLoginShellStep()

    data class ShowBrowserPicker(val request: MobileSsoBrowserChoiceRequest) : SsoLoginShellStep()
}

internal fun ssoLoginShellStepForPlan(plan: MobileSsoLaunchPlan): SsoLoginShellStep =
    when (plan) {
        is MobileSsoLaunchPlan.InAppWebView -> SsoLoginShellStep.LaunchIntent(plan.intent)
        is MobileSsoLaunchPlan.DirectAppAuth -> SsoLoginShellStep.LaunchIntent(plan.intent)
        is MobileSsoLaunchPlan.ChooseBrowser -> SsoLoginShellStep.ShowBrowserPicker(plan.request)
    }

@Composable
internal fun AuthSessionGate(
    shell: MobileShellUiState,
    perimeterAccess: PerimeterAccessUiState,
    biometricPromptInFlight: Boolean,
    onBiometricUnlockRequest: () -> Unit,
    onStartLogin: () -> Unit,
    onClearAuthError: () -> Unit,
    onDismissSessionReplaceConfirm: () -> Unit,
    onConfirmSessionReplace: () -> Unit,
    onSignInYandexPerimeter: () -> Unit,
    ssoBrowserChoiceRequest: MobileSsoBrowserChoiceRequest?,
    onSsoBrowserSelected: (String) -> Unit,
    onSsoBrowserDismissed: () -> Unit,
    authenticatedContent: @Composable () -> Unit,
) {
    if (!shell.isAuthenticated) {
        LoginRequiredScreen(
            authInProgress = shell.authInProgress,
            authError = shell.authError,
            perimeterAccess = perimeterAccess,
            onSignInYandexPerimeter = onSignInYandexPerimeter,
            onStartLogin = onStartLogin,
            onClearAuthError = onClearAuthError,
        )
        if (shell.sessionReplaceConfirmVisible) {
            AlertDialog(
                onDismissRequest = onDismissSessionReplaceConfirm,
                title = { Text(stringResource(R.string.app_auth_session_replace_title)) },
                text = { Text(stringResource(R.string.app_auth_session_replace_body)) },
                confirmButton = {
                    TextButton(onClick = onConfirmSessionReplace) {
                        Text(stringResource(R.string.app_auth_session_replace_confirm))
                    }
                },
                dismissButton = {
                    TextButton(onClick = onDismissSessionReplaceConfirm) {
                        Text(stringResource(R.string.app_auth_session_replace_cancel))
                    }
                },
            )
        }
        ssoBrowserChoiceRequest?.let { browserChoiceRequest ->
            SsoBrowserPickerDialog(
                request = browserChoiceRequest,
                onSelect = onSsoBrowserSelected,
                onDismiss = onSsoBrowserDismissed,
            )
        }
    } else if (shell.requiresBiometricUnlock) {
        BiometricUnlockScreen(
            isPrompting = biometricPromptInFlight,
            gateError = shell.biometricGateError,
            onUnlockClick = onBiometricUnlockRequest,
        )
    } else {
        authenticatedContent()
    }
}

@Composable
private fun SsoBrowserPickerDialog(
    request: MobileSsoBrowserChoiceRequest,
    onSelect: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(28.dp),
            tonalElevation = 6.dp,
            color = MaterialTheme.colorScheme.surface,
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    text = stringResource(world.empery.mobile.core.auth.R.string.auth_sso_browser_picker_title),
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(stringResource(world.empery.mobile.core.auth.R.string.auth_sso_browser_picker_subtitle))
                Text(
                    text = stringResource(world.empery.mobile.core.auth.R.string.auth_sso_browser_picker_hint),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                LazyColumn(
                    modifier = Modifier.heightIn(max = 320.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    items(request.options, key = { option -> option.packageName }) { option ->
                        TextButton(
                            onClick = { onSelect(option.packageName) },
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Text(
                                text = option.label,
                                modifier = Modifier.fillMaxWidth(),
                                textAlign = TextAlign.Start,
                            )
                        }
                    }
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                ) {
                    TextButton(onClick = onDismiss) {
                        Text(stringResource(world.empery.mobile.core.auth.R.string.auth_sso_browser_picker_cancel))
                    }
                }
            }
        }
    }
}

@Composable
private fun BiometricUnlockScreen(
    isPrompting: Boolean,
    gateError: String?,
    onUnlockClick: () -> Unit,
) {
    // Open the system BiometricPrompt / credential sheet immediately (no tap on a custom button).
    var autoPromptStarted by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        if (!autoPromptStarted && !isPrompting) {
            autoPromptStarted = true
            onUnlockClick()
        }
    }
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        PremiumGlassCard(modifier = Modifier.fillMaxWidth()) {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(
                    text = stringResource(R.string.app_biometric_unlock_title),
                    style = MaterialTheme.typography.headlineSmall,
                    textAlign = TextAlign.Center,
                )
                Text(
                    text = stringResource(R.string.app_biometric_unlock_body),
                    style = MaterialTheme.typography.bodyMedium,
                    textAlign = TextAlign.Center,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                gateError?.takeIf { it.isNotBlank() }?.let { error ->
                    Text(
                        text = error,
                        style = MaterialTheme.typography.bodySmall,
                        textAlign = TextAlign.Center,
                        color = MaterialTheme.colorScheme.error,
                    )
                }
                Button(
                    onClick = onUnlockClick,
                    enabled = !isPrompting,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(stringResource(R.string.app_biometric_unlock_action))
                }
            }
        }
    }
}

@Composable
private fun LoginRequiredScreen(
    authInProgress: Boolean,
    authError: String?,
    perimeterAccess: PerimeterAccessUiState,
    onSignInYandexPerimeter: () -> Unit,
    onStartLogin: () -> Unit,
    onClearAuthError: () -> Unit,
) {
    val ctx = androidx.compose.ui.platform.LocalContext.current
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        PremiumGlassCard(modifier = Modifier.fillMaxWidth()) {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                PremiumIconTile(
                    icon = Icons.Outlined.AutoAwesome,
                    contentDescription = stringResource(R.string.login_required_title),
                    modifier = Modifier.size(56.dp),
                )
                Text(
                    text = stringResource(R.string.login_required_title),
                    style = MaterialTheme.typography.headlineSmall,
                    textAlign = TextAlign.Center,
                )
                Text(
                    text = stringResource(R.string.login_required_body),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                )
                PremiumDividerGlow()

                if (perimeterAccess.requiresManualYandexAuth()) {
                    Text(
                        text = stringResource(R.string.login_perimeter_required_hint),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.error,
                        textAlign = TextAlign.Center,
                    )
                    ScaledButton(
                        onClick = onSignInYandexPerimeter,
                        enabled = perimeterAccess.status != PerimeterAccessStatus.Renewing,
                        label = stringResource(feature.profile.R.string.perimeter_manual_yandex_action),
                        icon = Icons.Outlined.VerifiedUser,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }

                Button(
                    onClick = onStartLogin,
                    enabled = !authInProgress,
                ) {
                    if (authInProgress) {
                        CircularProgressIndicator(
                            modifier = Modifier.padding(end = 8.dp).size(18.dp),
                            strokeWidth = 2.dp,
                            color = MaterialTheme.colorScheme.onPrimary,
                        )
                    }
                    Text(
                        if (authInProgress) {
                            stringResource(R.string.login_required_in_progress)
                        } else {
                            stringResource(R.string.login_required_action)
                        },
                    )
                }

                if (!authError.isNullOrBlank()) {
                    Text(
                        text = authError,
                        color = MaterialTheme.colorScheme.error,
                        textAlign = TextAlign.Center,
                    )
                    Text(
                        text = stringResource(R.string.app_auth_recovery_hint),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        ScaledOutlinedButton(
                            onClick = onClearAuthError,
                            label = stringResource(R.string.app_auth_recovery_dismiss),
                            enabled = !authInProgress,
                            modifier = Modifier.weight(1f),
                        )
                        ScaledButton(
                            onClick = onStartLogin,
                            enabled = !authInProgress,
                            label = stringResource(R.string.app_auth_recovery_retry),
                            icon = Icons.Outlined.VerifiedUser,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
        }

        Text(
            text =
                stringResource(
                    R.string.login_required_build_footer,
                    BuildConfig.VERSION_NAME,
                    ctx.packageName,
                ),
            modifier = Modifier.padding(top = 24.dp),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
    }
}
