/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Thin AndroidX BiometricPrompt driver: system biometric / device-credential UI only.
 *
 * Invariants:
 * - Does not touch SecureTokenStore.
 * - Uses BIOMETRIC_STRONG | DEVICE_CREDENTIAL (system sheet / lock-screen), not a custom PIN UI.
 * - Temporary biometric non-match keeps the system prompt open (do not terminal-cancel).
 * - Prompt creation, preflight, cancellation, and unavailable hardware are explicit outcomes.
 *
 * Related:
 * - BiometricAuthCoordinator, AppBiometricUnlockPolicy, SafeAuthResult
 */
package world.empery.mobile.security

import android.content.Context
import android.util.Log
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.Lifecycle

class AppBiometricUnlockGate(
    private val activity: FragmentActivity,
) : BiometricPromptDriver {
    override fun authenticate(
        request: BiometricPromptRequest,
        onResult: (SafeAuthResult) -> Unit,
    ): BiometricPromptCancellation {
        if (!activity.lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)) {
            Log.w(TAG, "authenticate skipped: activity not STARTED")
            onResult(
                SafeAuthResult.Unavailable(
                    reason = SafeAuthUnavailableReason.ACTIVITY_NOT_STARTED,
                    message = "activity_not_started",
                ),
            )
            return NO_OP_CANCELLATION
        }

        val status =
            try {
                BiometricManager.from(activity.applicationContext).canAuthenticate(AUTHENTICATORS)
            } catch (error: Throwable) {
                Log.e(TAG, "biometric preflight threw", error)
                onResult(
                    SafeAuthResult.Error(
                        stage = SafeAuthErrorStage.PREFLIGHT,
                        message = error.message,
                    ),
                )
                return NO_OP_CANCELLATION
            }
        if (status != BiometricManager.BIOMETRIC_SUCCESS) {
            Log.i(TAG, "preflight unavailable status=$status")
            onResult(SafeAuthErrorCodes.mapPreflightStatus(status))
            return NO_OP_CANCELLATION
        }

        val prompt =
            try {
                BiometricPrompt(
                    activity,
                    ContextCompat.getMainExecutor(activity),
                    object : BiometricPrompt.AuthenticationCallback() {
                        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                            onResult(SafeAuthResult.Success)
                        }

                        override fun onAuthenticationError(
                            errorCode: Int,
                            errString: CharSequence,
                        ) {
                            Log.i(TAG, "onAuthenticationError code=$errorCode msg=$errString")
                            onResult(
                                SafeAuthErrorCodes.mapPromptError(
                                    errorCode = errorCode,
                                    message = errString.toString(),
                                ),
                            )
                        }

                        override fun onAuthenticationFailed() {
                            // Framework keeps the dialog open for retries. Emitting a terminal
                            // NonMatch + cancelAuthentication drops Honor "bio security" UI and
                            // can kill/finish MainActivity (looks like the app "падает").
                            Log.i(TAG, "onAuthenticationFailed: non-match, keep BiometricPrompt open")
                        }
                    },
                )
            } catch (error: Throwable) {
                Log.e(TAG, "prompt creation threw", error)
                onResult(
                    SafeAuthResult.Error(
                        stage = SafeAuthErrorStage.PROMPT_START,
                        message = error.message,
                    ),
                )
                return NO_OP_CANCELLATION
            }

        val promptInfo =
            try {
                // DEVICE_CREDENTIAL forbids setNegativeButtonText — system uses lock-screen cancel.
                BiometricPrompt.PromptInfo.Builder()
                    .setTitle(request.title)
                    .setSubtitle(request.subtitle)
                    .setAllowedAuthenticators(AUTHENTICATORS)
                    .build()
            } catch (error: Throwable) {
                Log.e(TAG, "prompt configuration threw", error)
                onResult(
                    SafeAuthResult.Error(
                        stage = SafeAuthErrorStage.PROMPT_START,
                        message = error.message,
                    ),
                )
                return NO_OP_CANCELLATION
            }

        try {
            prompt.authenticate(promptInfo)
        } catch (error: Throwable) {
            Log.e(TAG, "prompt start threw", error)
            onResult(
                SafeAuthResult.Error(
                    stage = SafeAuthErrorStage.PROMPT_START,
                    message = error.message,
                ),
            )
            return NO_OP_CANCELLATION
        }
        return BiometricPromptCancellation(prompt::cancelAuthentication)
    }

    companion object {
        private const val TAG = "AppBiometricUnlockGate"

        /** System biometric + device PIN/pattern/password (not custom Compose "kolkhoz"). */
        private const val AUTHENTICATORS =
            BiometricManager.Authenticators.BIOMETRIC_STRONG or
                BiometricManager.Authenticators.DEVICE_CREDENTIAL

        private val NO_OP_CANCELLATION = BiometricPromptCancellation { Unit }

        fun canAuthenticate(context: Context): Boolean {
            return try {
                BiometricManager.from(context.applicationContext).canAuthenticate(AUTHENTICATORS) ==
                    BiometricManager.BIOMETRIC_SUCCESS
            } catch (error: Throwable) {
                Log.w(TAG, "canAuthenticate threw", error)
                false
            }
        }
    }
}
