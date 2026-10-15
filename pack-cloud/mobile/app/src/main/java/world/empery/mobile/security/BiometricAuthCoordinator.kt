/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Coordinates the optional biometric privacy prompt as a single-flight state machine.
 * It owns prompt generations and rejects callbacks from completed or destroyed hosts.
 *
 * Invariants:
 * - Biometric outcomes never mutate authentication tokens or start reauthentication.
 * - At most one prompt is active; terminal failures keep the privacy gate locked.
 * - Host teardown cancels the active prompt and invalidates all callbacks.
 *
 * Related:
 * - AppBiometricUnlockGate, SafeAuthResult, MainActivity, MainViewModel
 */
package world.empery.mobile.security

import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner

data class BiometricPromptRequest(
    val title: String,
    val subtitle: String,
    /** Unused when DEVICE_CREDENTIAL is allowed (Android forbids a custom cancel label). */
    val negativeButtonText: String = "",
)

fun interface BiometricPromptCancellation {
    fun cancel()
}

interface BiometricPromptDriver {
    fun authenticate(
        request: BiometricPromptRequest,
        onResult: (SafeAuthResult) -> Unit,
    ): BiometricPromptCancellation
}

class BiometricAuthCoordinator(
    private val promptDriver: BiometricPromptDriver,
    private val onStateChanged: (State) -> Unit,
    private val onEffect: (Effect) -> Unit,
    private val onError: (stage: String, error: Throwable) -> Unit,
) : DefaultLifecycleObserver {
    sealed interface State {
        data object Idle : State

        data class Prompting(val attemptId: Long) : State

        data class Terminal(
            val attemptId: Long,
            val result: SafeAuthResult,
        ) : State

        data class HostDestroyed(val generation: Long) : State
    }

    sealed interface Effect {
        data object Unlock : Effect

        /** Non-success terminal: shell must remain locked until Success. */
        data class StayLocked(val result: SafeAuthResult) : Effect
    }

    enum class RequestResult {
        STARTED,
        ALREADY_PROMPTING,
        HOST_DESTROYED,
    }

    private val lock = Any()
    private var generation = 0L
    private var activeCancellation: BiometricPromptCancellation? = null
    private var currentState: State = State.Idle

    val state: State
        get() = synchronized(lock) { currentState }

    fun authenticate(request: BiometricPromptRequest): RequestResult {
        val attemptId: Long
        val promptingState: State.Prompting
        synchronized(lock) {
            when (currentState) {
                is State.HostDestroyed -> return RequestResult.HOST_DESTROYED
                is State.Prompting -> return RequestResult.ALREADY_PROMPTING
                State.Idle,
                is State.Terminal,
                -> Unit
            }
            generation += 1
            attemptId = generation
            promptingState = State.Prompting(attemptId)
            currentState = promptingState
        }
        onStateChanged(promptingState)

        val cancellation =
            try {
                promptDriver.authenticate(request) { result ->
                    onPromptResult(attemptId, result)
                }
            } catch (error: Throwable) {
                onError("biometric_prompt_start", error)
                onPromptResult(
                    attemptId,
                    SafeAuthResult.Error(
                        stage = SafeAuthErrorStage.PROMPT_START,
                        message = error.message,
                    ),
                )
                return RequestResult.STARTED
            }

        val completedSynchronously =
            synchronized(lock) {
                val state = currentState
                if (state is State.Prompting && state.attemptId == attemptId) {
                    activeCancellation = cancellation
                    false
                } else {
                    true
                }
            }
        if (completedSynchronously) {
            safeCancel(cancellation, "biometric_prompt_completed_synchronously")
        }
        return RequestResult.STARTED
    }

    override fun onDestroy(owner: LifecycleOwner) {
        destroy()
    }

    fun destroy() {
        val cancellation: BiometricPromptCancellation?
        val destroyedState: State.HostDestroyed
        synchronized(lock) {
            if (currentState is State.HostDestroyed) return
            generation += 1
            destroyedState = State.HostDestroyed(generation)
            currentState = destroyedState
            cancellation = activeCancellation
            activeCancellation = null
        }
        onStateChanged(destroyedState)
        cancellation?.let { safeCancel(it, "biometric_host_destroyed") }
    }

    private fun onPromptResult(
        attemptId: Long,
        result: SafeAuthResult,
    ) {
        val cancellation: BiometricPromptCancellation?
        val terminalState: State.Terminal
        synchronized(lock) {
            val state = currentState
            if (state !is State.Prompting || state.attemptId != attemptId) return
            terminalState = State.Terminal(attemptId = attemptId, result = result)
            currentState = terminalState
            cancellation = activeCancellation
            activeCancellation = null
        }

        onStateChanged(terminalState)
        cancellation?.let { safeCancel(it, "biometric_prompt_terminal") }
        onEffect(
            if (result == SafeAuthResult.Success) {
                Effect.Unlock
            } else {
                Effect.StayLocked(result)
            },
        )
    }

    private fun safeCancel(
        cancellation: BiometricPromptCancellation,
        stage: String,
    ) {
        try {
            cancellation.cancel()
        } catch (error: Throwable) {
            onError(stage, error)
        }
    }
}
