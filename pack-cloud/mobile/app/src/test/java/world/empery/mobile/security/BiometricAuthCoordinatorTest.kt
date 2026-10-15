/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure JUnit locks for biometric prompt single-flight, generation handling, and terminal effects.
 *
 * Invariants:
 * - Tests use a fake prompt boundary and do not initialize Android framework state.
 * - Every non-success terminal result maps to StayLocked.
 *
 * Related:
 * - BiometricAuthCoordinator, SafeAuthResult
 */
package world.empery.mobile.security

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BiometricAuthCoordinatorTest {
    @Test
    fun secondRequestWhilePromptingIsRejected() {
        val harness = Harness()

        assertEquals(
            BiometricAuthCoordinator.RequestResult.STARTED,
            harness.coordinator.authenticate(REQUEST),
        )
        assertEquals(
            BiometricAuthCoordinator.RequestResult.ALREADY_PROMPTING,
            harness.coordinator.authenticate(REQUEST),
        )
        assertEquals(1, harness.driver.attempts.size)
        assertTrue(harness.coordinator.state is BiometricAuthCoordinator.State.Prompting)
    }

    @Test
    fun staleCallbackCannotCompleteNewGeneration() {
        val harness = Harness()
        harness.coordinator.authenticate(REQUEST)
        harness.driver.emit(0, SafeAuthResult.Canceled())
        harness.coordinator.authenticate(REQUEST)

        harness.driver.emit(0, SafeAuthResult.Success)

        assertEquals(1, harness.effects.size)
        assertTrue(harness.coordinator.state is BiometricAuthCoordinator.State.Prompting)

        harness.driver.emit(1, SafeAuthResult.Success)

        assertEquals(
            listOf(
                BiometricAuthCoordinator.Effect.StayLocked(SafeAuthResult.Canceled()),
                BiometricAuthCoordinator.Effect.Unlock,
            ),
            harness.effects,
        )
    }

    @Test
    fun successUnlocksAndClosesPrompt() {
        val harness = Harness()
        harness.coordinator.authenticate(REQUEST)

        harness.driver.emit(0, SafeAuthResult.Success)

        assertEquals(listOf(BiometricAuthCoordinator.Effect.Unlock), harness.effects)
        assertEquals(1, harness.driver.attempts.single().cancelCount)
        assertEquals(
            BiometricAuthCoordinator.State.Terminal(
                attemptId = 1,
                result = SafeAuthResult.Success,
            ),
            harness.coordinator.state,
        )
    }

    @Test
    fun cancellationStaysLocked() {
        assertStaysLocked(SafeAuthResult.Canceled(reasonCode = 10))
    }

    @Test
    fun nonMatchDoesNotTerminateActivePrompt() {
        // Driver-level temporary non-match must not emit StayLocked / cancel (OEM bio UI).
        // Coordinator still maps an explicit NonMatch emission to StayLocked if ever called.
        val harness = Harness()
        harness.coordinator.authenticate(REQUEST)
        assertTrue(harness.coordinator.state is BiometricAuthCoordinator.State.Prompting)
        assertEquals(emptyList<BiometricAuthCoordinator.Effect>(), harness.effects)
        assertEquals(0, harness.driver.attempts.single().cancelCount)
    }

    @Test
    fun explicitNonMatchEmissionStaysLocked() {
        assertStaysLocked(SafeAuthResult.NonMatch)
    }

    @Test
    fun unavailableHardwareStaysLocked() {
        assertStaysLocked(
            SafeAuthResult.Unavailable(
                reason = SafeAuthUnavailableReason.HARDWARE_UNAVAILABLE,
                reasonCode = 1,
            ),
        )
    }

    @Test
    fun thrownDriverErrorBecomesTypedTerminalFailure() {
        val effects = mutableListOf<BiometricAuthCoordinator.Effect>()
        val errors = mutableListOf<Pair<String, Throwable>>()
        val coordinator =
            BiometricAuthCoordinator(
                promptDriver =
                    object : BiometricPromptDriver {
                        override fun authenticate(
                            request: BiometricPromptRequest,
                            onResult: (SafeAuthResult) -> Unit,
                        ): BiometricPromptCancellation = error("driver failed")
                    },
                onStateChanged = {},
                onEffect = effects::add,
                onError = { stage, error -> errors += stage to error },
            )

        coordinator.authenticate(REQUEST)

        assertEquals(1, errors.size)
        assertEquals("biometric_prompt_start", errors.single().first)
        val effect = effects.single() as BiometricAuthCoordinator.Effect.StayLocked
        val result = effect.result as SafeAuthResult.Error
        assertEquals(SafeAuthErrorStage.PROMPT_START, result.stage)
    }

    private fun assertStaysLocked(result: SafeAuthResult) {
        val harness = Harness()
        harness.coordinator.authenticate(REQUEST)

        harness.driver.emit(0, result)

        assertEquals(
            listOf(BiometricAuthCoordinator.Effect.StayLocked(result)),
            harness.effects,
        )
        assertEquals(1, harness.driver.attempts.single().cancelCount)
    }

    private class Harness {
        val driver = FakePromptDriver()
        val states = mutableListOf<BiometricAuthCoordinator.State>()
        val effects = mutableListOf<BiometricAuthCoordinator.Effect>()
        val errors = mutableListOf<Pair<String, Throwable>>()
        val coordinator =
            BiometricAuthCoordinator(
                promptDriver = driver,
                onStateChanged = states::add,
                onEffect = effects::add,
                onError = { stage, error -> errors += stage to error },
            )
    }

    private class FakePromptDriver : BiometricPromptDriver {
        data class Attempt(
            val callback: (SafeAuthResult) -> Unit,
            var cancelCount: Int = 0,
        )

        val attempts = mutableListOf<Attempt>()

        override fun authenticate(
            request: BiometricPromptRequest,
            onResult: (SafeAuthResult) -> Unit,
        ): BiometricPromptCancellation {
            val attempt = Attempt(callback = onResult)
            attempts += attempt
            return BiometricPromptCancellation { attempt.cancelCount += 1 }
        }

        fun emit(
            index: Int,
            result: SafeAuthResult,
        ) {
            attempts[index].callback(result)
        }
    }

    private companion object {
        val REQUEST =
            BiometricPromptRequest(
                title = "Unlock",
                subtitle = "Confirm",
                negativeButtonText = "Cancel",
            )
    }
}
