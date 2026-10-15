/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Robolectric Compose coverage for GAF structural sender identity, timeline, state, and motion semantics.
 *
 * Invariants:
 * - Tests use deterministic semantic assertions and no screenshots.
 * - Repository, network, and MainViewModel layers are not mocked into this UI boundary.
 *
 * Related:
 * - ChatMessageTimeline.kt, ChatUiSupport.kt, ChatMotionPolicy.kt
 */
package feature.chat

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.test.core.app.ApplicationProvider
import feature.profile.ProfileAccessibilityPreferences
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import world.empery.mobile.core.storage.ChatEntity

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
class ChatStructuralTimelineComposeTest {
    @get:Rule
    val composeRule = createComposeRule()

    private val context
        get() = ApplicationProvider.getApplicationContext<android.content.Context>()

    @Before
    fun resetMotionPreference() {
        ProfileAccessibilityPreferences.setReduceMotion(context, false)
    }

    @After
    fun clearMotionPreference() {
        ProfileAccessibilityPreferences.setReduceMotion(context, false)
    }

    @Test
    fun eliteTimeline_showsDirectSenderLabelsAndStructuralDivider() {
        val state =
            ChatUiState(
                chats =
                    listOf(
                        ChatEntity(
                            chatId = "chat-1",
                            unreadCount = 0,
                            lastMessagePreview = "Hello",
                            partnerName = "Mira",
                        ),
                    ),
                meUserId = "me",
                selectedChatId = "chat-1",
                selectedChatMessages =
                    listOf(
                        ChatMessageUi(
                            id = "message-1",
                            senderId = "partner",
                            body = "Hello",
                            createdAt = "2026-07-15T01:00:00Z",
                        ),
                        ChatMessageUi(
                            id = "message-2",
                            senderId = "me",
                            body = "Welcome",
                            createdAt = "2026-07-15T01:01:00Z",
                        ),
                    ),
            )

        composeRule.setContent {
            MaterialTheme {
                CompositionLocalProvider(LocalChatStyle provides EliteChatVisualStrategy) {
                    ChatMessageTimeline(
                        state = state,
                        draft = "",
                        attachments = emptyList(),
                        actions = noOpThreadActions(),
                    )
                }
            }
        }

        composeRule.onNodeWithText("Mira").fetchSemanticsNode()
        composeRule.onNodeWithText(context.getString(R.string.chat_sender_you)).fetchSemanticsNode()
        composeRule.onNodeWithText("Hello").fetchSemanticsNode()
        composeRule.onNodeWithText("Welcome").fetchSemanticsNode()
        composeRule.onNodeWithTag(CHAT_TIMELINE_TAG, useUnmergedTree = true).fetchSemanticsNode()
        assertTrue(
            composeRule
                .onAllNodesWithTag(
                    CHAT_PARTNER_AVATAR_TAG,
                    useUnmergedTree = true,
                )
                .fetchSemanticsNodes()
                .isNotEmpty(),
        )
        assertTrue(
            composeRule
                .onAllNodesWithTag(
                    CHAT_SELF_AVATAR_TAG,
                    useUnmergedTree = true,
                )
                .fetchSemanticsNodes()
                .isNotEmpty(),
        )
        assertTrue(
            composeRule
                .onAllNodesWithTag(
                    CHAT_STRUCTURAL_TIMELINE_TAG,
                    useUnmergedTree = true,
                )
                .fetchSemanticsNodes()
                .isNotEmpty(),
        )
        assertTrue(
            composeRule
                .onAllNodesWithTag(
                    CHAT_STRUCTURAL_GROUP_DIVIDER_TAG,
                    useUnmergedTree = true,
                )
                .fetchSemanticsNodes()
                .isNotEmpty(),
        )
    }

    @Test
    fun timelineEmptyState_exposesAccessibleMeaning() {
        composeRule.setContent {
            MaterialTheme {
                ChatMessageTimeline(
                    state = ChatUiState(selectedChatId = "chat-empty"),
                    draft = "",
                    attachments = emptyList(),
                    actions = noOpThreadActions(),
                )
            }
        }

        composeRule
            .onNodeWithContentDescription(
                context.getString(R.string.chat_messages_empty_cd),
            )
            .fetchSemanticsNode()
        composeRule
            .onNodeWithText(context.getString(R.string.chat_messages_empty_title))
            .fetchSemanticsNode()
        composeRule
            .onNodeWithText(context.getString(R.string.chat_messages_empty))
            .fetchSemanticsNode()
        composeRule
            .onNodeWithTag(CHAT_COMPOSER_TAG, useUnmergedTree = true)
            .fetchSemanticsNode()
    }

