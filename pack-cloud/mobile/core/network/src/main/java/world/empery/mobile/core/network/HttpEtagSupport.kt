package world.empery.mobile.core.network

import retrofit2.Response

/** Helpers for backend conditional GET (`ETag` / `304 Not Modified`). */
object HttpEtagSupport {
    fun parseEtag(response: Response<*>): String? =
        response.headers()["ETag"]?.trim()?.takeIf { it.isNotEmpty() }

    fun isNotModified(response: Response<*>): Boolean = response.code() == 304
}
