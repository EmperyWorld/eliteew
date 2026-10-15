package world.empery.mobile.connectivity

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map

data class NetworkLinkSnapshot(
    val validatedOnline: Boolean,
    /** Stable-enough identity for Wi-Fi↔cellular / NIC swaps (not only boolean online). */
    val linkIdentity: String,
)

class ConnectivityObserver(context: Context) {
    private val connectivityManager =
        context.getSystemService(ConnectivityManager::class.java)

    /**
     * Online/offline as reported by the default network, with [DEBOUNCE_MS] quiet period
     * so rapid capability churn does not flood collectors.
     */
    @OptIn(FlowPreview::class)
    fun observe(): Flow<Boolean> =
        observeLink().map { it.validatedOnline }.distinctUntilChanged()

    /**
     * Validated reachability plus transport/network identity for soft Socket.IO handover.
     */
    @OptIn(FlowPreview::class)
    fun observeLink(): Flow<NetworkLinkSnapshot> =
        callbackFlow {
            fun emitCurrent() {
                trySend(currentSnapshot())
            }

            val callback =
                object : ConnectivityManager.NetworkCallback() {
                    override fun onAvailable(network: Network) {
                        emitCurrent()
                    }

                    override fun onLost(network: Network) {
                        emitCurrent()
                    }

                    override fun onCapabilitiesChanged(
                        network: Network,
                        networkCapabilities: NetworkCapabilities,
                    ) {
                        emitCurrent()
                    }
                }

            val request =
                NetworkRequest.Builder()
                    .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                    .build()

            emitCurrent()
            connectivityManager.registerNetworkCallback(request, callback)

            awaitClose {
                connectivityManager.unregisterNetworkCallback(callback)
            }
        }
            .debounce(DEBOUNCE_MS)
            .distinctUntilChanged()

    private fun currentSnapshot(): NetworkLinkSnapshot {
        val activeNetwork = connectivityManager.activeNetwork
        val capabilities =
            activeNetwork?.let { connectivityManager.getNetworkCapabilities(it) }
        val validated =
            capabilities != null &&
                capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
        val transports =
            buildList {
                if (capabilities == null) return@buildList
                if (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) add("wifi")
                if (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) add("cell")
                if (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) add("vpn")
                if (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)) add("eth")
            }.joinToString("+").ifBlank { "none" }
        val identity =
            if (activeNetwork == null) {
                "none"
            } else {
                "${activeNetwork}_$transports"
            }
        return NetworkLinkSnapshot(validatedOnline = validated, linkIdentity = identity)
    }

    /** Snapshot of validated internet reachability for one-shot checks outside [observe]. */
    fun isNetworkValidated(): Boolean = currentSnapshot().validatedOnline

    companion object {
        private const val DEBOUNCE_MS = 400L
    }
}
