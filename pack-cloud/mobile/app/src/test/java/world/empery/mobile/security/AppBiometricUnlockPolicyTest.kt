/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for AppBiometricUnlockPolicy and biometric-only SafeAuthResult mapping.
 *
 * Related:
 * - AppBiometricUnlockPolicy, SafeAuthResult
 */
package world.empery.mobile.security

import androidx.biometric.BiometricPrompt
import androidx.biometric.BiometricManager
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AppBiometricUnlockPolicyTest {
    @Test
    fun overlayRequiredOnlyWhenEnabledAuthedAndLocked() {
        assertTrue(
            AppBiometricUnlockPolicy.requiresUnlockOverlay(
                biometricEnabled = true,
                hasSession = true,
                isUnlocked = false,
            ),
        )
        assertFalse(
            AppBiometricUnlockPolicy.requiresUnlockOverlay(
                biometricEnabled = false,
                hasSession = true,
                isUnlocked = false,
            ),
        )
        assertFalse(
            AppBiometricUnlockPolicy.requiresUnlockOverlay(
                biometricEnabled = true,
                hasSession = false,
                isUnlocked = false,
            ),
        )
        assertFalse(
            AppBiometricUnlockPolicy.requiresUnlockOverlay(
                biometricEnabled = true,
                hasSession = true,
                isUnlocked = true,
            ),
        )
        assertFalse(
            AppBiometricUnlockPolicy.requiresUnlockOverlay(
                biometricEnabled = true,
                hasSession = true,
                isUnlocked = false,
                hardwareAvailable = false,
            ),
        )
    }

    @Test
    fun softUnlockWhenHardwareUnavailable() {
        assertTrue(
            AppBiometricUnlockPolicy.shouldSoftUnlockWhenHardwareUnavailable(
                biometricEnabled = true,
                canAuthenticate = false,
            ),
        )
        assertFalse(
            AppBiometricUnlockPolicy.shouldSoftUnlockWhenHardwareUnavailable(
                biometricEnabled = true,
                canAuthenticate = true,
            ),
        )
        assertFalse(
            AppBiometricUnlockPolicy.shouldSoftUnlockWhenHardwareUnavailable(
                biometricEnabled = false,
                canAuthenticate = false,
            ),
        )
    }

    @Test
    fun graceUnder60sDoesNotLock() {
        assertFalse(
            AppBiometricUnlockPolicy.shouldLockAfterBackground(
                biometricEnabled = true,
                isUnlocked = true,
                backgroundStartedAtEpochMs = 1_000L,
                nowEpochMs = 1_000L + 59_999L,
            ),
        )
    }

    @Test
    fun graceAtOrOver60sLocks() {
        assertTrue(
            AppBiometricUnlockPolicy.shouldLockAfterBackground(
                biometricEnabled = true,
                isUnlocked = true,
                backgroundStartedAtEpochMs = 1_000L,
                nowEpochMs = 1_000L + 60_000L,
            ),
        )
        assertFalse(
            AppBiometricUnlockPolicy.shouldLockAfterBackground(
                biometricEnabled = true,
                isUnlocked = true,
                backgroundStartedAtEpochMs = 1_000L,
                nowEpochMs = 1_000L + 120_000L,
                hardwareAvailable = false,
            ),
        )
    }

    @Test
    fun disabledOrAlreadyLockedNeverRelocks() {
        assertFalse(
            AppBiometricUnlockPolicy.shouldLockAfterBackground(
                biometricEnabled = false,
                isUnlocked = true,
                backgroundStartedAtEpochMs = 0L,
                nowEpochMs = 100_000L,
            ),
        )
        assertFalse(
            AppBiometricUnlockPolicy.shouldLockAfterBackground(
                biometricEnabled = true,
                isUnlocked = false,
                backgroundStartedAtEpochMs = 0L,
                nowEpochMs = 100_000L,
            ),
        )
    }

    @Test
    fun coldStartInitialUnlocked() {
        assertTrue(AppBiometricUnlockPolicy.initialUnlocked(biometricEnabled = false, hasSession = true))
        assertTrue(AppBiometricUnlockPolicy.initialUnlocked(biometricEnabled = true, hasSession = false))
        assertFalse(AppBiometricUnlockPolicy.initialUnlocked(biometricEnabled = true, hasSession = true))
        assertTrue(
            AppBiometricUnlockPolicy.initialUnlocked(
                biometricEnabled = true,
                hasSession = true,
                hardwareAvailable = false,
            ),
        )
    }

    @Test
    fun safeAuthErrorCodesMapPreflightAndPromptOutcomes() {
        assertEquals(
            SafeAuthResult.Unavailable(
                reason = SafeAuthUnavailableReason.NOT_ENROLLED,
                reasonCode = BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED,
            ),
            SafeAuthErrorCodes.mapPreflightStatus(BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED),
        )
        assertEquals(
            SafeAuthResult.Unavailable(
                reason = SafeAuthUnavailableReason.HARDWARE_NOT_PRESENT,
                reasonCode = BiometricPrompt.ERROR_HW_NOT_PRESENT,
            ),
            SafeAuthErrorCodes.mapPromptError(BiometricPrompt.ERROR_HW_NOT_PRESENT),
        )
        assertEquals(
            SafeAuthResult.Canceled(reasonCode = BiometricPrompt.ERROR_USER_CANCELED),
            SafeAuthErrorCodes.mapPromptError(BiometricPrompt.ERROR_USER_CANCELED),
        )
        assertEquals(
            SafeAuthResult.Error(
                stage = SafeAuthErrorStage.AUTHENTICATION,
                reasonCode = BiometricPrompt.ERROR_LOCKOUT,
            ),
            SafeAuthErrorCodes.mapPromptError(BiometricPrompt.ERROR_LOCKOUT),
        )
    }
}
