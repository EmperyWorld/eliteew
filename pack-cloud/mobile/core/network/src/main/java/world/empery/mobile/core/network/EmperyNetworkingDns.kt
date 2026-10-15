/*
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * DNS policy for EliteEW mobile networking. Public stable mode may bypass LAN split-horizon via DoH;
 * private tunnel beta must allow Android/WireGuard system DNS to resolve app/auth to the tunnel edge IP.
 *
 * Invariants:
 * - Private tunnel beta uses WireGuard system DNS first; on MIUI/Private DNS NXDOMAIN, split hosts fall back to tunnel edge 10.88.88.1.
 * - DoH lookups are chained (Google, then Cloudflare) before system DNS fallback for public stable mode.
 *
 * Related:
 * - NetworkFactory.createRetrofit, AppContainer.kt, MobilePrivateTunnelManager
 * ---
 */

package world.empery.mobile.core.network

import java.net.InetAddress
import java.util.Locale
import java.util.concurrent.TimeUnit
import okhttp3.Dns
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.dnsoverhttps.DnsOverHttps

/** OkHttp Dns policy for LAN split-DNS setups against `*.eliteew.ru`. */
object EmperyNetworkingDns {

    private val SPLIT_HORIZON_HOSTS =
        setOf(
            "app.eliteew.ru",
            "auth.eliteew.ru",
            "app-staging.eliteew.ru",
            "meet.eliteew.ru",
        )

