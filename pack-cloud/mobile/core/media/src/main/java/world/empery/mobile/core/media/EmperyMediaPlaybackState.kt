/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Observable playback state for EmperyMediaPlayerController UI surfaces.
 */
package world.empery.mobile.core.media

data class EmperyMediaPlaybackState(
    val track: EmperyMediaTrack? = null,
    val isPlaying: Boolean = false,
    val isLoading: Boolean = false,
    val positionMs: Long = 0L,
    val durationMs: Long = 0L,
    val bufferedPositionMs: Long = 0L,
    val queueIndex: Int = -1,
    val queueSize: Int = 0,
    val queueTracks: List<EmperyMediaTrack> = emptyList(),
    val shuffleEnabled: Boolean = false,
    val repeatMode: EmperyQueueRepeatMode = EmperyQueueRepeatMode.OFF,
    val playbackSpeed: Float = 1f,
    val playbackFromCache: Boolean = false,
    val sleepTimerMinutes: EmperySleepTimerMinutes = EmperySleepTimerMinutes.OFF,
    val sleepTimerRemainingMs: Long? = null,
    val errorMessage: String? = null,
) {
    val hasActiveTrack: Boolean get() = track != null
    val hasQueue: Boolean get() = queueSize > 1
    val canSkipPrevious: Boolean
        get() =
            when {
                !hasActiveTrack -> false
                queueSize > 1 && queueIndex > 0 -> true
                else -> positionMs > SKIP_TO_PREV_THRESHOLD_MS
            }
    val canSkipNext: Boolean
        get() = hasActiveTrack && queueSize > 1 && queueIndex >= 0 && queueIndex < queueSize - 1

    companion object {
        const val SKIP_TO_PREV_THRESHOLD_MS = 3_000L
        const val SKIP_STEP_MS = 10_000L
    }
}

internal fun formatMediaTimeMs(ms: Long): String {
    if (ms <= 0L) return "0:00"
    val totalSeconds = ms / 1000L
    val minutes = totalSeconds / 60L
    val seconds = totalSeconds % 60L
    return "%d:%02d".format(minutes, seconds)
}
