/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure volume fade step helpers for premium media re-init (Wi-Fi ↔ cellular) without pops.
 *
 * Invariants:
 * - Steps stay in [0f, 1f]; fade-out ends at 0; fade-in ends at targetVolume.
 *
 * Related:
 * - EmperyMediaPlayerController
 */
package world.empery.mobile.core.media

object EmperyMediaPlaybackFade {
    const val DEFAULT_STEP_COUNT: Int = 8
    const val DEFAULT_STEP_DELAY_MS: Long = 28L

    fun fadeOutVolumes(
        from: Float = 1f,
        steps: Int = DEFAULT_STEP_COUNT,
    ): List<Float> {
        val safeSteps = steps.coerceAtLeast(1)
        val start = from.coerceIn(0f, 1f)
        return (1..safeSteps).map { step ->
            (start * (1f - step.toFloat() / safeSteps)).coerceIn(0f, 1f)
        }
    }

    fun fadeInVolumes(
        to: Float = 1f,
        steps: Int = DEFAULT_STEP_COUNT,
    ): List<Float> {
        val safeSteps = steps.coerceAtLeast(1)
        val target = to.coerceIn(0f, 1f)
        return (1..safeSteps).map { step ->
            (target * (step.toFloat() / safeSteps)).coerceIn(0f, 1f)
        }
    }
}
