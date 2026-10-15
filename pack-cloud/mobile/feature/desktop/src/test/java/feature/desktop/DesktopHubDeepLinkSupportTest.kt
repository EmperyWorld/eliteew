package feature.desktop

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class DesktopHubDeepLinkSupportTest {
    @Test
    fun resolveDesktopHubSectionFromKey_aliases() {
        assertEquals(DesktopHubSectionId.STORE, resolveDesktopHubSectionFromKey("app_store"))
        assertEquals(DesktopHubSectionId.NOTES, resolveDesktopHubSectionFromKey("note"))
        assertEquals(DesktopHubSectionId.CONFIG, resolveDesktopHubSectionFromKey("theme"))
        assertEquals(DesktopHubSectionId.TODOS, resolveDesktopHubSectionFromKey("tasks"))
        assertEquals(DesktopHubLazyColumnIndices.STORE, DesktopHubSectionId.STORE.lazyListIndex)
        assertEquals(DesktopHubLazyColumnIndices.NOTES, DesktopHubSectionId.NOTES.lazyListIndex)
    }

    @Test
    fun resolveDesktopHubSectionFromKey_unknownReturnsNull() {
        assertNull(resolveDesktopHubSectionFromKey("unknown"))
        assertNull(resolveDesktopHubSectionFromKey(null))
        assertNull(resolveDesktopHubSectionFromKey(""))
    }
}
