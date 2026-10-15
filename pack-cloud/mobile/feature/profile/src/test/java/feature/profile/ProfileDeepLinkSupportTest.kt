/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for Profile accordion deeplink section= mapping and OTA stale-check trigger.
 *
 * Invariants:
 * - —
 *
 * Related:
 * - ProfileDeepLinkSupport.kt, ProfileCategoryAccordion.kt
 */
package feature.profile

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ProfileDeepLinkSupportTest {
    @Test
    fun resolveProfileCategory_updatesAliases() {
        listOf("updates", "ota", "update", " OTA ").forEach { raw ->
            assertEquals(
                "section=$raw",
                ProfileCategoryId.UPDATES,
                resolveProfileCategoryFromSection(raw),
            )
        }
    }

    @Test
    fun resolveProfileCategory_accountAndPrivacy() {
        assertEquals(ProfileCategoryId.ACCOUNT, resolveProfileCategoryFromSection("account"))
        assertEquals(ProfileCategoryId.ACCOUNT, resolveProfileCategoryFromSection("privacy"))
    }

    @Test
    fun resolveProfileCategory_securityAliases() {
        listOf("security", "secure", "access").forEach { raw ->
            assertEquals(ProfileCategoryId.SECURITY, resolveProfileCategoryFromSection(raw))
        }
    }

    @Test
    fun resolveProfileCategory_videoCallsAliases() {
        listOf("video_calls", "videocalls", "calls", "call_target").forEach { raw ->
            assertEquals(ProfileCategoryId.VIDEO_CALLS, resolveProfileCategoryFromSection(raw))
        }
    }

    @Test
    fun resolveProfileCategory_notificationsAliases() {
        assertEquals(ProfileCategoryId.NOTIFICATIONS, resolveProfileCategoryFromSection("notifications"))
        assertEquals(ProfileCategoryId.NOTIFICATIONS, resolveProfileCategoryFromSection("push"))
    }

    @Test
    fun resolveProfileCategory_appearanceAliases() {
        listOf("appearance", "theme", "style").forEach { raw ->
            assertEquals(ProfileCategoryId.APPEARANCE, resolveProfileCategoryFromSection(raw))
        }
    }

    @Test
    fun resolveProfileCategory_storageAndSupportAliases() {
        assertEquals(ProfileCategoryId.STORAGE, resolveProfileCategoryFromSection("cache"))
        assertEquals(ProfileCategoryId.SUPPORT, resolveProfileCategoryFromSection("feedback"))
        assertEquals(ProfileCategoryId.SUPPORT, resolveProfileCategoryFromSection("help"))
    }

    @Test
    fun resolveProfileCategory_unknownReturnsNull() {
        assertNull(resolveProfileCategoryFromSection(null))
        assertNull(resolveProfileCategoryFromSection(""))
        assertNull(resolveProfileCategoryFromSection("not-a-section"))
    }

    @Test
    fun profileSectionTriggersOtaCheck_onlyForUpdatesSection() {
        assertTrue(profileSectionTriggersOtaCheck("ota"))
        assertTrue(profileSectionTriggersOtaCheck("updates"))
        assertFalse(profileSectionTriggersOtaCheck("security"))
        assertFalse(profileSectionTriggersOtaCheck(null))
    }
}
