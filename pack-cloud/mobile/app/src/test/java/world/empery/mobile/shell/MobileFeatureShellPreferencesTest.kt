package world.empery.mobile.shell

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class MobileFeatureShellPreferencesTest {
    private lateinit var context: Context

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        context.getSharedPreferences("empery_mobile_feature_shell", Context.MODE_PRIVATE).edit().clear().commit()
    }

    @Test
    fun feedTopicAndSavedPostsRoundTrip() {
        MobileFeatureShellPreferences.setFeedTopicFilter(context, "release")
        assertEquals("release", MobileFeatureShellPreferences.getFeedTopicFilter(context))
        val saved = MobileFeatureShellPreferences.toggleSavedFeedPost(context, "post-1")
        assertTrue(saved.contains("post-1"))
        MobileFeatureShellPreferences.toggleSavedFeedPost(context, "post-1")
        assertFalse(MobileFeatureShellPreferences.getSavedFeedPostIds(context).contains("post-1"))
    }

    @Test
    fun desktopHandoffExpires() {
        val now = 1_000_000L
        MobileFeatureShellPreferences.saveDesktopHandoffDraft(context, "draft text", now + 5000L)
        assertTrue(MobileFeatureShellPreferences.isDesktopHandoffActive(context, now))
        assertFalse(MobileFeatureShellPreferences.isDesktopHandoffActive(context, now + 6000L))
    }
}
