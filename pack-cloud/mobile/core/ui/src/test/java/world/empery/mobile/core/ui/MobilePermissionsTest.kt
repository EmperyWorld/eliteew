/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for MobilePermissions catalog splits (notification vs core runtime).
 *
 * Invariants:
 * - coreRuntimePermissions never includes POST_NOTIFICATIONS.
 *
 * Related:
 * - MobilePermissions.kt, MainActivity permission flow
 */
package world.empery.mobile.core.ui

import android.Manifest
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MobilePermissionsTest {
    @Test
    fun coreRuntimePermissions_excludesPostNotifications() {
        val core = MobilePermissions.coreRuntimePermissions()
        assertFalse(core.contains(Manifest.permission.POST_NOTIFICATIONS))
    }

    @Test
    fun runtimePermissions_includeCameraAndMic() {
        val all = MobilePermissions.runtimePermissions()
        assertTrue(all.contains(Manifest.permission.CAMERA))
        assertTrue(all.contains(Manifest.permission.RECORD_AUDIO))
    }
}
