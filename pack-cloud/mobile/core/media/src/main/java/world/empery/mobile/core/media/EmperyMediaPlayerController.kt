/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Process-wide ExoPlayer controller with MediaSession, queue, and authenticated OkHttp streaming.
 *
 * Invariants:
 * - Single ExoPlayer + MediaSession; queue synced via ExoPlayer playlist for lock-screen transport.
 * - Stream-cache prefetch covers at most current + next queue item, never the full list.
 * - Wi-Fi ↔ cellular re-init fades volume out/in so stream handoff does not pop/glitch.
 * - Initialized once via [EmperyMediaPlayerHolder].
 *
 * Related:
 * - EmperyMediaStreamCache, EmperyMediaPlaybackFade, EmperyMediaPlayerHolder
 */
package world.empery.mobile.core.media

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.Uri
import android.os.Build
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.session.MediaSession
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import android.util.Log

@OptIn(UnstableApi::class)
class EmperyMediaPlayerController(
    context: Context,
) {
    private val appContext = context.applicationContext
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var positionJob: Job? = null

    private val player: ExoPlayer =
        ExoPlayer.Builder(appContext)
            .setMediaSourceFactory(
                DefaultMediaSourceFactory(EmperyMediaStreamCache.dataSourceFactory()),
            )
            .build()

    val mediaSession: MediaSession =
        MediaSession.Builder(appContext, player).build()

    private val _state = MutableStateFlow(EmperyMediaPlaybackState())
    val state: StateFlow<EmperyMediaPlaybackState> = _state.asStateFlow()

    private var queue: List<EmperyMediaTrack> = emptyList()
    private var queueIndex: Int = -1
    private var originalQueueOrder: List<EmperyMediaTrack> = emptyList()
    private var shuffleEnabled = false
    private var repeatMode = EmperyQueueRepeatMode.OFF
    private var playbackSpeed = 1f
    private var sleepTimerEndsAtEpochMs: Long? = null
    private var sleepTimerSelectedMinutes: EmperySleepTimerMinutes = EmperySleepTimerMinutes.OFF
    private var sleepTimerJob: Job? = null

    private val audioManager = appContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private var hasAudioFocus = false
    private var pausedByFocusLoss = false

    private val connectivityManager =
        appContext.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private var lastLinkIdentity: String? = null
    private var networkHandoffJob: Job? = null
    private val networkHandoffMutex = Mutex()
    private var targetPlaybackVolume: Float = 1f

    private val audioFocusChangeListener =
        AudioManager.OnAudioFocusChangeListener { focusChange ->
            when (focusChange) {
                AudioManager.AUDIOFOCUS_LOSS -> {
                    pausedByFocusLoss = false
                    if (player.isPlaying) {
                        player.pause()
                    }
                }
                AudioManager.AUDIOFOCUS_LOSS_TRANSIENT,
                AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK,
                -> {
                    if (player.isPlaying) {
                        pausedByFocusLoss = true
                        player.pause()
                    }
                }
                AudioManager.AUDIOFOCUS_GAIN -> {
                    if (pausedByFocusLoss && _state.value.track != null && !player.isPlaying) {
                        pausedByFocusLoss = false
                        player.play()
                    }
                }
            }
        }

    private val audioFocusRequest: AudioFocusRequest? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .build(),
                )
                .setOnAudioFocusChangeListener(audioFocusChangeListener)
                .build()
        } else {
            null
        }

    private val listener =
        object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                publishSnapshot()
                syncPositionLoop(isPlaying)
                if (isPlaying) {
                    pausedByFocusLoss = false
                    EmperyMediaPlayerHolder.notifyPlaybackStarted(appContext)
                }
            }

            override fun onPlaybackStateChanged(playbackState: Int) {
                if (
                    playbackState == Player.STATE_ENDED &&
                    player.repeatMode == Player.REPEAT_MODE_OFF &&
                    !player.hasNextMediaItem()
                ) {
                    player.seekTo(0)
                    player.pause()
                }
                publishSnapshot()
            }

            override fun onMediaItemTransition(
                mediaItem: MediaItem?,
                reason: Int,
            ) {
                syncTrackFromPlayer(mediaItem)
                prefetchQueueWindow()
                publishSnapshot()
            }

            override fun onPlayerError(error: PlaybackException) {
                _state.value =
                    _state.value.copy(
                        isPlaying = false,
                        isLoading = false,
                        errorMessage = error.localizedMessage ?: error.message,
                    )
            }
        }

    init {
        player.addListener(listener)
        player.volume = targetPlaybackVolume
        registerNetworkHandoffObserver()
        publishSnapshot()
    }

    fun play(track: EmperyMediaTrack) {
        resetQueueModes()
        queue = listOf(track)
        queueIndex = 0
        syncPlayerQueue(startIndex = 0, autoplay = true)
        prefetchQueueWindow()
    }

    fun playQueue(
        tracks: List<EmperyMediaTrack>,
        startIndex: Int = 0,
    ) {
        if (tracks.isEmpty()) return
        resetQueueModes()
        queue = tracks
        queueIndex = startIndex.coerceIn(0, tracks.lastIndex)
        syncPlayerQueue(startIndex = queueIndex, autoplay = true)
        prefetchQueueWindow()
    }

    /** Prefetch only the current track and the next one — never the full queue. */
    private fun prefetchQueueWindow() {
        val current = queue.getOrNull(queueIndex) ?: return
        EmperyMediaStreamCache.prefetchContent(current.id, current.uri)
        queue.getOrNull(queueIndex + 1)?.let { next ->
            EmperyMediaStreamCache.prefetchContent(next.id, next.uri)
        }
    }

    fun toggleShuffle() {
        if (queue.size <= 1) return
        val currentId = _state.value.track?.id ?: return
        shuffleEnabled = !shuffleEnabled
        if (originalQueueOrder.isEmpty()) {
            originalQueueOrder = queue.toList()
        }
        queue =
            if (shuffleEnabled) {
                val current = originalQueueOrder.firstOrNull { it.id == currentId } ?: return
                listOf(current) + originalQueueOrder.filter { it.id != currentId }.shuffled()
            } else {
                originalQueueOrder
            }
        val idx = queue.indexOfFirst { it.id == currentId }.coerceAtLeast(0)
        val positionMs = player.currentPosition.coerceAtLeast(0L)
        queueIndex = idx
        player.setMediaItems(queue.map { it.toMediaItem() }, idx, positionMs)
        if (player.isPlaying) {
            player.play()
        }
        publishSnapshot()
    }

    fun toggleRepeat() {
        repeatMode =
            when (repeatMode) {
                EmperyQueueRepeatMode.OFF -> EmperyQueueRepeatMode.ONE
                EmperyQueueRepeatMode.ONE -> EmperyQueueRepeatMode.ALL
                EmperyQueueRepeatMode.ALL -> EmperyQueueRepeatMode.OFF
            }
        applyRepeatModeToPlayer()
        publishSnapshot()
    }

    fun cyclePlaybackSpeed() {
        playbackSpeed =
            when (playbackSpeed) {
                1f -> 1.25f
                1.25f -> 1.5f
                1.5f -> 0.75f
                else -> 1f
            }
        player.setPlaybackSpeed(playbackSpeed)
        publishSnapshot()
    }

    fun cycleSleepTimer() {
        val next = sleepTimerSelectedMinutes.next()
        if (next == EmperySleepTimerMinutes.OFF) {
            clearSleepTimer()
        } else {
            sleepTimerSelectedMinutes = next
            sleepTimerEndsAtEpochMs = System.currentTimeMillis() + next.minutes * 60_000L
            startSleepTimerJob()
        }
        publishSnapshot()
    }

    fun jumpToQueueIndex(index: Int) {
        if (index !in queue.indices) return
        queueIndex = index
        player.seekTo(index, 0L)
        requestAudioFocus()
        player.play()
        publishSnapshot()
        syncPositionLoop(true)
    }

    fun skipToPrevious() {
        if (_state.value.track == null) return
        if (player.currentPosition > EmperyMediaPlaybackState.SKIP_TO_PREV_THRESHOLD_MS) {
            player.seekTo(0)
        } else if (player.hasPreviousMediaItem()) {
            player.seekToPreviousMediaItem()
        } else {
            player.seekTo(0)
        }
        publishSnapshot()
    }

    fun skipToNext() {
        if (!player.hasNextMediaItem()) return
        player.seekToNextMediaItem()
        publishSnapshot()
    }

    fun skipBack() {
        if (_state.value.track == null) return
        val next = (player.currentPosition - EmperyMediaPlaybackState.SKIP_STEP_MS).coerceAtLeast(0L)
        player.seekTo(next)
        publishSnapshot()
    }

    fun skipForward() {
        if (_state.value.track == null) return
        val duration = player.duration.takeIf { it > 0 && it != androidx.media3.common.C.TIME_UNSET }
        val next =
            if (duration != null) {
                (player.currentPosition + EmperyMediaPlaybackState.SKIP_STEP_MS).coerceAtMost(duration)
            } else {
                player.currentPosition + EmperyMediaPlaybackState.SKIP_STEP_MS
            }
        player.seekTo(next)
        publishSnapshot()
    }

    fun retryCurrentTrack() {
        val track = _state.value.track ?: return
        val index =
            if (queue.isNotEmpty()) {
                queue.indexOfFirst { it.id == track.id }.takeIf { it >= 0 } ?: queueIndex.coerceAtLeast(0)
            } else {
                0
            }
        if (queue.isEmpty()) {
            queue = listOf(track)
        }
        queueIndex = index.coerceIn(0, queue.lastIndex)
        syncPlayerQueue(startIndex = queueIndex, autoplay = true)
    }

    fun togglePlayPause() {
        if (_state.value.track == null) return
        if (player.isPlaying) {
            player.pause()
        } else {
            requestAudioFocus()
            player.play()
        }
    }

    fun pauseForInterrupt() {
        if (_state.value.track == null) return
        pausedByFocusLoss = false
        if (player.isPlaying) {
            player.pause()
        }
    }

    fun seekTo(positionMs: Long) {
        if (_state.value.track == null) return
        player.seekTo(positionMs.coerceAtLeast(0L))
        publishSnapshot()
    }

    fun stop() {
        queue = emptyList()
        queueIndex = -1
        resetQueueModes()
        clearSleepTimer()
        pausedByFocusLoss = false
        networkHandoffJob?.cancel()
        player.volume = targetPlaybackVolume
        player.stop()
        player.clearMediaItems()
        positionJob?.cancel()
        positionJob = null
        abandonAudioFocus()
        _state.value = EmperyMediaPlaybackState()
        EmperyMediaPlayerHolder.notifyPlaybackStopped(appContext)
    }

    fun release() {
        positionJob?.cancel()
        networkHandoffJob?.cancel()
        unregisterNetworkHandoffObserver()
        abandonAudioFocus()
        player.removeListener(listener)
        mediaSession.release()
        player.release()
        _state.value = EmperyMediaPlaybackState()
    }

    private fun registerNetworkHandoffObserver() {
        val cm = connectivityManager ?: return
        if (networkCallback != null) return
        lastLinkIdentity = currentLinkIdentity()
        val callback =
            object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) {
                    onNetworkLinkMaybeChanged()
                }

                override fun onLost(network: Network) {
                    onNetworkLinkMaybeChanged()
                }

                override fun onCapabilitiesChanged(
                    network: Network,
                    networkCapabilities: NetworkCapabilities,
                ) {
                    onNetworkLinkMaybeChanged()
                }
            }
        networkCallback = callback
        val request =
            NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build()
        runCatching { cm.registerNetworkCallback(request, callback) }
            .onFailure { error ->
                Log.w(TAG, "network handoff observer unavailable", error)
                networkCallback = null
            }
    }

    private fun unregisterNetworkHandoffObserver() {
        val callback = networkCallback ?: return
        runCatching { connectivityManager?.unregisterNetworkCallback(callback) }
        networkCallback = null
    }

    private fun onNetworkLinkMaybeChanged() {
        val identity = currentLinkIdentity()
        val previous = lastLinkIdentity
        if (previous == null) {
            lastLinkIdentity = identity
            return
        }
        if (previous == identity) return
        lastLinkIdentity = identity
        if (!player.isPlaying || _state.value.track == null) return
        // Same reachability class with only capability noise — skip.
        if (!identityContainsTransportChange(previous, identity)) return
        networkHandoffJob?.cancel()
        networkHandoffJob =
            scope.launch {
                reinitializeStreamWithFade("network_link:$previous->$identity")
            }
    }

    private fun identityContainsTransportChange(
        previous: String,
        next: String,
    ): Boolean {
        fun transports(raw: String): Set<String> {
            val suffix = raw.substringAfter('_', missingDelimiterValue = raw)
            return suffix.split('+').filter { it.isNotBlank() && it != "none" }.toSet()
        }
        return transports(previous) != transports(next)
    }

    private fun currentLinkIdentity(): String {
        val cm = connectivityManager ?: return "none"
        val active = cm.activeNetwork
        val caps = active?.let { cm.getNetworkCapabilities(it) }
        val transports =
            buildList {
                if (caps == null) return@buildList
                if (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) add("wifi")
                if (caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) add("cell")
                if (caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) add("vpn")
                if (caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)) add("eth")
            }.joinToString("+").ifBlank { "none" }
        return if (active == null) "none" else "${active}_$transports"
    }

    private suspend fun reinitializeStreamWithFade(reason: String) {
        networkHandoffMutex.withLock {
            if (_state.value.track == null) return
            val resumePosition = player.currentPosition.coerceAtLeast(0L)
            val wasPlaying = player.isPlaying || _state.value.isPlaying
            Log.i(TAG, "stream handoff fade start reason=$reason pos=$resumePosition")
            applyVolumeSteps(EmperyMediaPlaybackFade.fadeOutVolumes(from = player.volume))
            val track = _state.value.track ?: return
            val index =
                queue.indexOfFirst { it.id == track.id }.takeIf { it >= 0 }
                    ?: queueIndex.coerceAtLeast(0)
            if (queue.isEmpty()) {
                queue = listOf(track)
            }
            queueIndex = index.coerceIn(0, queue.lastIndex)
            player.setMediaItems(queue.map { it.toMediaItem() }, queueIndex, resumePosition)
            player.prepare()
            if (wasPlaying) {
                requestAudioFocus()
                player.play()
                syncPositionLoop(true)
            }
            applyVolumeSteps(
                EmperyMediaPlaybackFade.fadeInVolumes(to = targetPlaybackVolume),
            )
            player.volume = targetPlaybackVolume
            publishSnapshot()
            Log.i(TAG, "stream handoff fade complete reason=$reason")
        }
    }

    private suspend fun applyVolumeSteps(steps: List<Float>) {
        for (volume in steps) {
            player.volume = volume
            delay(EmperyMediaPlaybackFade.DEFAULT_STEP_DELAY_MS)
        }
    }

    private fun syncPlayerQueue(
        startIndex: Int,
        autoplay: Boolean,
    ) {
        if (queue.isEmpty()) return
        queueIndex = startIndex.coerceIn(0, queue.lastIndex)
        val track = queue[queueIndex]
        _state.value =
            EmperyMediaPlaybackState(
                track = track,
                isLoading = true,
                errorMessage = null,
                queueIndex = queueIndex,
                queueSize = queue.size,
                queueTracks = queue.toList(),
                shuffleEnabled = shuffleEnabled,
                repeatMode = repeatMode,
                playbackSpeed = playbackSpeed,
            )
        applyRepeatModeToPlayer()
        player.setPlaybackSpeed(playbackSpeed)
        player.setMediaItems(queue.map { it.toMediaItem() }, queueIndex, 0L)
        player.prepare()
        if (autoplay) {
            requestAudioFocus()
            player.play()
            syncPositionLoop(true)
            EmperyMediaPlayerHolder.notifyPlaybackStarted(appContext)
        }
        publishSnapshot()
    }

    private fun syncTrackFromPlayer(mediaItem: MediaItem?) {
        val id = mediaItem?.mediaId ?: return
        val index = queue.indexOfFirst { it.id == id }
        if (index >= 0) {
            queueIndex = index
        }
        val track = queue.getOrNull(queueIndex) ?: return
        _state.value =
            _state.value.copy(
                track = track,
                errorMessage = null,
                queueIndex = queueIndex,
                queueSize = queue.size,
                queueTracks = queue.toList(),
            )
    }

    private fun syncPositionLoop(shouldRun: Boolean) {
        if (!shouldRun) {
            positionJob?.cancel()
            positionJob = null
            return
        }
        if (positionJob?.isActive == true) return
        positionJob =
            scope.launch {
                while (isActive) {
                    publishSnapshot()
                    delay(400L)
                }
            }
    }

    private fun requestAudioFocus() {
        if (hasAudioFocus) return
        val granted =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
                audioManager.requestAudioFocus(audioFocusRequest) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
            } else {
                @Suppress("DEPRECATION")
                audioManager.requestAudioFocus(
                    audioFocusChangeListener,
                    AudioManager.STREAM_MUSIC,
                    AudioManager.AUDIOFOCUS_GAIN,
                ) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
            }
        hasAudioFocus = granted
    }

    private fun abandonAudioFocus() {
        if (!hasAudioFocus) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
            audioManager.abandonAudioFocusRequest(audioFocusRequest)
        } else {
            @Suppress("DEPRECATION")
            audioManager.abandonAudioFocus(audioFocusChangeListener)
        }
        hasAudioFocus = false
    }

    private fun publishSnapshot() {
        val track = _state.value.track
        if (track == null) {
            _state.value = EmperyMediaPlaybackState()
            return
        }
        val durationMs = player.duration.coerceAtLeast(0L).takeIf { it != androidx.media3.common.C.TIME_UNSET } ?: 0L
        val bufferedMs =
            player.bufferedPosition.coerceAtLeast(0L).takeIf { it != androidx.media3.common.C.TIME_UNSET } ?: 0L
        val currentIndex =
            if (player.mediaItemCount > 0) {
                player.currentMediaItemIndex.coerceAtLeast(0)
            } else {
                queueIndex
            }
        if (currentIndex in queue.indices) {
            queueIndex = currentIndex
        }
        val activeTrack = queue.getOrNull(queueIndex) ?: track
        EmperyMediaStreamCache.notifyPlaybackMayHaveCached(activeTrack.id, activeTrack.uri)
        _state.value =
            _state.value.copy(
                track = activeTrack,
                isPlaying = player.isPlaying,
                isLoading = player.playbackState == Player.STATE_BUFFERING,
                positionMs = player.currentPosition.coerceAtLeast(0L),
                durationMs = durationMs,
                bufferedPositionMs = bufferedMs,
                queueIndex = if (queue.isEmpty()) -1 else queueIndex,
                queueSize = queue.size,
                queueTracks = queue.toList(),
                shuffleEnabled = shuffleEnabled,
                repeatMode = repeatMode,
                playbackSpeed = playbackSpeed,
                playbackFromCache =
                    EmperyMediaStreamCache.isPlaybackOfflineReady(
                        activeTrack.id,
                        activeTrack.uri,
                    ),
                sleepTimerMinutes =
                    if (sleepTimerEndsAtEpochMs != null) {
                        sleepTimerSelectedMinutes
                    } else {
                        EmperySleepTimerMinutes.OFF
                    },
                sleepTimerRemainingMs = sleepTimerRemainingMs(),
            )
    }

    private fun sleepTimerRemainingMs(): Long? {
        val endsAt = sleepTimerEndsAtEpochMs ?: return null
        val remaining = endsAt - System.currentTimeMillis()
        return if (remaining > 0L) remaining else null
    }

    private fun clearSleepTimer() {
        sleepTimerEndsAtEpochMs = null
        sleepTimerSelectedMinutes = EmperySleepTimerMinutes.OFF
        sleepTimerJob?.cancel()
        sleepTimerJob = null
    }

    private fun startSleepTimerJob() {
        sleepTimerJob?.cancel()
        sleepTimerJob =
            scope.launch {
                while (isActive) {
                    val endsAt = sleepTimerEndsAtEpochMs ?: return@launch
                    val remaining = endsAt - System.currentTimeMillis()
                    if (remaining <= 0L) {
                        clearSleepTimer()
                        if (player.isPlaying) {
                            player.pause()
                        }
                        publishSnapshot()
                        return@launch
                    }
                    publishSnapshot()
                    delay(1_000L)
                }
            }
    }

    private fun resetQueueModes() {
        shuffleEnabled = false
        repeatMode = EmperyQueueRepeatMode.OFF
        originalQueueOrder = emptyList()
        playbackSpeed = 1f
        player.repeatMode = Player.REPEAT_MODE_OFF
        player.setPlaybackSpeed(playbackSpeed)
    }

    private fun applyRepeatModeToPlayer() {
        player.repeatMode =
            when (repeatMode) {
                EmperyQueueRepeatMode.OFF -> Player.REPEAT_MODE_OFF
                EmperyQueueRepeatMode.ONE -> Player.REPEAT_MODE_ONE
                EmperyQueueRepeatMode.ALL -> Player.REPEAT_MODE_ALL
            }
    }

    private fun EmperyMediaTrack.toMediaItem(): MediaItem {
        val metadataBuilder =
            MediaMetadata.Builder()
                .setTitle(title)
                .setArtist(subtitle)
        artworkUrl?.trim()?.takeIf { it.isNotEmpty() }?.let { url ->
            metadataBuilder.setArtworkUri(Uri.parse(url))
        }
        return MediaItem.Builder()
            .setUri(uri)
            .setMediaId(id)
            .setMediaMetadata(metadataBuilder.build())
            .apply {
                mimeType?.let { setMimeType(it) }
            }
            .build()
    }

    companion object {
        private const val TAG = "EmperyMediaPlayer"
    }
}
