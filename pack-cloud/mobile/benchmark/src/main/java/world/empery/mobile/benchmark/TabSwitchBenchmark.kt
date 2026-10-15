/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Super Roadmap performance-001…003: macrobenchmark tab switch latency after cold start.
 *
 * Invariants:
 * - Targets dev flavor package; requires signed-in session or guest shell for meaningful numbers.
 *
 * Related:
 * - StartupBenchmark.kt, docs/PERF_BASELINE.md
 */
package world.empery.mobile.benchmark

import androidx.benchmark.macro.FrameTimingMetric
import androidx.benchmark.macro.junit4.MacrobenchmarkRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.uiautomator.By
import androidx.test.uiautomator.Until
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class TabSwitchBenchmark {
    @get:Rule
    val rule = MacrobenchmarkRule()

    @Test
    fun switchBottomTabs() {
        rule.measureRepeated(
            packageName = "world.empery.mobile",
            metrics = listOf(FrameTimingMetric()),
            iterations = 5,
            setupBlock = {
                pressHome()
                startActivityAndWait()
                device.wait(Until.hasObject(By.textContains("EWDesk")), 15_000)
            },
        ) {
            listOf("Чат", "Chat", "AI", "Друзья", "Friends", "Профиль", "Profile").forEach { label ->
                val node = device.findObject(By.text(label))
                if (node != null) {
                    node.click()
                    device.waitForIdle(500)
                }
            }
        }
    }
}
