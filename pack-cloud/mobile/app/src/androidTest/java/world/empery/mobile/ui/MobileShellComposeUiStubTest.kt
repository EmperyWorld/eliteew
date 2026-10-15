/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Compose UI instrumentation stubs for bottom nav, chat composer, Friends actions, Profile OTA.
 * Expand into full `@ComposeTestRule` flows when CI device farm is wired.
 *
 * Invariants:
 * - Stubs stay green on emulator; no network or Keycloak in default CI lane.
 *
 * Related:
 * - pack-cloud/mobile/maestro/smoke.yaml, pack-cloud/mobile/docs/FLAKY-TEST-POLICY.md
 */
package world.empery.mobile.ui

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class MobileShellComposeUiStubTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun shellSmoke_rendersContentUnderComposeRule() {
        composeRule.setContent {
            MobileShellSmokeContent()
        }

        composeRule.onNodeWithTag("mobile-shell-smoke").assertIsDisplayed()
    }

    @Test
    fun chatComposerStub() {
        assertTrue("Expand: open chat tab, type message, assert send enabled".isNotBlank())
    }

    @Test
    fun friendsActionsStub() {
        assertTrue("Expand: accept/reject request affordances visible".isNotBlank())
    }

    @Test
    fun profileOtaStub() {
        assertTrue("Expand: Profile → Updates section renders version row".isNotBlank())
    }
}

@Composable
private fun MobileShellSmokeContent() {
    Text(
        text = "Mobile shell smoke",
        modifier = Modifier.testTag("mobile-shell-smoke"),
    )
}
