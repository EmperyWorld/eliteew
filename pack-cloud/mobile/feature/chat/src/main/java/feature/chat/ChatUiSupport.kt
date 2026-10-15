/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared compact loading, empty, error, identifier, and timestamp UI support for GAF chat.
 *
 * Invariants:
 * - State surfaces expose merged accessibility descriptions.
 *
 * Related:
 * - ChatFeature.kt, ChatListPane.kt, ChatMessageTimeline.kt
 */
package feature.chat

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import world.empery.mobile.core.ui.PremiumLoadingCard
import world.empery.mobile.core.ui.PremiumStateCard
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
internal fun ChatErrorBanner(
    error: String,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    PremiumStateCard(
        modifier =
            modifier
                .fillMaxWidth()
                .semantics(mergeDescendants = true) {
                    contentDescription = context.getString(R.string.chat_error_cd, error)
                },
        title = stringResource(R.string.chat_error_title),
        message = error,
        icon = Icons.Outlined.ChatBubbleOutline,
        isError = true,
    )
}

@Composable
internal fun EmptyChatsPlaceholder(modifier: Modifier = Modifier) {
    val description = stringResource(R.string.chat_list_empty_cd)
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        PremiumStateCard(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .semantics(mergeDescendants = true) { contentDescription = description },
            title = stringResource(R.string.chat_list_empty_title),
            message = stringResource(R.string.chat_list_empty),
            icon = Icons.Outlined.ChatBubbleOutline,
        )
    }
}

@Composable
internal fun ChatCenterLoading(
    message: String = stringResource(R.string.chat_loading_messages),
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        PremiumLoadingCard(
            message = message,
            modifier =
                Modifier
                    .fillMaxWidth()
                    .semantics(mergeDescendants = true) { contentDescription = message },
        )
    }
}

@Composable
internal fun ChatCenterText(
    text: String,
    contentDescription: String? = null,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .fillMaxSize()
                .then(
                    if (contentDescription == null) {
                        Modifier
                    } else {
                        Modifier.semantics(mergeDescendants = true) {
                            this.contentDescription = contentDescription
                        }
                    },
                ),
        contentAlignment = Alignment.Center,
    ) {
        Text(text = text, style = MaterialTheme.typography.bodyMedium)
    }
}

internal fun shortChatId(chatId: String?): String {
    if (chatId.isNullOrBlank()) return "-"
    val compact = chatId.trim()
    return if (compact.length <= 12) compact else "${compact.take(8)}…${compact.takeLast(4)}"
}

internal fun formatChatMessageTimestamp(raw: String?): String {
    if (raw.isNullOrBlank()) return ""
    return runCatching {
        OffsetDateTime.parse(raw)
            .format(DateTimeFormatter.ofPattern("dd.MM HH:mm", Locale.getDefault()))
    }.getOrElse { raw.take(16) }
}

internal fun isMessageMine(
    message: ChatMessageUi,
    meUserId: String?,
): Boolean =
    message.isPending ||
        (!meUserId.isNullOrBlank() &&
            !message.senderId.isNullOrBlank() &&
            message.senderId == meUserId)
