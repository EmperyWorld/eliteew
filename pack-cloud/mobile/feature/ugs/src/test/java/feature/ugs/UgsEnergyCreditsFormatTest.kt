/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression: billing credits are Double; must not use %d string formatting on hub badge.
 *
 * Invariants:
 * - —
 *
 * Related:
 * - UgsHubFeature.formatUgsEnergyCredits
 */
package feature.ugs

import org.junit.Assert.assertEquals
import org.junit.Test

class UgsEnergyCreditsFormatTest {
    @Test
    fun formatCredits_integerLikeDouble_noDecimal() {
        assertEquals("120", formatUgsEnergyCredits(120.0))
    }

    @Test
    fun formatCredits_fractional_stripsTrailingZeros() {
        assertEquals("12.5", formatUgsEnergyCredits(12.5))
    }
}
