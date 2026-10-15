package world.empery.mobile.core.ui

import android.content.pm.ActivityInfo
import android.content.res.Configuration
import org.junit.Assert.assertEquals
import org.junit.Test

class MobileWindowOrientationPolicyTest {
    @Test
    fun phonePortraitLock() {
        val layout =
            MobileWindowLayout.fromConfiguration(
                Configuration().apply {
                    screenWidthDp = 411
                    screenHeightDp = 891
                    smallestScreenWidthDp = 411
                },
            )
        assertEquals(
            ActivityInfo.SCREEN_ORIENTATION_PORTRAIT,
            MobileWindowOrientationPolicy.requestedOrientationFor(layout, 411),
        )
    }

    @Test
    fun tabletAllowsFullUser() {
        val layout =
            MobileWindowLayout.fromConfiguration(
                Configuration().apply {
                    screenWidthDp = 1280
                    screenHeightDp = 800
                    smallestScreenWidthDp = 800
                },
            )
        assertEquals(
            ActivityInfo.SCREEN_ORIENTATION_FULL_USER,
            MobileWindowOrientationPolicy.requestedOrientationFor(layout, 800),
        )
    }

    @Test
    fun vrPanelAllowsFullUserForResizablePanel() {
        val layout =
            MobileWindowLayout(
                screenWidthDp = 500,
                screenHeightDp = 800,
                smallestScreenWidthDp = 500,
                widthClass = MobileWindowWidthClass.Compact,
                profile = MobileLayoutProfile.VrPanel,
            )
        assertEquals(
            ActivityInfo.SCREEN_ORIENTATION_FULL_USER,
            MobileWindowOrientationPolicy.requestedOrientationFor(layout, 500),
        )
    }
}
