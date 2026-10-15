/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shell/auth UI state models owned by MainViewModel composition (W1 shrink).
 *
 * Invariants:
 * - requiresBiometricUnlock follows AppBiometricUnlockPolicy (StayLocked honesty).
 *
 * Related:
 * - MainViewModel, AuthSessionGate, BiometricUnlockSessionFacade
 */
package world.empery.mobile

import feature.chat.ChatUiState
import world.empery.mobile.security.AppBiometricUnlockPolicy

data class MainUiState(
    val isAuthenticated: Boolean = false,
    val authInProgress: Boolean = false,
    val authError: String? = null,
    val sessionReplaceConfirmVisible: Boolean = false,
    val chatState: ChatUiState = ChatUiState(),
)

/** Минимальный срез для корневого UI (без ленты/чата), чтобы не пересобирать scaffold при каждом чат-апдейте. */
data class MobileShellUiState(
    val isAuthenticated: Boolean,
    val authInProgress: Boolean,
    val authError: String?,
    val sessionReplaceConfirmVisible: Boolean,
    val isAppUnlocked: Boolean = true,
    val biometricUnlockEnabled: Boolean = false,
    val biometricHardwareAvailable: Boolean = true,
    val biometricGateError: String? = null,
) {
    val requiresBiometricUnlock: Boolean
        get() =
            AppBiometricUnlockPolicy.requiresUnlockOverlay(
                biometricEnabled = biometricUnlockEnabled,
                hasSession = isAuthenticated,
                isUnlocked = isAppUnlocked,
                hardwareAvailable = biometricHardwareAvailable,
            )
}
