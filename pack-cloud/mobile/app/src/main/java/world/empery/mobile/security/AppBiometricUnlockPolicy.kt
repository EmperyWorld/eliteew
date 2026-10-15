/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure policy for app biometric unlock after SSO session (UI gate only; never touches SecureTokenStore).
 *
 * Invariants:
 * - Grace period is wall-clock ms since last ProcessLifecycle ON_STOP.
 * - Disabled unlock always reports unlocked / no challenge required.
 * - Hardware / device-credential unlock unavailable while pref enabled → soft-unlock (do not brick).
 *
 * Related:
 * - AppBiometricPreferences, MainViewModel, BiometricUnlockScreen, SafeAuthResult
 */
package world.empery.mobile.security

object AppBiometricUnlockPolicy {
    /** Background grace before requiring BiometricPrompt again (plan 1C). */
    const val GRACE_MS: Long = 60_000L

    /**
     * Whether the shell must show the unlock overlay.
     *
     * @param biometricEnabled user preference
     * @param hasSession SSO tokens present
     * @param isUnlocked process unlock flag
     * @param hardwareAvailable BiometricManager SUCCESS for strong biometric or device credential
     */
    fun requiresUnlockOverlay(
        biometricEnabled: Boolean,
        hasSession: Boolean,
        isUnlocked: Boolean,
        hardwareAvailable: Boolean = true,
    ): Boolean {
        if (!biometricEnabled || !hasSession || isUnlocked) return false
        if (!hardwareAvailable) return false
        return true
    }

    /**
     * Prefer soft-unlock when preference is on but HW/enrollment cannot authenticate.
     */
    fun shouldSoftUnlockWhenHardwareUnavailable(
        biometricEnabled: Boolean,
        canAuthenticate: Boolean,
    ): Boolean = biometricEnabled && !canAuthenticate

    /**
     * After returning to foreground: should we lock an currently-unlocked session?
     *
     * @param backgroundStartedAtEpochMs null if never backgrounded this process
     * @param nowEpochMs current time
     */
    fun shouldLockAfterBackground(
        biometricEnabled: Boolean,
        isUnlocked: Boolean,
        backgroundStartedAtEpochMs: Long?,
        nowEpochMs: Long,
        graceMs: Long = GRACE_MS,
        hardwareAvailable: Boolean = true,
    ): Boolean {
        if (!biometricEnabled || !isUnlocked || !hardwareAvailable) return false
        val started = backgroundStartedAtEpochMs ?: return false
        val elapsed = nowEpochMs - started
        return elapsed >= graceMs
    }

    /**
     * Cold start with an existing SSO session: require unlock when biometric is enabled
     * and hardware can authenticate; otherwise start unlocked (avoid soft-lock).
     */
    fun initialUnlocked(
        biometricEnabled: Boolean,
        hasSession: Boolean,
        hardwareAvailable: Boolean = true,
    ): Boolean {
        if (!biometricEnabled || !hasSession) return true
        if (!hardwareAvailable) return true
        return false
    }
}
