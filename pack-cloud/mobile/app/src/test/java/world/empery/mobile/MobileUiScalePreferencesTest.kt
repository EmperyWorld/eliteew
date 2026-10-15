package world.empery.mobile

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import feature.profile.MobileUiScale
import feature.profile.MobileUiScalePreferences
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class MobileUiScalePreferencesTest {

    private lateinit var context: Context

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        context
            .getSharedPreferences("empery_mobile_ui", Context.MODE_PRIVATE)
            .edit()
            .remove("mobile_ui_scale")
            .commit()
    }

    @Test
    fun default_is_compact_when_unset() {
        assertEquals(MobileUiScale.COMPACT, MobileUiScalePreferences.get(context))
    }

    @Test
    fun round_trip_standard_and_comfort() {
        MobileUiScalePreferences.set(context, MobileUiScale.STANDARD)
        assertEquals(MobileUiScale.STANDARD, MobileUiScalePreferences.get(context))
        MobileUiScalePreferences.set(context, MobileUiScale.COMFORT)
        assertEquals(MobileUiScale.COMFORT, MobileUiScalePreferences.get(context))
    }

    @Test
    fun storage_default_alias_is_compact() {
        assertEquals(MobileUiScale.COMPACT, MobileUiScale.fromStorage("default"))
    }

    @Test
    fun comfort_scales_text_not_layout() {
        assertEquals(1.0f, MobileUiScale.COMFORT.layoutDensityFactor, 0.001f)
        assertEquals(1.12f, MobileUiScale.COMFORT.textFontScaleFactor, 0.001f)
        assertEquals(false, MobileUiScale.COMFORT.showsBottomNavLabels)
    }
}
