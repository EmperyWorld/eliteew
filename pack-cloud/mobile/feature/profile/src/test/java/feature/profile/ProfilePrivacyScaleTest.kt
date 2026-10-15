/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */
package feature.profile

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import world.empery.mobile.core.ui.MobileUiScale

class ProfilePrivacyScaleTest {
    @Test
    fun usesIconControls_onlyForStandardAndComfort() {
        assertFalse(MobileUiScale.COMPACT.usesIconControls)
        assertTrue(MobileUiScale.STANDARD.usesIconControls)
        assertTrue(MobileUiScale.COMFORT.usesIconControls)
    }

    @Test
    fun compactPrivacyUsesForcedIconControls() {
        assertTrue(MobileUiScale.COMPACT != MobileUiScale.STANDARD)
    }
}
