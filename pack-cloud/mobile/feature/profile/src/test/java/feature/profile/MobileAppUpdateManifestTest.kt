package feature.profile

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import world.empery.mobile.core.network.api.MobileAppOverviewResponse

/** ota-007: manifest/overview contract regression guards. */
class MobileAppUpdateManifestTest {
    @Test
    fun overviewDefaultsNoStoreFieldsAbsent() {
        val dto = MobileAppOverviewResponse()
        assertFalse(dto.apkAvailable)
        assertEquals("/api/v1/mobile-app/download", dto.downloadApiPath)
        assertTrue(dto.downloadPageUrl.isEmpty())
    }

    @Test
    fun overviewStaleCacheRegression_versionCodeNullMeansUnknown() {
        val dto = MobileAppOverviewResponse(apkAvailable = true, versionCode = null, versionName = "9.9")
        assertTrue(dto.apkAvailable)
        assertEquals(null, dto.versionCode)
    }

    @Test
    fun downloadSupportRangeHeaderOpenEndedFromPartial() {
        assertTrue(MobileAppUpdateDownloadSupport.buildRangeHeader(1024L).startsWith("bytes=1024-"))
    }
}
