/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit lock for EmperyNotificationSoundChannels ids (push v4, calls v5 system ringtone).
 *
 * Related:
 * - EmperyNotificationSoundChannels
 */
package world.empery.mobile.push

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class EmperyNotificationSoundChannelsTest {
    @Test
    fun channelIdsMatchSoundPolicy() {
        assertEquals("empery_push_v4", EmperyNotificationSoundChannels.PUSH_CHANNEL_ID)
        assertEquals("empery_calls_v5", EmperyNotificationSoundChannels.CALLS_CHANNEL_ID)
    }

    @Test
    fun legacyIdsRemainForMigrationDeletes() {
        assertEquals("fcm_default", EmperyNotificationSoundChannels.LEGACY_PUSH_CHANNEL_ID)
        assertEquals("incoming_calls", EmperyNotificationSoundChannels.LEGACY_CALLS_CHANNEL_ID)
        assertTrue(EmperyNotificationSoundChannels.PUSH_CHANNEL_ID.endsWith("_v4"))
        assertTrue(EmperyNotificationSoundChannels.CALLS_CHANNEL_ID.endsWith("_v5"))
    }
}
