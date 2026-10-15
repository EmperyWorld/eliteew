/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Typed outcomes for the system BiometricPrompt / device-credential privacy unlock.
 *
 * Invariants:
 * - Never maps to SecureTokenStore mutations or Keycloak re-login.
 * - Framework temporary non-match is not emitted as NonMatch by AppBiometricUnlockGate.
 *
 * Related:
 * - AppBiometricUnlockGate, AppBiometricUnlockPolicy
 */
package world.empery.mobile.security

sealed interface SafeAuthResult {
    data object Success : SafeAuthResult

    /** The presented biometric did not match. */
    data object NonMatch : SafeAuthResult

    data class Canceled(
        val reasonCode: Int? = null,
        val message: String? = null,
    ) : SafeAuthResult

    data class Unavailable(
        val reason: SafeAuthUnavailableReason,
        val reasonCode: Int? = null,
        val message: String? = null,
    ) : SafeAuthResult

    data class Error(
        val stage: SafeAuthErrorStage,
        val reasonCode: Int? = null,
        val message: String? = null,
    ) : SafeAuthResult
}

enum class SafeAuthUnavailableReason {
    ACTIVITY_NOT_STARTED,
    HARDWARE_UNAVAILABLE,
    HARDWARE_NOT_PRESENT,
    NOT_ENROLLED,
    SECURITY_UPDATE_REQUIRED,
    UNSUPPORTED,
    STATUS_UNKNOWN,
}

enum class SafeAuthErrorStage {
    PREFLIGHT,
    PROMPT_START,
    AUTHENTICATION,
}

object SafeAuthErrorCodes {
    fun mapPreflightStatus(status: Int): SafeAuthResult =
        when (status) {
            androidx.biometric.BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED ->
                SafeAuthResult.Unavailable(
                    reason = SafeAuthUnavailableReason.NOT_ENROLLED,
                    reasonCode = status,
                )
            androidx.biometric.BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE ->
                SafeAuthResult.Unavailable(
                    reason = SafeAuthUnavailableReason.HARDWARE_NOT_PRESENT,
                    reasonCode = status,
                )
            androidx.biometric.BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE ->
                SafeAuthResult.Unavailable(
                    reason = SafeAuthUnavailableReason.HARDWARE_UNAVAILABLE,
                    reasonCode = status,
                )
            androidx.biometric.BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED ->
                SafeAuthResult.Unavailable(
                    reason = SafeAuthUnavailableReason.SECURITY_UPDATE_REQUIRED,
                    reasonCode = status,
                )
            androidx.biometric.BiometricManager.BIOMETRIC_ERROR_UNSUPPORTED ->
                SafeAuthResult.Unavailable(
                    reason = SafeAuthUnavailableReason.UNSUPPORTED,
                    reasonCode = status,
                )
            androidx.biometric.BiometricManager.BIOMETRIC_STATUS_UNKNOWN ->
                SafeAuthResult.Unavailable(
                    reason = SafeAuthUnavailableReason.STATUS_UNKNOWN,
                    reasonCode = status,
                )
            else ->
                SafeAuthResult.Error(
                    stage = SafeAuthErrorStage.PREFLIGHT,
                    reasonCode = status,
                    message = "unexpected_preflight_status",
                )
        }

    fun mapPromptError(
        errorCode: Int,
        message: String? = null,
    ): SafeAuthResult =
        when (errorCode) {
            androidx.biometric.BiometricPrompt.ERROR_USER_CANCELED,
            androidx.biometric.BiometricPrompt.ERROR_NEGATIVE_BUTTON,
            androidx.biometric.BiometricPrompt.ERROR_CANCELED,
            ->
                SafeAuthResult.Canceled(
                    reasonCode = errorCode,
                    message = message,
                )
            androidx.biometric.BiometricPrompt.ERROR_NO_BIOMETRICS ->
                SafeAuthResult.Unavailable(
                    reason = SafeAuthUnavailableReason.NOT_ENROLLED,
                    reasonCode = errorCode,
                    message = message,
                )
            androidx.biometric.BiometricPrompt.ERROR_HW_NOT_PRESENT ->
                SafeAuthResult.Unavailable(
                    reason = SafeAuthUnavailableReason.HARDWARE_NOT_PRESENT,
                    reasonCode = errorCode,
                    message = message,
                )
            androidx.biometric.BiometricPrompt.ERROR_HW_UNAVAILABLE ->
                SafeAuthResult.Unavailable(
                    reason = SafeAuthUnavailableReason.HARDWARE_UNAVAILABLE,
                    reasonCode = errorCode,
                    message = message,
                )
            androidx.biometric.BiometricPrompt.ERROR_SECURITY_UPDATE_REQUIRED ->
                SafeAuthResult.Unavailable(
                    reason = SafeAuthUnavailableReason.SECURITY_UPDATE_REQUIRED,
                    reasonCode = errorCode,
                    message = message,
                )
            else ->
                SafeAuthResult.Error(
                    stage = SafeAuthErrorStage.AUTHENTICATION,
                    reasonCode = errorCode,
                    message = message,
                )
        }
}
