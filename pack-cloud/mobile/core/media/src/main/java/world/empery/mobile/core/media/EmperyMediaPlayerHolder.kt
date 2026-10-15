/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Application-scoped holder for [EmperyMediaPlayerController].
 */
package world.empery.mobile.core.media

import android.content.Context
import android.support.v4.media.session.MediaSessionCompat
import okhttp3.OkHttpClient
import world.empery.mobile.core.network.UnifiedContentUrls

object EmperyMediaPlayerHolder {
    @Volatile
    private var controllerRef: EmperyMediaPlayerController? = null

    @Volatile
    var apiBaseUrl: String = ""
        private set

    @Volatile
    var playbackServiceStarter: ((Context) -> Unit)? = null

    @Volatile
    var playbackServiceStopper: ((Context) -> Unit)? = null

    internal fun notifyPlaybackStarted(context: Context) {
        playbackServiceStarter?.invoke(context.applicationContext)
    }

    internal fun notifyPlaybackStopped(context: Context) {
        playbackServiceStopper?.invoke(context.applicationContext)
    }

    fun stopPlaybackIfActive(context: Context) {
        val ctrl = controllerRef ?: return
        if (ctrl.state.value.hasActiveTrack) {
            ctrl.stop()
        } else {
            notifyPlaybackStopped(context)
        }
    }

    val controller: EmperyMediaPlayerController
        get() =
            controllerRef
                ?: error("EmperyMediaPlayerHolder not initialized — call install() from Application.onCreate")

    fun install(
        context: Context,
        okHttpClient: OkHttpClient,
        apiBaseUrl: String,
    ) {
        if (controllerRef != null) {
            this.apiBaseUrl = apiBaseUrl.trim()
            return
        }
        synchronized(this) {
            if (controllerRef == null) {
                this.apiBaseUrl = apiBaseUrl.trim()
                EmperyMediaStreamCache.install(context, okHttpClient)
                controllerRef = EmperyMediaPlayerController(context)
            } else {
                this.apiBaseUrl = apiBaseUrl.trim()
            }
        }
    }

    fun isTrackCached(contentId: String): Boolean = EmperyMediaStreamCache.isCached(contentId)

    val cachedContentIds get() = EmperyMediaStreamCache.cachedContentIds

    fun streamCacheUsedBytes(): Long = EmperyMediaStreamCache.usedCacheBytes()

    fun streamCacheTrackCount(): Int = EmperyMediaStreamCache.cachedTrackCount()

    suspend fun clearStreamCache() = EmperyMediaStreamCache.clearCache()

    fun contentDownloadUrl(contentId: String): String =
        UnifiedContentUrls.downloadUrl(apiBaseUrl, contentId)

    fun contentThumbnailUrl(contentId: String): String =
        UnifiedContentUrls.thumbnailUrl(apiBaseUrl, contentId)

    fun playbackSessionCompatToken(): MediaSessionCompat.Token = controller.mediaSession.sessionCompatToken
}
