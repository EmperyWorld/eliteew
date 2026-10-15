package world.empery.mobile.core.network

/**
 * EWDesk news-linked media URLs and Markdown asset resolution.
 *
 * [normalizeApiBase] must match Retrofit ``baseUrl`` (typically ending with `/api/v1/`).
 */
object EwDeskLinkedMediaUrls {

    fun normalizeApiBase(base: String): String {
        val t = base.trim().trimEnd('/')
        require(t.startsWith("http://") || t.startsWith("https://")) {
            "api base must start with http:// or https://"
        }
        return "$t/"
    }

    fun linkedImage(apiBase: String, contentUuid: String): String =
        "${normalizeApiBase(apiBase)}product-desktop/news-linked-image/$contentUuid"

    fun linkedVideo(apiBase: String, contentUuid: String): String =
        "${normalizeApiBase(apiBase)}product-desktop/news-linked-video/$contentUuid"

    fun linkedAudio(apiBase: String, contentUuid: String): String =
        "${normalizeApiBase(apiBase)}product-desktop/news-linked-audio/$contentUuid"

    /**
     * Coil / media layer URL for the post hero visual.
     *
     * API allows either an external CDN URL (`image_url`) or a guarded stream via `image_content_id`.
     */
    fun heroImageLoadUrl(remoteImageUrl: String?, apiBase: String, imageContentUuid: String?): String? {
        if (!remoteImageUrl.isNullOrBlank()) {
            val r = remoteImageUrl.trim()
            return rewriteMarkdownAssetDestination(r, apiBase) ?: r
        }
        if (!imageContentUuid.isNullOrBlank()) {
            return linkedImage(apiBase, imageContentUuid.trim())
        }
        return null
    }

    /** True when [destination] is already usable as-is (never rewrite). */
    private fun isPassthrough(destination: String): Boolean {
        val d = destination.trim()
        if (d.startsWith('#')) return true
        if (d.startsWith("mailto:", ignoreCase = true)) return true
        if (d.startsWith("tel:", ignoreCase = true)) return true
        if (d.startsWith("data:", ignoreCase = true)) return true
        if (d.startsWith("/__eliteew-desktop-open-app__/")) return true
        return false
    }

    /** Resolves avatar/icon paths for Coil with OkHttp auth (relative `/api/...` → absolute). */
    fun resolveApiMediaUrl(apiBase: String, rawUrl: String?): String? {
        val trimmed = rawUrl?.trim()?.takeIf { it.isNotBlank() } ?: return null
        if (trimmed.startsWith("http://", ignoreCase = true) || trimmed.startsWith("https://", ignoreCase = true)) {
            return trimmed
        }
        if (trimmed.startsWith("/")) {
            return MobileWebOrigin.fromApiBase(apiBase) + trimmed
        }
        return rewriteMarkdownAssetDestination(trimmed, apiBase) ?: trimmed
    }

    /** Same rules as Markdown image/link rewriting (returns null → keep original substring). */
    fun rewriteMarkdownAssetDestination(destination: String, apiBase: String): String? {
        val d = destination.trim()
        if (d.isEmpty()) return null
        if (isPassthrough(d)) return null

        when {
            d.startsWith("//") -> return "https:$d"

            d.startsWith("http://", ignoreCase = true) || d.startsWith("https://", ignoreCase = true) ->
                return null

            d.startsWith('/') -> return normalizeApiBase(apiBase).trimEnd('/') + d

            else ->
                return normalizeApiBase(apiBase) + d.trimStart('/')
        }
    }

    /** Rewrites `![alt](url)` and `[text](url)` targets that need an API-root prefix for OkHttp-auth loading. */
    fun rewriteEwDeskMarkdownAssetUrls(markdown: String, apiBase: String): String {
        if (markdown.isBlank()) return markdown
        val out = StringBuilder(markdown.length + 32)
        var i = 0
        val s = markdown
        while (i < s.length) {
            val linkStartText = s.indexOf('[', i)
            val bangImg = s.indexOf("![", i)
            val start =
                when {
                    linkStartText >= 0 && bangImg >= 0 -> kotlin.math.min(linkStartText, bangImg)
                    linkStartText >= 0 -> linkStartText
                    bangImg >= 0 -> bangImg
                    else -> -1
                }
            if (start < 0) {
                out.append(s.substring(i))
                break
            }
            out.append(s.substring(i, start))
            if (start > 0 && s[start - 1] == '\\') {
                out.append(s[start])
                i = start + 1
                continue
            }
            val img = bangImg == start
            val openBracketIdx = start + (if (img) 2 else 1)

            val closeBracket = scanClosingBracket(s, openBracketIdx)
            if (closeBracket < 0 || closeBracket + 1 >= s.length || s[closeBracket + 1] != '(') {
                out.append(s[start])
                i = start + 1
                continue
            }
            val openParen = closeBracket + 1
            val closeParen = scanClosingParen(s, openParen + 1)
            if (closeParen < 0) {
                out.append(s.substring(start))
                break
            }
            val innerUrl = s.substring(openParen + 1, closeParen).substringBefore(' ').trim()
            val rew = rewriteMarkdownAssetDestination(innerUrl, apiBase) ?: innerUrl
            val segment =
                buildString(closeParen - start + 16) {
                    append(s.substring(start, openParen + 1))
                    append(rew)
                    append(s.substring(closeParen))
                }
            out.append(segment)
            i = closeParen + 1
        }
        return out.toString()
    }

    private fun scanClosingBracket(src: String, from: Int): Int {
        var depth = 1
        var j = from
        while (j < src.length) {
            val c = src[j]
            if (c == '\\' && j + 1 < src.length) {
                j += 2
                continue
            }
            when (c) {
                '[' -> depth++
                ']' -> {
                    depth--
                    if (depth == 0) return j
                }
            }
            j++
        }
        return -1
    }

    private fun scanClosingParen(src: String, from: Int): Int {
        var depth = 1
        var j = from
        while (j < src.length) {
            val c = src[j]
            if (c == '\\' && j + 1 < src.length) {
                j += 2
                continue
            }
            when (c) {
                '(' -> depth++
                ')' -> {
                    depth--
                    if (depth == 0) return j
                }
            }
            j++
        }
        return -1
    }
}
