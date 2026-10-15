package feature.ugs

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class UgsSongsMetaSupportTest {
    @Test
    fun formatSongDateLabel_parsesIsoInstant() {
        val label = formatSongDateLabel("2026-06-17T14:30:00Z")
        assertNotNull(label)
    }

    @Test
    fun formatSongDateLabel_returnsNullForBlank() {
        assertNull(formatSongDateLabel(""))
        assertNull(formatSongDateLabel(null))
    }

    @Test
    fun formatSongDateLabel_returnsNullForInvalid() {
        assertNull(formatSongDateLabel("not-a-date"))
    }
}
