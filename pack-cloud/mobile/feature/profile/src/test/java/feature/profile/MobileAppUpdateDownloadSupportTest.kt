package feature.profile

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException

class MobileAppUpdateDownloadSupportTest {
    @Test
    fun buildRangeHeaderUsesChunkEndWhenProvided() {
        assertEquals("bytes=0-1048575", MobileAppUpdateDownloadSupport.buildRangeHeader(0L, 1_048_575L))
    }

    @Test
    fun buildRangeHeaderUsesOpenEndedRangeFromOffset() {
        assertEquals("bytes=30610984-", MobileAppUpdateDownloadSupport.buildRangeHeader(30_610_984L))
    }

    @Test
    fun parseContentRangeTotal() {
        assertEquals(
            119_537_664L,
            MobileAppUpdateDownloadSupport.parseTotalBytesFromContentRange("bytes 0-1023/119537664"),
        )
    }

    @Test
    fun resolveTotalBytesForPartialResponse() {
        assertEquals(
            119_537_664L,
            MobileAppUpdateDownloadSupport.resolveTotalBytes(
                contentRange = "bytes 30000000-119537663/119537664",
                contentLength = 89_537_664L,
                existingBytes = 30_000_000L,
                statusCode = 206,
            ),
        )
    }

    @Test
    fun computeProgressFromPartialFile() {
        val progress = MobileAppUpdateDownloadSupport.computeProgress(30_610_984L, 119_537_664L)
        requireNotNull(progress)
        assertTrue(progress in 0.24f..0.27f)
    }

    @Test
    fun ioExceptionIsRetryableHttp4xxIsNot() {
        assertTrue(MobileAppUpdateDownloadSupport.isRetryableDownloadFailure(IOException("reset")))
        assertFalse(
            MobileAppUpdateDownloadSupport.isRetryableDownloadFailure(
                IllegalStateException("APK download failed: HTTP 401"),
            ),
        )
    }
}
