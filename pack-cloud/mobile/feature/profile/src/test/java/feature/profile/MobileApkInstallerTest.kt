package feature.profile

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MobileApkInstallerTest {
    @Test
    fun isServerUpdateAvailable_whenRemoteHigher_returnsTrue() {
        assertTrue(MobileApkInstaller.isServerUpdateAvailable(4, 5))
    }

    @Test
    fun isServerUpdateAvailable_whenSameOrLower_returnsFalse() {
        assertFalse(MobileApkInstaller.isServerUpdateAvailable(4, 4))
        assertFalse(MobileApkInstaller.isServerUpdateAvailable(5, 4))
    }

    @Test
    fun isServerUpdateAvailable_whenRemoteMissing_returnsFalse() {
        assertFalse(MobileApkInstaller.isServerUpdateAvailable(4, null))
    }
}