    private val dnsBootstrapClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .protocols(listOf(Protocol.HTTP_2, Protocol.HTTP_1_1))
            .connectTimeout(6L, TimeUnit.SECONDS)
            .readTimeout(6L, TimeUnit.SECONDS)
            .writeTimeout(6L, TimeUnit.SECONDS)
            .callTimeout(10L, TimeUnit.SECONDS)
            .build()
    }

    private val dnsOverHttpsGoogle: DnsOverHttps by lazy {
        DnsOverHttps.Builder().client(dnsBootstrapClient)
            .url("https://dns.google/dns-query".toHttpUrl())
            .bootstrapDnsHosts(
                InetAddress.getByAddress(byteArrayOf(8, 8, 8, 8)),
                InetAddress.getByAddress(byteArrayOf(8, 8, 4, 4)),
            )
            .build()
    }

    private val dnsOverHttpsCloudflare: DnsOverHttps by lazy {
        DnsOverHttps.Builder().client(dnsBootstrapClient)
            .url("https://cloudflare-dns.com/dns-query".toHttpUrl())
            .bootstrapDnsHosts(
                InetAddress.getByAddress(byteArrayOf(1, 1, 1, 1)),
                InetAddress.getByAddress(byteArrayOf(1, 0, 0, 1)),
            )
            .build()
    }

    private val chainedDohDns: Dns by lazy {
        object : Dns {
            override fun lookup(hostname: String): List<InetAddress> =
                safeLookup(hostname, dnsOverHttpsGoogle)
                    ?: safeLookup(hostname, dnsOverHttpsCloudflare)
                    ?: Dns.SYSTEM.lookup(hostname)
        }
    }

    private val splitBypassDns: Dns by lazy {
        SplitHorizonSafeDns(splitHosts = SPLIT_HORIZON_HOSTS, publicDns = chainedDohDns, systemDns = Dns.SYSTEM)
    }

    /** WG tunnel edge / split-DNS IP for app/auth/meet when system resolver fails under VPN. */
    private val privateTunnelEdgeDnsFallback: InetAddress by lazy {
        InetAddress.getByAddress(byteArrayOf(10, 88, 88, 1))
    }

    private val privateTunnelSplitDns: Dns by lazy {
        PrivateTunnelSplitDns(
            splitHosts = SPLIT_HORIZON_HOSTS,
            systemDns = Dns.SYSTEM,
            tunnelEdgeFallback = privateTunnelEdgeDnsFallback,
        )
    }

    @JvmStatic
    fun okhttpDns(apiBaseUrl: String, ssoLoginUrl: String, forceSystemDns: Boolean = false): Dns =
        when {
            forceSystemDns -> privateTunnelSplitDns
            !targetsPublicEmperyWorld(apiBaseUrl, ssoLoginUrl) -> Dns.SYSTEM
            pointsAtExplicitPrivateInfrastructure(apiBaseUrl, ssoLoginUrl) -> Dns.SYSTEM
            else -> splitBypassDns
        }

    @JvmStatic
    fun publicEmperyWorldDns(): Dns = splitBypassDns

    internal fun splitHorizonSafeDnsForTesting(publicDns: Dns, systemDns: Dns): Dns =
        SplitHorizonSafeDns(splitHosts = SPLIT_HORIZON_HOSTS, publicDns = publicDns, systemDns = systemDns)

    internal fun privateTunnelSplitDnsForTesting(
        systemDns: Dns,
        tunnelEdgeFallback: InetAddress,
    ): Dns =
        PrivateTunnelSplitDns(
            splitHosts = SPLIT_HORIZON_HOSTS,
            systemDns = systemDns,
            tunnelEdgeFallback = tunnelEdgeFallback,
        )

    private fun targetsPublicEmperyWorld(apiBaseUrl: String, ssoLoginUrl: String): Boolean {
        val combined = "${apiBaseUrl.lowercase(Locale.ROOT)} ${ssoLoginUrl.lowercase(Locale.ROOT)}"
        return combined.contains("eliteew.ru") && SPLIT_HORIZON_HOSTS.any { combined.contains(it) }
    }

    private fun pointsAtExplicitPrivateInfrastructure(apiBaseUrl: String, ssoLoginUrl: String): Boolean {
        val combo = "${apiBaseUrl.lowercase(Locale.ROOT)} ${ssoLoginUrl.lowercase(Locale.ROOT)}"
        val markers =
            arrayOf(
                "//127.", "://127.",
                "//localhost", "://localhost",
                "::1",
                "//192.168.", "://192.168.",
                "//10.0.2.2", "://10.0.2.2",
                "//10.", "://10.",
                "//172.", "://172.",
            )
        return markers.any { combo.contains(it) }
    }

    private fun safeLookup(hostname: String, resolver: Dns): List<InetAddress>? =
        try {
            resolver.lookup(hostname).takeIf { it.isNotEmpty() }
        } catch (@Suppress("TooGenericExceptionCaught") _: Exception) {
            null
        }

    private data class SplitHorizonSafeDns(
        private val splitHosts: Set<String>,
        private val publicDns: Dns,
        private val systemDns: Dns,
    ) : Dns {
        override fun lookup(hostname: String): List<InetAddress> {
            val hn = hostname.lowercase(Locale.US)
            if (!splitHosts.contains(hn)) return systemDns.lookup(hostname)
            try {
                val resolved = publicDns.lookup(hostname)
                if (resolved.isNotEmpty()) return resolved
            } catch (@Suppress("TooGenericExceptionCaught") _: Exception) {
                // Prefer system resolver next — may be deliberate split horizon.
            }
            return systemDns.lookup(hostname)
        }
    }

    /**
     * Private tunnel: prefer Android/WireGuard system DNS, but MIUI Private DNS and cold VPN
     * routing can leave split-horizon hosts unresolved — fall back to the tunnel edge IP.
     */
    private data class PrivateTunnelSplitDns(
        private val splitHosts: Set<String>,
        private val systemDns: Dns,
        private val tunnelEdgeFallback: InetAddress,
    ) : Dns {
        override fun lookup(hostname: String): List<InetAddress> {
            val hn = hostname.lowercase(Locale.US)
            val systemResolved =
                try {
                    systemDns.lookup(hostname).takeIf { it.isNotEmpty() }
                } catch (@Suppress("TooGenericExceptionCaught") _: Exception) {
                    null
                }
            if (systemResolved != null) return systemResolved
            if (splitHosts.contains(hn)) return listOf(tunnelEdgeFallback)
            return systemDns.lookup(hostname)
        }
    }
}

