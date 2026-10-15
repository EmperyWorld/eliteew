/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Biometric privacy-gate state owned by MainViewModel: unlock overlay, preference toggle,
 * lifecycle soft-lock after background (W1 atomization).
 *
 * Invariants:
 * - Cancel/fail never soft-unlocks the privacy gate (StayLocked keeps isAppUnlocked=false).
 * - Hardware-unavailable soft-unlock follows AppBiometricUnlockPolicy only.
 *
 * Related:
 * - MainViewModel, BiometricAuthCoordinator, AppBiometricUnlockPolicy, AuthSessionGate
 */
package world.empery.mobile.security

import android.app.Application
import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import world.empery.mobile.R

class BiometricUnlockSessionFacade(
    private val application: Application,
    private val hasSession: () -> Boolean,
) {
    private val _biometricUnlockEnabled =
        MutableStateFlow(AppBiometricPreferences.isEnabled(application.applicationContext))
    private val _isAppUnlocked =
        MutableStateFlow(
            AppBiometricUnlockPolicy.initialUnlocked(
                biometricEnabled = _biometricUnlockEnabled.value,
                hasSession = hasSession(),
                hardwareAvailable =
                    AppBiometricUnlockGate.canAuthenticate(application.applicationContext),
            ),
        )
    private val _biometricGateError = MutableStateFlow<String?>(null)

    val isAppUnlocked: StateFlow<Boolean> = _isAppUnlocked.asStateFlow()
    val biometricUnlockEnabled: StateFlow<Boolean> = _biometricUnlockEnabled.asStateFlow()
    val biometricGateError: StateFlow<String?> = _biometricGateError.asStateFlow()

    val biometricHardwareAvailable: Boolean
        get() = AppBiometricUnlockGate.canAuthenticate(application)

    fun unlockedValue(): Boolean = _isAppUnlocked.value

    fun enabledValue(): Boolean = _biometricUnlockEnabled.value

    fun gateErrorValue(): String? = _biometricGateError.value

    fun markAppUnlocked() {
        _isAppUnlocked.value = true
        _biometricGateError.value = null
    }

    fun handleBiometricAuthEffect(effect: BiometricAuthCoordinator.Effect) {
        if (!hasSession()) {
            Log.i(TAG, "biometric effect ignored: no authenticated session")
            return
        }
        when (effect) {
            BiometricAuthCoordinator.Effect.Unlock -> markAppUnlocked()
            is BiometricAuthCoordinator.Effect.StayLocked -> {
                Log.i(
                    TAG,
                    "biometric privacy gate stayed locked after ${effect.result.javaClass.simpleName}",
                )
                _biometricGateError.value =
                    when (effect.result) {
                        SafeAuthResult.NonMatch ->
                            application.getString(R.string.app_biometric_unlock_failed_mismatch)
                        is SafeAuthResult.Canceled ->
                            application.getString(R.string.app_biometric_unlock_failed_canceled)
                        is SafeAuthResult.Unavailable ->
                            application.getString(R.string.app_biometric_unlock_failed_unavailable)
                        is SafeAuthResult.Error ->
                            application.getString(R.string.app_biometric_unlock_failed_error)
                        SafeAuthResult.Success -> null
                    }
                // Cause-layer honesty: cancel/fail never soft-unlocks the privacy gate.
                _isAppUnlocked.value = false
            }
        }
    }

    fun setBiometricUnlockEnabled(enabled: Boolean) {
        if (enabled && !AppBiometricUnlockGate.canAuthenticate(application)) {
            return
        }
        AppBiometricPreferences.setEnabled(application, enabled)
        _biometricUnlockEnabled.value = enabled
        if (!enabled) {
            _isAppUnlocked.value = true
        }
    }

    /**
     * Apply soft-unlock / lock-after-background rules on process foreground.
     * @return epoch ms to clear for [backgroundStartedAtEpochMs] (always null after apply).
     */
    fun onProcessForeground(backgroundStartedAtEpochMs: Long?): Long? {
        val now = System.currentTimeMillis()
        val hw = biometricHardwareAvailable
        if (
            AppBiometricUnlockPolicy.shouldSoftUnlockWhenHardwareUnavailable(
                biometricEnabled = _biometricUnlockEnabled.value,
                canAuthenticate = hw,
            )
        ) {
            _isAppUnlocked.value = true
        } else if (
            AppBiometricUnlockPolicy.shouldLockAfterBackground(
                biometricEnabled = _biometricUnlockEnabled.value,
                isUnlocked = _isAppUnlocked.value,
                backgroundStartedAtEpochMs = backgroundStartedAtEpochMs,
                nowEpochMs = now,
                hardwareAvailable = hw,
            )
        ) {
            _isAppUnlocked.value = false
        }
        return null
    }

    fun resetOnLogout() {
        _isAppUnlocked.value =
            AppBiometricUnlockPolicy.initialUnlocked(
                biometricEnabled = _biometricUnlockEnabled.value,
                hasSession = false,
            )
    }

    companion object {
        private const val TAG = "BiometricUnlockSession"
    }
}
