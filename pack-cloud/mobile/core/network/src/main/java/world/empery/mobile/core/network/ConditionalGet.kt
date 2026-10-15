package world.empery.mobile.core.network

import retrofit2.HttpException
import retrofit2.Response

/**
 * Applies a conditional GET response: returns cached value on **304**, otherwise parses body and etag.
 *
 * @throws HttpException when the response is neither 304 nor successful.
 * @throws IllegalStateException when **304** is returned but [cached] is null.
 */
fun <T> resolveConditionalGet(
    response: Response<T>,
    cached: T?,
    onEtag: (String?) -> Unit,
): T {
    if (HttpEtagSupport.isNotModified(response)) {
        return cached ?: error("304 Not Modified without cached payload")
    }
    if (!response.isSuccessful) {
        throw HttpException(response)
    }
    onEtag(HttpEtagSupport.parseEtag(response))
    return response.body() ?: error("Empty body for HTTP ${response.code()}")
}
