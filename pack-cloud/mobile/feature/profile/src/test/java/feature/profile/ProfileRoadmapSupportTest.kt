package feature.profile

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class ProfileRoadmapSupportTest {
    @Test
    fun otaUrgencyEscalatesWithVersionDelta() {
        assertEquals(OtaUpdateUrgency.CRITICAL, resolveOtaUpdateUrgency(true, true, 12))
        assertEquals(OtaUpdateUrgency.RECOMMENDED, resolveOtaUpdateUrgency(true, true, 5))
        assertEquals(OtaUpdateUrgency.OPTIONAL, resolveOtaUpdateUrgency(true, true, 1))
        assertEquals(OtaUpdateUrgency.NONE, resolveOtaUpdateUrgency(false, true, 5))
        assertEquals(
            OtaUpdateUrgency.CRITICAL,
            resolveOtaUpdateUrgency(
                updateAvailable = true,
                apkAvailable = true,
                versionDelta = 1,
                installedVersionCode = 38,
                minSupportedVersionCode = 39,
            ),
        )
    }

    @Test
    fun sha256VerificationStates() {
        assertEquals(ApkSha256VerificationState.VERIFIED, resolveApkSha256VerificationState("/tmp/x.apk", "a".repeat(64), true))
        assertEquals(ApkSha256VerificationState.FAILED, resolveApkSha256VerificationState("/tmp/x.apk", "a".repeat(64), false))
        assertEquals(ApkSha256VerificationState.UNKNOWN, resolveApkSha256VerificationState(null, "a".repeat(64), true))
    }

    @Test
    fun truncateSha256ForDisplay() {
        val full = "0123456789abcdef".repeat(4)
        assertEquals("01234567…89abcdef", truncateSha256ForDisplay(full))
        assertEquals(null, truncateSha256ForDisplay("short"))
    }

    @Test
    fun canShowOtaInstallButton_requiresUpdateAndDownload() {
        val tempApk = File.createTempFile("empery-mobile-v166", ".apk")
        tempApk.writeBytes(byteArrayOf(1, 2, 3))
        tempApk.deleteOnExit()
        val base =
            AppUpdateUiState(
                updateAvailable = true,
                apkAvailable = true,
                serverVersionCode = 166,
                downloadedApkPath = tempApk.absolutePath,
                downloadedVersionCode = 166,
            )
        assertTrue(canShowOtaInstallButton(base))
        assertFalse(canShowOtaInstallButton(base.copy(updateAvailable = false)))
        assertFalse(canShowOtaInstallButton(base.copy(downloadedApkPath = null)))
        assertFalse(
            canShowOtaInstallButton(
                base.copy(sha256Verification = ApkSha256VerificationState.FAILED),
            ),
        )
        assertFalse(
            canShowOtaInstallButton(
                base.copy(downloadedVersionCode = 165),
            ),
        )
    }

    @Test
    fun parseDownloadedApkVersionCode_readsVersionFromPath() {
        assertEquals(166, parseDownloadedApkVersionCode("/sdcard/Download/updates/empery-mobile-v166.apk"))
        assertEquals(null, parseDownloadedApkVersionCode("/sdcard/Download/updates/other.apk"))
    }
}
