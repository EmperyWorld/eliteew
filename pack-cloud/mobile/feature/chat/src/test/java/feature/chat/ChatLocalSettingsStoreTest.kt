package feature.chat

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ChatLocalSettingsStoreTest {

    @Test
    fun saveDraft_preservesInternalSpaces() {
        val ctx = ApplicationProvider.getApplicationContext<Context>()
        val store = ChatLocalSettingsStore(ctx)
        assertTrue(store.saveDraft("chat-1", "hello world test"))
        assertEquals("hello world test", store.loadDrafts()["chat-1"])
    }

    @Test
    fun corruptFlagsJson_returnsEmptyAndDoesNotCrash() {
        val ctx = ApplicationProvider.getApplicationContext<Context>()
        val prefs = ctx.getSharedPreferences("chat_local_settings", Context.MODE_PRIVATE)
        prefs.edit().putString("feature.chat.v1.flags_json", "{not-json").commit()

        val store = ChatLocalSettingsStore(ctx)
        val loaded = store.load()
        assertTrue(loaded.isEmpty())
    }
}