    @Test
    fun timelineEmptyState_withPartner_usesPartnerAwareCopy() {
        composeRule.setContent {
            MaterialTheme {
                ChatMessageTimeline(
                    state =
                        ChatUiState(
                            selectedChatId = "chat-empty",
                            chats =
                                listOf(
                                    ChatEntity(
                                        chatId = "chat-empty",
                                        unreadCount = 0,
                                        lastMessagePreview = null,
                                        partnerName = "Mira",
                                    ),
                                ),
                        ),
                    draft = "",
                    attachments = emptyList(),
                    actions = noOpThreadActions(),
                )
            }
        }

        composeRule
            .onNodeWithText(context.getString(R.string.chat_messages_empty_with_partner, "Mira"))
            .fetchSemanticsNode()
        composeRule
            .onNodeWithContentDescription(
                context.getString(R.string.chat_messages_empty_with_partner_cd, "Mira"),
            )
            .fetchSemanticsNode()
        composeRule
            .onNodeWithText(context.getString(R.string.chat_messages_empty))
            .fetchSemanticsNode()
    }

    @Test
    fun timelineLoading_keepsComposerAndShowsSkeleton() {
        composeRule.setContent {
            MaterialTheme {
                ChatMessageTimeline(
                    state =
                        ChatUiState(
                            selectedChatId = "chat-loading",
                            isMessagesLoading = true,
                        ),
                    draft = "",
                    attachments = emptyList(),
                    actions = noOpThreadActions(),
                )
            }
        }

        composeRule
            .onNodeWithTag(CHAT_THREAD_LOADING_TAG, useUnmergedTree = true)
            .fetchSemanticsNode()
        composeRule
            .onNodeWithTag(CHAT_COMPOSER_TAG, useUnmergedTree = true)
            .fetchSemanticsNode()
        composeRule
            .onNodeWithContentDescription(
                context.getString(R.string.chat_loading_messages),
            )
            .fetchSemanticsNode()
    }

    @Test
    fun errorBanner_exposesErrorTextAndDescription() {
        composeRule.setContent {
            MaterialTheme {
                ChatErrorBanner(error = "Network unavailable")
            }
        }

        composeRule.onNodeWithText("Network unavailable").fetchSemanticsNode()
        composeRule
            .onNodeWithContentDescription(
                context.getString(R.string.chat_error_cd, "Network unavailable"),
            )
            .assertContentDescriptionEquals(
                context.getString(R.string.chat_error_cd, "Network unavailable"),
            )
    }

    @Test
    fun profileReduceMotion_isReflectedInTimelineSemantics() {
        ProfileAccessibilityPreferences.setReduceMotion(context, true)
        composeRule.setContent {
            MaterialTheme {
                ChatMessageTimeline(
                    state = ChatUiState(selectedChatId = "chat-motion"),
                    draft = "",
                    attachments = emptyList(),
                    actions = noOpThreadActions(),
                )
            }
        }

        val timeline =
            composeRule
                .onNodeWithTag(CHAT_TIMELINE_TAG, useUnmergedTree = true)
                .fetchSemanticsNode()
        assertEquals(
            context.getString(R.string.chat_motion_reduced_cd),
            timeline.config[SemanticsProperties.StateDescription],
        )
    }
}

private fun noOpThreadActions(): ChatThreadActions =
    ChatThreadActions(
        onPickImage = {},
        onPickFile = {},
        onRemoveAttachment = {},
        onDraftChange = {},
        onSend = {},
        onLoadOlderMessages = {},
        onRetryMessage = {},
        onCancelMessage = {},
        onStartReply = {},
        onCancelReply = {},
        onStartEdit = {},
        onCancelEdit = {},
        onDeleteMessage = {},
        onOpenAttachment = { _, _, _ -> },
        onDownloadAttachment = { _, _, _ -> },
        onLoadAttachmentPreview = { _, _, _ -> },
        onScheduleImagePreviewPreloads = {},
        onProposeChatE2ee = {},
        onAcceptChatE2ee = {},
        onDeclineChatE2ee = {},
        onDisableChatE2ee = {},
    )
