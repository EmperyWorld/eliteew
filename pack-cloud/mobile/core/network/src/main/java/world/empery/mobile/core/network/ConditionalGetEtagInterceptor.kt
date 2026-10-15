/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * OkHttp application interceptor: Conditional GET (`If-None-Match`) for allowlisted paths.
 * Skips when the request already has `If-None-Match` (explicit Retrofit headers win).
 *
 * Invariants:
 * - GET only; never mutates non-allowlisted traffic.
 * - On 200 stores response ETag; 304 passes through unchanged for Retrofit `Response` + Room reuse.
 *
 * Related:
 * - ETagMemoryStore, NetworkFactory, Friends/Desktop explicit conditional GET
 */
package world.empery.mobile.core.network

import okhttp3.Interceptor
import okhttp3.Response

class ConditionalGetEtagInterceptor(
    private val store: ETagMemoryStore = ETagMemoryStore.shared,
    private val pathAllowlist: List<String> = DEFAULT_ALLOWLIST,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        if (request.method != "GET") {
            return chain.proceed(request)
        }
        val path = request.url.encodedPath
        if (!pathAllowlist.any { path.contains(it) }) {
            return chain.proceed(request)
        }
        if (!request.header(HEADER_IF_NONE_MATCH).isNullOrBlank()) {
            val response = chain.proceed(request)
            rememberEtag(request.url.toString(), response)
            return response
        }
        val cached = store.get(request.url.toString())
        val outbound =
            if (cached.isNullOrBlank()) {
                request
            } else {
                request.newBuilder().header(HEADER_IF_NONE_MATCH, cached).build()
            }
        val response = chain.proceed(outbound)
        rememberEtag(request.url.toString(), response)
        return response
    }

    private fun rememberEtag(urlKey: String, response: Response) {
        if (response.code != 200) return
        val etag = response.header("ETag")?.trim()?.takeIf { it.isNotEmpty() } ?: return
        store.put(urlKey, etag)
    }

    companion object {
        const val HEADER_IF_NONE_MATCH = "If-None-Match"

        val DEFAULT_ALLOWLIST: List<String> =
            listOf(
                "/profile/me",
                "/friends/overview",
            )
    }
}
