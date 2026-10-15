package world.empery.mobile.core.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MobileMotionPolicyTest {
    @Test
    fun reduceMotionZeroDuration() {
        assertEquals(0, motionDurationMillis(180, true))
        assertEquals(180, motionDurationMillis(180, false))
    }

    @Test
    fun motionScaleDisabledUnderReduceMotion() {
        assertEquals(1f, motionScaleTarget(selected = true, reduceMotion = true))
    }

    @Test
    fun transitionDisabledUnderReduceMotion() {
        assertFalse(isTransitionEnabled(true))
        assertTrue(isTransitionEnabled(false))
    }
}
