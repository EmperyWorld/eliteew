/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral tests for skipped-version OTA release notes aggregation.
 *
 * Invariants:
 * - Single-step updates use current release notes only.
 *
 * Related:
 * - MobileOtaReleaseNotes.kt, ProfileTabViewModel
 */
package feature.profile

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class MobileOtaReleaseNotesTest {
    private val history =
        listOf(
            OtaReleaseNotesEntry(120, "0.2.110", "OTA one-click"),
            OtaReleaseNotesEntry(121, "0.2.111", "Notifications cleanup"),
            OtaReleaseNotesEntry(122, "0.2.112", "Appearance unified"),
            OtaReleaseNotesEntry(123, "0.2.113", "Privacy and friends UX"),
        )

    @Test
    fun returnsNullWhenNoServerUpdate() {
        assertNull(
            aggregateOtaReleaseNotes(
                installedVersionCode = 123,
                serverVersionCode = 123,
                currentReleaseNotes = "Latest",
                history = history,
            ),
        )
    }

    @Test
    fun singleStepUsesCurrentReleaseNotes() {
        assertEquals(
            "Latest only",
            aggregateOtaReleaseNotes(
                installedVersionCode = 122,
                serverVersionCode = 123,
                currentReleaseNotes = "Latest only",
                history = history,
            ),
        )
    }

    @Test
    fun multiStepAggregatesIntermediateVersions() {
        val aggregated =
            aggregateOtaReleaseNotes(
                installedVersionCode = 120,
                serverVersionCode = 123,
                currentReleaseNotes = "Latest only",
                history = history,
            )
        requireNotNull(aggregated)
        assertTrue(aggregated.startsWith("Вы пропустили несколько обновлений"))
        assertTrue(aggregated.contains("Версия 0.2.111"))
        assertTrue(aggregated.contains("Notifications cleanup"))
        assertTrue(aggregated.contains("Версия 0.2.112"))
        assertTrue(aggregated.contains("Версия 0.2.113"))
        assertTrue(aggregated.contains("Privacy and friends UX"))
    }

    @Test
    fun multiStepFrom113To116IncludesIntermediateVersions() {
        val fullHistory =
            history +
                listOf(
                    OtaReleaseNotesEntry(124, "0.2.114", "Files UX"),
                    OtaReleaseNotesEntry(125, "0.2.115", "UGS list"),
                    OtaReleaseNotesEntry(126, "0.2.116", "Music player"),
                )
        val aggregated =
            aggregateOtaReleaseNotes(
                installedVersionCode = 123,
                serverVersionCode = 126,
                currentReleaseNotes = "Music player",
                history = fullHistory,
            )
        requireNotNull(aggregated)
        assertTrue(aggregated.contains("Версия 0.2.114"))
        assertTrue(aggregated.contains("Версия 0.2.115"))
        assertTrue(aggregated.contains("Версия 0.2.116"))
    }

    @Test
    fun resolvePrefersServerAggregatedNotes() {
        val overview =
            world.empery.mobile.core.network.api.MobileAppOverviewResponse(
                versionCode = 127,
                releaseNotes = "Вы пропустили несколько обновлений. Что изменилось:\n\nВерсия 0.2.117",
                releaseNotesHistory =
                    listOf(
                        world.empery.mobile.core.network.api.MobileReleaseNotesEntryDto(
                            127,
                            "0.2.117",
                            "Latest",
                        ),
                    ),
            )
        val resolved = resolveOtaReleaseNotesForProfile(123, overview)
        assertTrue(resolved?.startsWith("Вы пропустили несколько обновлений") == true)
    }
}
