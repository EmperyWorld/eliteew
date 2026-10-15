/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for persisted GAF chat list partner metadata in ChatLocalSettingsStore.
 *
 * Invariants:
 * - Partner meta survives save/load round trip per chat id.
 *
 * Related:
 * - ChatLocalSettingsStore.kt, ChatRepository.refreshChatList
 */
package feature.chat

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ChatLocalSettingsPartnerMetaTest {

    private lateinit var store: ChatLocalSettingsStore

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        context.getSharedPreferences("chat_local_settings", Context.MODE_PRIVATE).edit().clear().commit()
        store = ChatLocalSettingsStore(context)
    }

    @Test
    fun saveAndLoadPartnerMeta_roundTrip() {
        val meta =
            mapOf(
                "chat-1" to
                    GafChatListPartnerMeta(
                        username = "alice",
                        isPartnerMuted = true,
                        blockedByPartner = true,
                    ),
            )
        assertTrue(store.savePartnerMeta(meta))
        assertEquals(meta, store.loadPartnerMeta())
    }
}
