package world.empery.mobile.shell

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class MobileFeatureShellRoadmapPrefsTest {
    private lateinit var context: Context

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        context.getSharedPreferences("empery_mobile_feature_shell", Context.MODE_PRIVATE).edit().clear().commit()
    }

    @Test
    fun analyticsAndDiagnosticsRoundTrip() {
        MobileFeatureShellPreferences.setAnalyticsEnabled(context, false)
        assertFalse(MobileFeatureShellPreferences.isAnalyticsEnabled(context))
        MobileFeatureShellPreferences.setRuntimeDiagnosticsExpanded(context, true)
        assertTrue(MobileFeatureShellPreferences.isRuntimeDiagnosticsExpanded(context))
        MobileFeatureShellPreferences.setA11yFontStressEnabled(context, true)
        assertTrue(MobileFeatureShellPreferences.isA11yFontStressEnabled(context))
    }
}
