/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit coverage for premium splash mode resolution and once-per-version overlay gate.
 *
 * Related:
 * - PremiumSplashSupport.kt, PremiumSplashGate.kt
 */
package world.empery.mobile.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PremiumSplashSupportTest {
    @Test
    fun neitherAsset_usesStaticFallback() {
        assertEquals(
            PremiumSplashMode.StaticFallback,
            resolvePremiumSplashMode(videoExists = false, lottieExists = false),
        )
    }

    @Test
    fun videoPresent_winsOverLottie() {
        assertEquals(
            PremiumSplashMode.Video,
            resolvePremiumSplashMode(videoExists = true, lottieExists = true),
        )
    }

    @Test
    fun lottieOnly_usesLottie() {
        assertEquals(
            PremiumSplashMode.Lottie,
            resolvePremiumSplashMode(videoExists = false, lottieExists = true),
        )
    }

    @Test
    fun overlayGate_showsUntilSameVersionMarked() {
        assertTrue(
            PremiumSplashGate.shouldShowForStoredVersion(
                storedVersionCode = -1,
                currentVersionCode = 196,
            ),
        )
        assertFalse(
            PremiumSplashGate.shouldShowForStoredVersion(
                storedVersionCode = 196,
                currentVersionCode = 196,
            ),
        )
        assertTrue(
            PremiumSplashGate.shouldShowForStoredVersion(
                storedVersionCode = 195,
                currentVersionCode = 196,
            ),
        )
    }

    @Test
    fun overlayGate_disabledIntro_neverShows() {
        assertFalse(
            PremiumSplashGate.shouldShowForStoredVersion(
                storedVersionCode = -1,
                currentVersionCode = 198,
                introEnabled = false,
            ),
        )
    }

    @Test
    fun videoPlayback_isTripleSpeedWithShortCeiling() {
        assertEquals(3f, PREMIUM_SPLASH_VIDEO_SPEED, 0.001f)
        assertTrue(PREMIUM_SPLASH_VIDEO_MAX_MS <= 2_500L)
        assertTrue(PREMIUM_SPLASH_FADE_OUT_MS <= 500L)
    }
}
