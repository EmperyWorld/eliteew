package world.empery.mobile.core.network

import com.google.gson.Gson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import world.empery.mobile.core.network.api.MobileAppApi
import world.empery.mobile.core.network.api.MobileAppOverviewResponse
import world.empery.mobile.core.network.api.MobileTrustedDeviceApi

class MobileAppApiContractsTest {
    private val gson = Gson()

    @Test
    fun mobileAppOverviewRouteMatchesBackend() {
        ApiContractPathAssertions.assertGet(MobileAppApi::class, "getOverview", "mobile-app/overview")
    }

    @Test
    fun mobileSupportReportRouteMatchesBackend() {
        ApiContractPathAssertions.assertPost(
            MobileAppApi::class,
            "submitSupportReport",
            "mobile-app/support-reports",
        )
    }

    @Test
    fun mobileProfileRoutesMatchBackend() {
        ApiContractPathAssertions.assertGet(MobileAppApi::class, "getMobileProfile", "mobile-app/profile")
        ApiContractPathAssertions.assertPatch(MobileAppApi::class, "patchMobileProfile", "mobile-app/profile")
        ApiContractPathAssertions.assertPut(MobileAppApi::class, "putRealtimeState", "mobile-app/realtime-state")
    }

    @Test
    fun mobileTrustedDeviceListAndRevokeRoutesMatchBackend() {
        ApiContractPathAssertions.assertGet(MobileTrustedDeviceApi::class, "listDevices", "mobile-devices")
        ApiContractPathAssertions.assertGet(
            MobileTrustedDeviceApi::class,
            "getActiveTunnelMetadata",
            "mobile-devices/active/tunnel-metadata",
        )
        ApiContractPathAssertions.assertPost(
            MobileTrustedDeviceApi::class,
            "revokeDevice",
            "mobile-devices/{deviceId}/revoke",
        )
        ApiContractPathAssertions.assertPost(
            MobileTrustedDeviceApi::class,
            "rotateWgKey",
            "mobile-devices/{deviceId}/rotate-wg",
        )
    }

    @Test
    fun mobileTrustedDeviceTransferRoutesMatchBackend() {
        ApiContractPathAssertions.assertPost(
            MobileTrustedDeviceApi::class,
            "resolvePairingChallenge",
            "mobile-devices/pairing-challenges/resolve",
        )
        ApiContractPathAssertions.assertPost(
            MobileTrustedDeviceApi::class,
            "bindDevice",
            "mobile-devices/bind",
        )
        ApiContractPathAssertions.assertPost(
            MobileTrustedDeviceApi::class,
            "startTransfer",
            "mobile-devices/transfer/start",
        )
        ApiContractPathAssertions.assertPost(
            MobileTrustedDeviceApi::class,
            "confirmOldDeviceTransfer",
            "mobile-devices/transfer/{transferId}/confirm-old",
        )
        ApiContractPathAssertions.assertPost(
            MobileTrustedDeviceApi::class,
            "confirmTransferEmail",
            "mobile-devices/transfer/{transferId}/confirm-email",
        )
        ApiContractPathAssertions.assertPost(
            MobileTrustedDeviceApi::class,
            "completeTransfer",
            "mobile-devices/transfer/{transferId}/complete",
        )
    }

    @Test
    fun parsesOverviewResponseWithOtaFields() {
        val json = """
            {
              "download_page_url": "https://app.eliteew.ru/mobile-app/",
              "download_api_path": "/api/v1/mobile-app/download",
              "apk_available": true,
              "apk_size_bytes": 12345678,
              "version_code": 40,
              "version_name": "0.2.30",
              "apk_sha256": "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
              "published_at": "2026-06-17T00:00:00+00:00",
              "release_notes": "Flagship release",
              "release_notes_history": [
                {
                  "version_code": 39,
                  "version_name": "0.2.29",
                  "release_notes": "Earlier release"
                },
                {
                  "version_code": 40,
                  "version_name": "0.2.30",
                  "release_notes": "Flagship release"
                }
              ],
              "min_supported_version_code": 39
            }
        """.trimIndent()
        val overview = gson.fromJson(json, MobileAppOverviewResponse::class.java)
        assertTrue(overview.apkAvailable)
        assertEquals(40, overview.versionCode)
        assertEquals("0.2.30", overview.versionName)
        assertEquals("2026-06-17T00:00:00+00:00", overview.publishedAt)
        assertEquals("Flagship release", overview.releaseNotes)
        assertEquals(2, overview.releaseNotesHistory?.size)
        assertEquals(40, overview.releaseNotesHistory?.last()?.versionCode)
        assertEquals(39, overview.minSupportedVersionCode)
    }
}
