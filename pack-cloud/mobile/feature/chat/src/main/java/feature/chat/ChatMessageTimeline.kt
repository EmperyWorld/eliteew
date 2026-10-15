/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Keyed chronological GAF message timeline, unread boundary, structural dividers, and auto-scroll.
 *
 * Invariants:
 * - One LazyColumn serves Standard and Elite visual strategies.
 * - Stable message ids key rows; automatic positioning uses scrollToItem.
 * - Reduced motion disables item, content-size, and spacing transitions together.
 * - Initial load keeps the composer mounted; empty thread is partner-aware.
 *
 * Related:
 * - ChatMessageRow.kt, ChatComposerDock.kt, ChatMotionPolicy.kt
 */
package feature.chat

import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.FiniteAnimationSpec
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.snap
import androidx.compose.animation.core.spring
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.ExpandLess
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import world.empery.mobile.core.ui.LocalMobileWindowLayout
import world.empery.mobile.core.ui.MobileLoadingSkeleton
import world.empery.mobile.core.ui.MobileLoadingSkeletonVariant
import world.empery.mobile.core.ui.PremiumStateCard
import world.empery.mobile.core.ui.ScaledOutlinedButton
import world.empery.mobile.core.ui.rememberMobileScaleChromePolicy
import world.empery.mobile.core.ui.shouldStackChromeActions

internal const val CHAT_STRUCTURAL_TIMELINE_TAG = "gaf_chat_structural_timeline"
internal const val CHAT_STRUCTURAL_GROUP_DIVIDER_TAG = "gaf_chat_structural_group_divider"
internal const val CHAT_TIMELINE_TAG = "gaf_chat_timeline"
internal const val CHAT_THREAD_LOADING_TAG = "gaf_chat_thread_loading"
internal const val CHAT_PARTNER_AVATAR_TAG = "gaf_chat_partner_avatar"
internal const val CHAT_SELF_AVATAR_TAG = "gaf_chat_self_avatar"

