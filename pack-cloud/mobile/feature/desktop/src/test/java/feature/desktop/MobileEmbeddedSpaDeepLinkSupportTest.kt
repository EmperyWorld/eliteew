/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Locks EWA companion deep-link query normalization and SPA hash forwarding.
 *
 * Invariants:
 * - Android Uri behavior runs under Robolectric, never the plain JVM stub.
 *
 * Related:
 * - MobileEmbeddedSpaDeepLinkSupport.kt
 */
package feature.desktop

import android.net.Uri
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class MobileEmbeddedSpaDeepLinkSupportTest {
    @Test
    fun resolveEmbeddedSpaHashFromIncomingTab_ewaAliases() {
        assertEquals(
            EwaCompanionWebViewLauncher.MOBILE_EWA_COMPANION_HASH,
            resolveEmbeddedSpaHashFromIncomingTab("ewa"),
        )
        assertEquals(
            EwaCompanionWebViewLauncher.MOBILE_EWA_COMPANION_HASH,
            resolveEmbeddedSpaHashFromIncomingTab("companion"),
        )
        assertNull(resolveEmbeddedSpaHashFromIncomingTab("feed"))
    }

    @Test
    fun extractEwaCompanionHashQuery_operationAndTools() {
        val uri =
            Uri.parse(
                "world.empery.mobile:/nav/ewa?operation=run-abc&tools=1&tab=ewa&ignored=x",
            )
        val query = extractEwaCompanionHashQuery(uri)
        requireNotNull(query)
        assertTrue(query.contains("operation=run-abc"))
        assertTrue(query.contains("tools=1"))
        assertTrue(!query.contains("tab="))
    }

    @Test
    fun appendHashQueryToSpaUrl_appendsWithAmpersand() {
        val base = "https://app.eliteew.ru/#/mobile-ewa-companion?spaBoot=1"
        val out = appendHashQueryToSpaUrl(base, "operation=run-1")
        assertEquals("$base&operation=run-1", out)
    }

    @Test
    fun companionSpaUrl_forwardsHashQuery() {
        val url =
            EwaCompanionWebViewLauncher.companionSpaUrl(
                "https://app.eliteew.ru",
                "operation=run-9",
            )
        assertTrue(url.contains("/#/mobile-ewa-companion"))
        assertTrue(url.contains("operation=run-9"))
    }
}
