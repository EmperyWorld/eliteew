package feature.profile

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class MobileAppUpdateMessagesTest {
    private val context: Context = ApplicationProvider.getApplicationContext()

    @Test
    fun formatUpdateStatusMessage_upToDate_returnsNull() {
        assertNull(
            MobileAppUpdateMessages.formatUpdateStatusMessage(
                context = context,
                installedCode = 57,
                installedName = "0.2.47",
                serverCode = 57,
                serverName = "0.2.47",
                apkAvailable = true,
                updateAvailable = false,
            ),
        )
    }
}
