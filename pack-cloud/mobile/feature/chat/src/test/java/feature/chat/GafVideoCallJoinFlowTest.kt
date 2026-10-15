/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Join-flow smoke: trusted URL gate + post-call summary string resources.
 *
 * Related:
 * - GafMeetWebViewLauncher.kt, ChatRepository.formatPostCallSummaryBody
 */
package feature.chat

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class GafVideoCallJoinFlowTest {
    @Test
    fun joinFlow_validMeetUrlPassesTrustedHostGate() {
        val joinUrl = "https://meet.eliteew.ru/gaf-room?jwt=test"
        assertTrue(GafMeetWebViewLauncher.isValidJoinUrl(joinUrl))
    }

    @Test
    fun postCallSummary_stringResourcesIncludePartnerAndDuration() {
        val ctx = ApplicationProvider.getApplicationContext<Context>()
        val plain = ctx.getString(R.string.chat_post_call_summary, "Alice")
        val withDuration = ctx.getString(R.string.chat_post_call_summary_with_duration, "Alice", 3L)
        assertTrue(plain.contains("Alice"))
        assertTrue(withDuration.contains("Alice"))
        assertTrue(withDuration.contains("3"))
    }
}
