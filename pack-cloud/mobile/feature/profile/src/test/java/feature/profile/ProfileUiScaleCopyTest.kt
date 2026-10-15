/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for MobileUiScale user-facing label/description string resource mapping.
 *
 * Invariants:
 * - Every enum entry has chipLabelRes and chipDescriptionRes.
 *
 * Related:
 * - MobileUiScale.kt, ProfileAppearanceChoices.kt
 */
package feature.profile

import org.junit.Assert.assertNotEquals
import org.junit.Test
import world.empery.mobile.core.ui.MobileUiScale

class ProfileUiScaleCopyTest {
    @Test
    fun everyPresetHasDistinctLabelAndDescriptionResources() {
        MobileUiScale.entries.forEach { scale ->
            assertNotEquals(0, scale.chipLabelRes)
            assertNotEquals(0, scale.chipDescriptionRes)
            assertNotEquals(scale.chipLabelRes, scale.chipDescriptionRes)
        }
    }
}
