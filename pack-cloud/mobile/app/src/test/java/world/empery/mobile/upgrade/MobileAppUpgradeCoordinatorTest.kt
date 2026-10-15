/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * JVM tests for OTA filename parsing used during post-upgrade artifact pruning.
 *
 * Invariants:
 * - —
 *
 * Related:
 * - MobileAppUpgradeCoordinator, MobileAppUpdateDownloadSupport
 */
package world.empery.mobile.upgrade

import feature.profile.MobileAppUpdateDownloadSupport
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MobileAppUpgradeCoordinatorTest {
    @Test
    fun parseOtaVersionFromApkFileName_readsCode() {
        val name = MobileAppUpdateDownloadSupport.apkFileName(44)
        assertEquals(44, parseVersionForTest(name))
    }

    @Test
    fun parseOtaVersionFromApkFileName_rejectsGarbage() {
        assertNull(parseVersionForTest("empery-mobile-vX.apk"))
    }

    private fun parseVersionForTest(fileName: String): Int? {
        val prefix = "empery-mobile-v"
        if (!fileName.startsWith(prefix) || !fileName.endsWith(".apk")) return null
        return fileName.removePrefix(prefix).removeSuffix(".apk").toIntOrNull()
    }
}
