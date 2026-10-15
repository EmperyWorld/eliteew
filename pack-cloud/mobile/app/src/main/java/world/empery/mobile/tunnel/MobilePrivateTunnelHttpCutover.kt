/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Hard-cutover helper for session OkHttp clients when the private tunnel flaps.
 *
 * Invariants:
 * - Callers must pass only session/authenticated clients — never authBootstrapRetrofit's client.
 * - cancelAll then evictAll: drop in-flight zombies before idle pool reuse.
 *
 * Related:
 * - AppContainer, MobilePrivateTunnelRecoveryPolicy
 */
package world.empery.mobile.tunnel

import okhttp3.OkHttpClient

object MobilePrivateTunnelHttpCutover {
    fun applyToSessionClients(clients: Iterable<OkHttpClient>) {
        for (client in clients) {
            runCatching { client.dispatcher.cancelAll() }
            runCatching { client.connectionPool.evictAll() }
        }
    }
}
