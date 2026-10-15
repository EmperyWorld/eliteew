/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EWDesk feed Markdown plain-text helpers, collapse heuristics, and overflow-safe rich body composable.
 *
 * Invariants:
 * - Plain-text helpers stay aligned with share/collapse UX in FeedFeature.kt.
 *
 * Related:
 * - FeedFeature.kt, FeedFullPostScreen.kt, EwDeskLinkedMediaUrls.kt
 */
package feature.feed

import android.content.Context
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.halilibo.richtext.markdown.Markdown
import com.halilibo.richtext.markdown.MarkdownParseOptions
import com.halilibo.richtext.ui.material3.Material3RichText
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import world.empery.mobile.core.ui.MobileScaleChromePolicy

/** EWDesk · длинное тело поста переводится в режим «показать полностью». */
internal const val EWDESK_BODY_COLLAPSE_CHARS = 1400

/** EWDesk · много строк маркдауна без переносов — считаем «длинным». */
internal const val EWDESK_BODY_COLLAPSE_LINES = 20

/** EWDesk · длина текстового превью в свёрнутом режиме. */
internal const val EWDESK_BODY_PREVIEW_CHARS = 480

@Composable
internal fun rememberFeedMarkdownParseOptions(): MarkdownParseOptions =
    remember {
        MarkdownParseOptions(
            autolink = true,
        )
    }

/**
 * EWDesk · грубое снятие разметки для превью и SHARE (полный текст в приложении всё так же через Markdown).
 */
internal fun ewDeskMarkdownToPlain(markdown: String): String =
    markdown
        .replace(Regex("(?s)```[\\s\\S]*?```"), "\n")
        .replace(Regex("`+([^`]*)`+"), "$1")
        .replace(Regex("!\\[[^\\]]*\\]\\([^)]*\\)"), " ")
        .replace(Regex("""\[([^\]]+)]\([^)]*\)"""), "$1")
        .replace(Regex("^ {0,3}#{1,6}\\s*", RegexOption.MULTILINE), "")
        .replace(Regex("^ {0,3}>\\s?", RegexOption.MULTILINE), "")
        .replace(Regex("^\\s{0,3}[*+-]\\s+", RegexOption.MULTILINE), "")
        .replace(Regex("^\\s{0,3}\\d+\\.\\s+", RegexOption.MULTILINE), "")
        .replace("*", "")
        .replace("_", "")
        .replace("|", "")
        .replace(Regex("\\s+"), " ")
        .trim()

internal fun ewDeskCollapsedPreviewPlain(
    plain: String,
    previewChars: Int = EWDESK_BODY_PREVIEW_CHARS,
): String =
    plain
        .take(previewChars)
        .trimEnd()
        .let { head ->
            if (plain.length > head.length) "${head.trimEnd()}…" else head
        }

internal fun ewDeskBodyPreviewChars(chrome: MobileScaleChromePolicy): Int =
    when (chrome.maxBodyPreviewLines) {
        2 -> 280
        3 -> 360
        else -> EWDESK_BODY_PREVIEW_CHARS
    }

internal fun shouldCollapseEwDeskBody(
    rewrittenBody: String,
    plainBodyFull: String,
): Boolean {
    if (rewrittenBody.trim().isEmpty()) return false
    val bodyLineCount = rewrittenBody.count { it == '\n' } + 1
    return plainBodyFull.length >= EWDESK_BODY_COLLAPSE_CHARS ||
        bodyLineCount >= EWDESK_BODY_COLLAPSE_LINES
}

internal fun ewDeskHeroAspectRatio(compactLayout: Boolean): Float =
    if (compactLayout) 4f / 3f else 16f / 9f

private fun ewDeskLineFormatter(context: Context): DateTimeFormatter {
    val locale = context.resources.configuration.locales[0]
    return DateTimeFormatter.ofPattern("d MMMM yyyy • HH:mm", locale)
}

internal fun formatEwDeskMetaLine(context: Context, publicationIso: String?, updatedIso: String?): String {
    val parts = mutableListOf<String>()
    val pubFmt =
        publicationIso?.trim()?.takeIf { it.isNotEmpty() }?.let { iso ->
            runCatching { ewDeskLineFormatter(context).format(OffsetDateTime.parse(iso)) }
                .getOrDefault(iso.take(19).replace('T', ' '))
        }
    if (pubFmt != null) parts += context.getString(R.string.feed_meta_published, pubFmt)
    val updIso = updatedIso?.trim()?.takeIf { it.isNotEmpty() }
    val updFmt =
        updIso?.let { iso ->
            runCatching { ewDeskLineFormatter(context).format(OffsetDateTime.parse(iso)) }
                .getOrDefault(iso.take(19).replace('T', ' '))
        }
    if (!updFmt.isNullOrBlank() && updFmt != pubFmt) {
        parts += context.getString(R.string.feed_meta_updated, updFmt)
    }
    return parts.joinToString(" • ")
}

@Composable
internal fun FeedMarkdownBody(
    markdown: String,
    markdownParseOptions: MarkdownParseOptions,
    modifier: Modifier = Modifier,
) {
    Material3RichText(
        modifier =
            modifier
                .fillMaxWidth()
                .padding(top = 2.dp),
    ) {
        Markdown(
            content = markdown,
            markdownParseOptions = markdownParseOptions,
        )
    }
}
