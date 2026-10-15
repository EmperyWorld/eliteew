/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit locks for premium media fade-out / fade-in step curves.
 *
 * Invariants:
 * - Fade-out terminates at 0; fade-in terminates at the requested target.
 *
 * Related:
 * - EmperyMediaPlaybackFade
 */
package world.empery.mobile.core.media

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class EmperyMediaPlaybackFadeTest {
    @Test
    fun fadeOut_endsAtZeroAndStaysInRange() {
        val steps = EmperyMediaPlaybackFade.fadeOutVolumes(from = 1f, steps = 8)
        assertEquals(8, steps.size)
        assertEquals(0f, steps.last(), 0.0001f)
        assertTrue(steps.all { it in 0f..1f })
        assertTrue(steps.zipWithNext().all { (a, b) -> a >= b })
    }

    @Test
    fun fadeIn_endsAtTargetAndIsMonotonic() {
        val steps = EmperyMediaPlaybackFade.fadeInVolumes(to = 1f, steps = 8)
        assertEquals(8, steps.size)
        assertEquals(1f, steps.last(), 0.0001f)
        assertTrue(steps.first() > 0f)
        assertTrue(steps.zipWithNext().all { (a, b) -> a <= b })
    }
}
