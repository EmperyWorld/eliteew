package feature.profile

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MobileAppUpdateProtectedDownloadGuardTest {
    @Test
    fun allowsHttpsMobileAppPath() {
        assertTrue(
            MobileAppUpdateDownloadSupport.isProtectedMobileAppDownloadAllowed(
                "https://app.eliteew.ru",
                "/mobile-app/download",
            ),
        )
    }

    @Test
    fun rejectsHttpOrWrongPath() {
        assertFalse(
            MobileAppUpdateDownloadSupport.isProtectedMobileAppDownloadAllowed(
                "http://app.eliteew.ru",
            ),
        )
        assertFalse(
            MobileAppUpdateDownloadSupport.isProtectedMobileAppDownloadAllowed(
                "https://evil.example",
                "/public/apk",
            ),
        )
    }
}
