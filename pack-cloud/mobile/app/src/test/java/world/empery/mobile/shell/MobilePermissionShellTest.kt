/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit lock for MobilePermissionShell core-permission prompt resolution.
 *
 * Invariants:
 * - — (нет)
 *
 * Related:
 * - MobilePermissionShell.kt, MOBILE-ANDROID-PRODUCT-PERFECTION-PLAN.md W1
 */
package world.empery.mobile

import org.junit.Assert.assertEquals
import org.junit.Test

class MobilePermissionShellTest {
    @Test
    fun resolveCoreAppPermissionPrompt_noneWhenNothingMissing() {
        assertEquals(
            CoreAppPermissionPrompt.None,
            resolveCoreAppPermissionPrompt(
                missingCore = emptyList(),
                shouldShowRationale = true,
            ),
        )
    }

    @Test
    fun resolveCoreAppPermissionPrompt_showRationaleWhenPrefAllows() {
        assertEquals(
            CoreAppPermissionPrompt.ShowRationale,
            resolveCoreAppPermissionPrompt(
                missingCore = listOf("android.permission.CAMERA"),
                shouldShowRationale = true,
            ),
        )
    }

    @Test
    fun resolveCoreAppPermissionPrompt_markDeniedWhenRationaleAlreadyHandled() {
        assertEquals(
            CoreAppPermissionPrompt.MarkDenied,
            resolveCoreAppPermissionPrompt(
                missingCore = listOf("android.permission.CAMERA"),
                shouldShowRationale = false,
            ),
        )
    }

    @Test
    fun resolveFullScreenIntentPermissionPrompt_noneWhenGrantedOrNotRequired() {
        assertEquals(
            FullScreenIntentPermissionPrompt.None,
            resolveFullScreenIntentPermissionPrompt(
                requiresPrompt = false,
                canUse = false,
                shouldShowRationale = true,
            ),
        )
        assertEquals(
            FullScreenIntentPermissionPrompt.None,
            resolveFullScreenIntentPermissionPrompt(
                requiresPrompt = true,
                canUse = true,
                shouldShowRationale = true,
            ),
        )
    }

    @Test
    fun resolveFullScreenIntentPermissionPrompt_showRationaleOrBanner() {
        assertEquals(
            FullScreenIntentPermissionPrompt.ShowRationale,
            resolveFullScreenIntentPermissionPrompt(
                requiresPrompt = true,
                canUse = false,
                shouldShowRationale = true,
            ),
        )
        assertEquals(
            FullScreenIntentPermissionPrompt.ShowDeniedBanner,
            resolveFullScreenIntentPermissionPrompt(
                requiresPrompt = true,
                canUse = false,
                shouldShowRationale = false,
            ),
        )
    }
}
