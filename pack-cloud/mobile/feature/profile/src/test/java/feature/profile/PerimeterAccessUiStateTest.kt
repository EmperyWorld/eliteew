/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for perimeter UI state helpers (manual Yandex auth visibility).
 *
 * Invariants:
 * - —
 *
 * Related:
 * - PerimeterAccessCard.kt, PerimeterAccessRepository.kt
 */
package feature.profile

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PerimeterAccessUiStateTest {
    @Test
    fun requiresManualYandexAuth_whenClosedOrAutoRenewFailed() {
        assertTrue(PerimeterAccessUiState(status = PerimeterAccessStatus.Closed).requiresManualYandexAuth())
        assertTrue(PerimeterAccessUiState(autoRenewFailed = true).requiresManualYandexAuth())
        assertFalse(PerimeterAccessUiState(status = PerimeterAccessStatus.Open).requiresManualYandexAuth())
    }

    @Test
    fun healthUnavailable_flagSetIndependentlyFromStatus() {
        val state = PerimeterAccessUiState(status = PerimeterAccessStatus.Unknown, healthUnavailable = true)
        assertTrue(state.healthUnavailable)
        assertFalse(state.requiresManualYandexAuth())
    }
}
