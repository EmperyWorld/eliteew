package world.empery.mobile.core.ui

import android.content.res.Configuration
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MobileScreenBucketTest {
    @Test
    fun tabletSmallestWidth_isLargeScreen() {
        val config = Configuration().apply { smallestScreenWidthDp = 600 }
        assertTrue(MobileScreenBucket.isLargeScreen(config))
    }

    @Test
    fun phoneSmallestWidth_isNotLargeScreen() {
        val config =
            Configuration().apply {
                smallestScreenWidthDp = 411
                screenWidthDp = 411
                screenHeightDp = 700
            }
        assertFalse(MobileScreenBucket.isLargeScreen(config))
    }

    @Test
    fun tallPanelMaxEdge_isLargeScreen() {
        val config =
            Configuration().apply {
                smallestScreenWidthDp = 500
                screenWidthDp = 500
                screenHeightDp = 800
            }
        assertTrue(MobileScreenBucket.isLargeScreen(config))
    }
}
