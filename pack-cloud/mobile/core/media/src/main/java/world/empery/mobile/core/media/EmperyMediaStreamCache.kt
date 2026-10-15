/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Private in-app stream cache (Media3 SimpleCache under cacheDir) for offline UGS/audio replay.
 *
 * Invariants:
 * - Cache lives only in application private storage (not Downloads / external storage).
 * - LRU eviction; prefetch is best-effort and idempotent per content id.
 *
 * Related:
 * - EmperyMediaPlayerController, EmperyMediaPlayerHolder, UgsSongsScreen
 */
package world.empery.mobile.core.media

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import androidx.media3.common.C
import androidx.media3.common.util.UnstableApi
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.datasource.cache.CacheWriter
import androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import androidx.media3.datasource.okhttp.OkHttpDataSource
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import okhttp3.OkHttpClient
import java.io.File
import java.util.Collections

@UnstableApi
object EmperyMediaStreamCache {
    private const val CACHE_DIR = "empery_audio_stream_cache"
    const val MAX_CACHE_BYTES: Long = 512L * 1024L * 1024L
    private val CONTENT_ID_IN_URI = Regex("""/content/([0-9a-fA-F-]{36})/download""")

    @Volatile
    private var installed = false

    private lateinit var simpleCache: SimpleCache
    private lateinit var cacheDataSourceFactory: CacheDataSource.Factory
    private lateinit var appContext: Context

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val prefetchLock = Mutex()
    private val inFlightIds = Collections.synchronizedSet(mutableSetOf<String>())

    private val _cachedContentIds = MutableStateFlow<Set<String>>(emptySet())
    val cachedContentIds: StateFlow<Set<String>> = _cachedContentIds.asStateFlow()

    fun install(
        context: Context,
        okHttpClient: OkHttpClient,
    ) {
        if (installed) return
        synchronized(this) {
            if (installed) return
            val appContext = context.applicationContext
            this.appContext = appContext
            val cacheDir = File(appContext.cacheDir, CACHE_DIR).apply { mkdirs() }
            val databaseProvider = StandaloneDatabaseProvider(appContext)
            simpleCache =
                SimpleCache(
                    cacheDir,
                    LeastRecentlyUsedCacheEvictor(MAX_CACHE_BYTES),
                    databaseProvider,
                )
            val upstream =
                OkHttpDataSource.Factory(okHttpClient)
                    .setUserAgent("EmperyMobile")
            cacheDataSourceFactory =
                CacheDataSource.Factory()
                    .setCache(simpleCache)
                    .setUpstreamDataSourceFactory(upstream)
                    .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)
            installed = true
            scope.launch { rebuildCachedContentIdsFromStore() }
        }
    }

    fun dataSourceFactory(): CacheDataSource.Factory {
        check(installed) { "EmperyMediaStreamCache.install() required before use" }
        return cacheDataSourceFactory
    }

    fun isCached(contentId: String): Boolean = _cachedContentIds.value.contains(contentId)

    fun isPlaybackOfflineReady(
        contentId: String,
        uri: String,
    ): Boolean {
        if (!installed) return false
        if (_cachedContentIds.value.contains(contentId)) return true
        return isUriFullyCached(uri)
    }

    fun prefetchTracks(tracks: List<EmperyMediaTrack>) {
        if (!installed || tracks.isEmpty() || !isPrefetchAllowed()) return
        tracks.forEach { track ->
            prefetchContent(track.id, track.uri)
        }
    }

    fun prefetchContent(
        contentId: String,
        uri: String,
    ) {
        if (!installed || !isPrefetchAllowed()) return
        if (isCached(contentId) || inFlightIds.contains(contentId)) return
        scope.launch {
            prefetchLock.withLock {
                if (isCached(contentId) || !inFlightIds.add(contentId)) return@launch
            }
            try {
                cacheRemoteUri(uri, contentId)
            } finally {
                inFlightIds.remove(contentId)
            }
        }
    }

    fun usedCacheBytes(): Long {
        if (!installed) return 0L
        return runCatching { simpleCache.cacheSpace }.getOrDefault(0L)
    }

    fun cachedTrackCount(): Int = _cachedContentIds.value.size

    suspend fun clearCache() {
        if (!installed) return
        prefetchLock.withLock {
            inFlightIds.clear()
            for (key in simpleCache.keys.toList()) {
                runCatching { simpleCache.removeResource(key) }
            }
            _cachedContentIds.value = emptySet()
        }
    }

    fun isPrefetchAllowed(): Boolean {
        if (!installed) return false
        if (!EmperyMediaStreamCachePrefs.isWifiOnlyPrefetch(appContext)) return true
        return isOnUnmeteredNetwork(appContext)
    }

    private fun isOnUnmeteredNetwork(context: Context): Boolean {
        val connectivityManager =
            context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
                ?: return false
        val network = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)
    }

    private suspend fun rebuildCachedContentIdsFromStore() {
        if (!installed) return
        val discovered = linkedSetOf<String>()
        for (key in simpleCache.keys) {
            extractContentId(key)?.let { discovered.add(it) }
            if (isUriFullyCached(key)) {
                extractContentId(key)?.let { discovered.add(it) }
            }
        }
        if (discovered.isNotEmpty()) {
            _cachedContentIds.update { it + discovered }
        }
    }

    private fun cacheRemoteUri(
        uri: String,
        contentId: String,
    ) {
        if (!installed) return
        if (isUriFullyCached(uri)) {
            markCached(contentId)
            return
        }
        try {
            val dataSpec = DataSpec.Builder().setUri(Uri.parse(uri)).build()
            val dataSource = cacheDataSourceFactory.createDataSource()
            CacheWriter(dataSource, dataSpec, null, null).cache()
            if (isUriFullyCached(uri)) {
                markCached(contentId)
            }
        } catch (_: Exception) {
            // Auth/network errors during prefetch are non-fatal; playback may still stream online.
        }
    }

    private fun isUriFullyCached(uri: String): Boolean {
        if (!installed) return false
        return runCatching {
            val cachedLength = simpleCache.getCachedLength(uri, 0, C.LENGTH_UNSET.toLong())
            cachedLength > 0L && simpleCache.isCached(uri, 0, cachedLength)
        }.getOrDefault(false)
    }

    fun notifyPlaybackMayHaveCached(
        contentId: String,
        uri: String,
    ) {
        if (!installed || isCached(contentId)) return
        if (isUriFullyCached(uri)) {
            markCached(contentId)
        }
    }

    private fun markCached(contentId: String) {
        _cachedContentIds.update { current -> current + contentId }
    }

    private fun extractContentId(cacheKey: String): String? = CONTENT_ID_IN_URI.find(cacheKey)?.groupValues?.getOrNull(1)
}
