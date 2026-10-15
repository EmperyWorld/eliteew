/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Robolectric host-lifecycle integration for the biometric coordinator using a fake prompt driver.
 *
 * Invariants:
 * - Destroying the host cancels the active prompt and makes its callback stale.
 * - No real biometric hardware, token store, or authentication flow is used.
 *
 * Related:
 * - BiometricAuthCoordinator, MainActivity
 */
package world.empery.mobile.security

import androidx.fragment.app.FragmentActivity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class BiometricAuthCoordinatorRobolectricTest {
    @Test
    fun destroyedHostCancelsPromptAndRejectsLateCallback() {
        val driver = FakePromptDriver()
        val effects = mutableListOf<BiometricAuthCoordinator.Effect>()
        val coordinator =
            BiometricAuthCoordinator(
                promptDriver = driver,
                onStateChanged = {},
                onEffect = effects::add,
                onError = { stage, error ->
                    throw AssertionError("Unexpected coordinator error at $stage", error)
                },
            )
        val activityController = Robolectric.buildActivity(FragmentActivity::class.java).setup()
        activityController.get().lifecycle.addObserver(coordinator)

        assertEquals(
            BiometricAuthCoordinator.RequestResult.STARTED,
            coordinator.authenticate(REQUEST),
        )

        activityController.pause().stop().destroy()

        assertTrue(coordinator.state is BiometricAuthCoordinator.State.HostDestroyed)
        assertEquals(1, driver.cancelCount)
        driver.callback?.invoke(SafeAuthResult.Success)
        assertTrue(effects.isEmpty())
        assertEquals(
            BiometricAuthCoordinator.RequestResult.HOST_DESTROYED,
            coordinator.authenticate(REQUEST),
        )
    }

    private class FakePromptDriver : BiometricPromptDriver {
        var callback: ((SafeAuthResult) -> Unit)? = null
        var cancelCount: Int = 0

        override fun authenticate(
            request: BiometricPromptRequest,
            onResult: (SafeAuthResult) -> Unit,
        ): BiometricPromptCancellation {
            callback = onResult
            return BiometricPromptCancellation { cancelCount += 1 }
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
