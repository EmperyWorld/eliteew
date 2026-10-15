package world.empery.mobile.core.ui

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MobileI18nSupportTest {
    @Test
    fun pseudoLocaleTagDetected() {
        assertTrue(isPseudoLocaleTag("en-XA"))
        assertFalse(isPseudoLocaleTag("en"))
    }

    @Test
    fun rawUgsAcronymDetected() {
        assertTrue(containsRawUgsAcronym("Failed to load UGS hub"))
        assertFalse(containsRawUgsAcronym("AI creation hub"))
    }

    @Test
    fun sanitizeReplacesUgs() {
        assertFalse(containsRawUgsAcronym(sanitizeUserFacingProductCopy("UGS tools", "AI")))
    }
}