@Composable
internal fun ChatMessageTimeline(
    state: ChatUiState,
    draft: String,
    attachments: List<ChatAttachmentDraft>,
    actions: ChatThreadActions,
    meDisplayName: String? = null,
    meAvatarUrl: String? = null,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val windowLayout = LocalMobileWindowLayout.current
    val chrome = rememberMobileScaleChromePolicy()
    val visual = LocalChatStyle.current
    val motion = rememberChatMotionPolicy()
    val gapSpec: FiniteAnimationSpec<Dp> =
        if (motion.animateGaps) spring() else snap()
    val groupedGap by
        animateDpAsState(
            targetValue = visual.groupedMessageGap,
            animationSpec = gapSpec,
            label = "chat_grouped_gap",
        )
    val separatedGap by
        animateDpAsState(
            targetValue = visual.separatedMessageGap,
            animationSpec = gapSpec,
            label = "chat_separated_gap",
        )
    val listGutter by
        animateDpAsState(
            targetValue = visual.listHorizontalGutter,
            animationSpec = gapSpec,
            label = "chat_list_gutter",
        )
    val listBottomPadding by
        animateDpAsState(
            targetValue = visual.listContentPaddingBottom,
            animationSpec = gapSpec,
            label = "chat_list_bottom",
        )
    val bubbleMaxWidth =
        resolveGafChatBubbleMaxWidthDp(
            threadMaxWidthDp = windowLayout.chatThreadMaxWidthDp,
            shouldStackChromeActions = chrome.shouldStackChromeActions,
        )
    val messages = state.selectedChatMessages
    val loadOlderHeaderCount = if (state.hasMoreMessages) 1 else 0
    val unreadDividerIndex =
        remember(state.selectedChatUnreadBeforeOpen, messages.size) {
            state.selectedChatUnreadBeforeOpen
                .takeIf { it > 0 && it < messages.size }
                ?.let { messages.size - it }
                ?: -1
        }
    val listState = remember(state.selectedChatId) { LazyListState() }
    val messageById = remember(messages) { messages.associateBy { it.id } }
    val messageIndexById =
        remember(messages) {
            messages.withIndex().associate { it.value.id to it.index }
        }
    val selectedChat = state.chats.find { it.chatId == state.selectedChatId }

    val attachmentWarmupSignature =
        remember(
            messages.size,
            messages.firstOrNull()?.id,
            messages.lastOrNull()?.id,
            state.attachmentPreviewUris.size,
        ) {
            var hash = 1
            messages.forEach { message -> hash = 31 * hash + message.id.hashCode() }
            "${messages.size}|$hash|${state.attachmentPreviewUris.size}"
        }
    LaunchedEffect(state.selectedChatId, attachmentWarmupSignature) {
        if (!state.selectedChatId.isNullOrBlank() && messages.isNotEmpty()) {
            actions.onScheduleImagePreviewPreloads()
        }
    }
    LaunchedEffect(state.selectedChatId, messages.size, state.hasMoreMessages) {
        if (messages.isNotEmpty()) {
            delay(32)
            listState.scrollToItem(loadOlderHeaderCount + messages.size - 1)
        }
    }
    LaunchedEffect(
        messages.lastOrNull()?.id,
        messages.size,
        state.isLoadingOlderMessages,
        state.isMessagesLoading,
    ) {
        if (
            !state.isMessagesLoading &&
            !state.isLoadingOlderMessages &&
            messages.isNotEmpty()
        ) {
            delay(32)
            val totalItems = listState.layoutInfo.totalItemsCount
            if (totalItems > 0) {
                val lastIndex = totalItems - 1
                val lastVisible =
                    listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: -1
                if (lastVisible == -1 || lastVisible >= lastIndex - 2) {
                    listState.scrollToItem(lastIndex)
                }
            }
        }
    }

    Column(
        modifier =
            modifier
                .fillMaxSize()
                .testTag(CHAT_TIMELINE_TAG)
                .semantics {
                    stateDescription =
                        context.getString(
                            if (motion.reduceMotion) {
                                R.string.chat_motion_reduced_cd
                            } else {
                                R.string.chat_motion_standard_cd
                            },
                        )
                },
    ) {
        when {
            state.isMessagesLoading && messages.isEmpty() -> {
                MobileLoadingSkeleton(
                    message = stringResource(R.string.chat_loading_messages),
                    variant = MobileLoadingSkeletonVariant.LIST,
                    modifier =
                        Modifier
                            .weight(1f)
                            .fillMaxWidth()
                            .testTag(CHAT_THREAD_LOADING_TAG),
                )
            }
            messages.isEmpty() -> {
                val partnerLabel =
                    selectedChat
                        ?.partnerName
                        ?.takeIf { it.isNotBlank() }
                val emptyTitle =
                    partnerLabel?.let {
                        stringResource(R.string.chat_messages_empty_with_partner, it)
                    } ?: stringResource(R.string.chat_messages_empty_title)
                val emptyCd =
                    partnerLabel?.let {
                        context.getString(R.string.chat_messages_empty_with_partner_cd, it)
                    } ?: context.getString(R.string.chat_messages_empty_cd)
                PremiumStateCard(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .weight(1f)
                            .padding(vertical = 8.dp)
                            .semantics(mergeDescendants = true) {
                                contentDescription = emptyCd
                            },
                    title = emptyTitle,
                    message = stringResource(R.string.chat_messages_empty),
                    icon = Icons.Outlined.ChatBubbleOutline,
                )
            }
            else -> {
                LazyColumn(
                    modifier =
                        Modifier
                            .weight(1f)
                            .fillMaxWidth()
                            .padding(horizontal = listGutter)
                            .then(
                                if (motion.animateContent) {
                                    Modifier.animateContentSize()
                                } else {
                                    Modifier
                                },
                            ),
                    state = listState,
                    contentPadding = PaddingValues(bottom = listBottomPadding),
                ) {
                    if (state.hasMoreMessages) {
                        item(key = "chat_load_older", contentType = "chat_load_older") {
                            Row(
                                modifier =
                                    Modifier
                                        .fillMaxWidth()
                                        .padding(top = 4.dp, bottom = 8.dp),
                                horizontalArrangement = Arrangement.Center,
                            ) {
                                ScaledOutlinedButton(
                                    onClick = actions.onLoadOlderMessages,
                                    enabled = !state.isLoadingOlderMessages,
                                    label = stringResource(R.string.chat_load_older),
                                    icon = Icons.Outlined.ExpandLess,
                                    loading = state.isLoadingOlderMessages,
                                )
                            }
                        }
                    }
                    items(
                        items = messages,
                        key = { it.id },
                        contentType = { "chat_message_row" },
                    ) { message ->
                        val index = messageIndexById[message.id] ?: 0
                        val isSystemMessage =
                            isGafSystemCenteredMessage(message.systemPresentation)
                        val isMine = isMessageMine(message, state.meUserId)
                        val previousMessage = messages.getOrNull(index - 1)
                        val groupedWithPrevious =
                            previousMessage != null &&
                                !previousMessage.isDeleted &&
                                !message.isDeleted &&
                                when {
                                    isSystemMessage ||
                                        isGafSystemCenteredMessage(
                                            previousMessage.systemPresentation,
                                        ) ->
                                        isSystemMessage &&
                                            isGafSystemCenteredMessage(
                                                previousMessage.systemPresentation,
                                            )
                                    else ->
                                        isMessageMine(previousMessage, state.meUserId) == isMine
                                }
                        val itemModifier =
                            if (motion.animateItems) Modifier.animateItem() else Modifier
                        Column(
                            modifier =
                                itemModifier
                                    .fillMaxWidth()
                                    .padding(
                                        top =
                                            when {
                                                index == 0 -> 0.dp
                                                groupedWithPrevious -> groupedGap
                                                else -> separatedGap
                                            },
                                    ),
                            horizontalAlignment =
                                when {
                                    isSystemMessage -> Alignment.CenterHorizontally
                                    isMine -> Alignment.End
                                    else -> Alignment.Start
                                },
                        ) {
                            if (index == unreadDividerIndex) {
                                ChatUnreadDivider(visual = visual)
                            }
                            if (
                                visual.showStructuralTimeline &&
                                !isSystemMessage &&
                                index > 0 &&
                                !groupedWithPrevious
                            ) {
                                HorizontalDivider(
                                    modifier =
                                        Modifier
                                            .fillMaxWidth()
                                            .padding(bottom = 10.dp)
                                            .testTag(CHAT_STRUCTURAL_GROUP_DIVIDER_TAG),
                                    thickness = visual.structuralLineWidth,
                                    color =
                                        MaterialTheme.colorScheme.onSurface.copy(
                                            alpha = visual.structuralDividerAlpha,
                                        ),
                                )
                            }
                            if (isSystemMessage && message.systemPresentation != null) {
                                GafChatSystemMessageRow(
                                    presentation = message.systemPresentation,
                                    fallbackBody = message.body,
                                    createdAt = message.createdAt,
                                )
                            } else {
                                ChatMessageRow(
                                    message = message,
                                    repliedMessage =
                                        message.replyToMessageId?.let(messageById::get),
                                    visual = visual,
                                    isMine = isMine,
                                    isGroupedWithPrevious = groupedWithPrevious,
                                    isReadByPartner =
                                        isMine &&
                                            message.id ==
                                            state.selectedChatPartnerLastReadMessageId,
                                    selectedChatId = state.selectedChatId,
                                    partnerName = selectedChat?.partnerName,
                                    partnerAvatarUrl = selectedChat?.partnerAvatarUrl,
                                    partnerIsSystemAccount =
                                        selectedChat?.isSystemAccount == true,
                                    meDisplayName = meDisplayName,
                                    meAvatarUrl = meAvatarUrl,
                                    bubbleMaxWidth = bubbleMaxWidth,
                                    previewUri = state.attachmentPreviewUris[message.id],
                                    attachmentLoading =
                                        state.attachmentLoadingIds.contains(message.id),
                                    onJumpToReply = {
                                        message.replyToMessageId
                                            ?.let(messageIndexById::get)
                                            ?.let { targetIndex ->
                                                scope.launch {
                                                    listState.scrollToItem(
                                                        loadOlderHeaderCount + targetIndex,
                                                    )
                                                }
                                            }
                                    },
                                    actions = actions,
                                    modifier =
                                        Modifier.align(
                                            if (isMine) Alignment.End else Alignment.Start,
                                        ),
                                )
                            }
                        }
                    }
                }
            }
        }
        ChatComposerDock(
            state = state,
            draft = draft,
            attachments = attachments,
            messageById = messageById,
            visual = visual,
            motion = motion,
            actions = actions,
        )
    }
}

@Composable
private fun ChatUnreadDivider(visual: ChatVisualStrategy) {
    val context = LocalContext.current
    if (visual.unreadDividerUsesCard) {
        Surface(
            modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
            color = MaterialTheme.colorScheme.tertiaryContainer.copy(alpha = 0.88f),
            shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
        ) {
            Text(
                text = stringResource(R.string.chat_new_messages_divider),
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 6.dp)
                        .semantics {
                            contentDescription =
                                context.getString(R.string.chat_new_messages_divider_cd)
                        },
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onTertiaryContainer,
                textAlign = TextAlign.Center,
            )
        }
    } else {
        Row(
            modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            HorizontalDivider(
                modifier = Modifier.weight(1f),
                thickness = visual.structuralLineWidth,
            )
            Text(
                text = stringResource(R.string.chat_new_messages_divider),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier =
                    Modifier.semantics {
                        contentDescription =
                            context.getString(R.string.chat_new_messages_divider_cd)
                    },
            )
            HorizontalDivider(
                modifier = Modifier.weight(1f),
                thickness = visual.structuralLineWidth,
            )
        }
    }
}
