/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Sleep-timer presets for Empery media player (cycle Off → 15 → 30 → 60 min).
 *
 * Invariants:
 * - [OFF] clears an active timer; other values schedule pause at expiry.
 *
 * Related:
 * - EmperyMediaPlayerController, EmperyExpandedPlayerSheet
 */
package world.empery.mobile.core.media

enum class EmperySleepTimerMinutes(val minutes: Int) {
    OFF(0),
    MIN_15(15),
    MIN_30(30),
    MIN_60(60),
    ;

    fun next(): EmperySleepTimerMinutes =
        when (this) {
            OFF -> MIN_15
            MIN_15 -> MIN_30
            MIN_30 -> MIN_60
            MIN_60 -> OFF
        }
}
