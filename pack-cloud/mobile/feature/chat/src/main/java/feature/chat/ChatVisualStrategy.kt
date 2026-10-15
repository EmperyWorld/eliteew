/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Strategy tokens for GAF chat message chrome (bubble vs elite structural identity)
 * without duplicating MessageList / MessageItem business logic.
 *
 * Invariants:
 * - [resolve] always returns a complete strategy; unset styles → [EliteChatVisualStrategy].
 * - Elite keeps zero-elevation / no-bubble surfaces; partner + self avatars and thread-line are identity anchors.
 * - Strategy objects are immutable singletons — safe for CompositionLocal and skippable recomposition.
 *
 * Related:
 * - world.empery.mobile.core.ui.ChatVisualStyle, ChatMessageRow, ChatMessageVisualChrome
 */
package feature.chat

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.MaterialTheme
import world.empery.mobile.core.ui.ChatVisualStyle

/**
 * Visual tokens consumed by the single [ChatMessages] composable tree.
 * Business logic (send/reply/edit/attachments) stays outside this type.
 */
interface ChatVisualStrategy {
    val style: ChatVisualStyle

    /** Vertical gap when consecutive messages are grouped (same side). */
    val groupedMessageGap: Dp

    /** Vertical gap when messages are not grouped. */
    val separatedMessageGap: Dp

    /** Horizontal inset for the message list / row. */
    val listHorizontalGutter: Dp

    val listContentPaddingBottom: Dp

    val bubbleHorizontalPadding: Dp
    val bubbleVerticalPadding: Dp

    val showBubbleSurface: Boolean
    val bubbleShadowElevation: Dp
    val bubbleTonalElevationMine: Dp
    val bubbleTonalElevationOther: Dp
    val bubbleBorderWidth: Dp

    val cornerRadiusLarge: Dp
    val cornerRadiusGrouped: Dp
    val cornerRadiusTail: Dp

    val bodyLineHeight: TextUnit
    val bodyFontWeight: FontWeight
    val bodyLetterSpacing: TextUnit
    val showSenderLabel: Boolean
    val senderLabelFontWeight: FontWeight
    val senderLabelLetterSpacing: TextUnit
    val senderLabelBottomPadding: Dp

    val showPartnerAvatar: Boolean
    val avatarSize: Dp
    val avatarRowSpacing: Dp

    /** Elite structural timeline / separators between non-grouped messages. */
    val showStructuralTimeline: Boolean
    val structuralLineWidth: Dp

    /** Alpha for group separators and partner thread-line (Elite identity anchors). */
    val structuralDividerAlpha: Float

    /** Alpha for the vertical thread rail beside partner messages. */
    val threadLineAlpha: Float

    /** Unread divider uses rounded card (Standard) vs flat hairline (Elite). */
    val unreadDividerUsesCard: Boolean

    fun bubbleShape(isMine: Boolean, isGroupedWithPrev: Boolean): Shape =
        RoundedCornerShape(
            topStart = if (isGroupedWithPrev) cornerRadiusGrouped else cornerRadiusLarge,
            topEnd = if (isGroupedWithPrev) cornerRadiusGrouped else cornerRadiusLarge,
            bottomStart = if (isMine) cornerRadiusLarge else cornerRadiusTail,
            bottomEnd = if (isMine) cornerRadiusTail else cornerRadiusLarge,
        )

    @Composable
    @ReadOnlyComposable
    fun bodyTextStyle(): TextStyle =
        MaterialTheme.typography.bodyMedium.copy(
            lineHeight = bodyLineHeight,
            fontWeight = bodyFontWeight,
            letterSpacing = bodyLetterSpacing,
        )

    companion object {
        fun resolve(style: ChatVisualStyle?): ChatVisualStrategy =
            when (style) {
                ChatVisualStyle.ELITE -> EliteChatVisualStrategy
                ChatVisualStyle.STANDARD -> StandardChatVisualStrategy
                null -> EliteChatVisualStrategy
            }
    }
}

/** Current bubble UI — values match pre-strategy ChatFeature hardcoded chrome. */
object StandardChatVisualStrategy : ChatVisualStrategy {
    override val style: ChatVisualStyle = ChatVisualStyle.STANDARD
    override val groupedMessageGap: Dp = 2.dp
    override val separatedMessageGap: Dp = 8.dp
    override val listHorizontalGutter: Dp = 0.dp
    override val listContentPaddingBottom: Dp = 10.dp
    override val bubbleHorizontalPadding: Dp = 14.dp
    override val bubbleVerticalPadding: Dp = 10.dp
    override val showBubbleSurface: Boolean = true
    override val bubbleShadowElevation: Dp = 1.dp
    override val bubbleTonalElevationMine: Dp = 1.dp
    override val bubbleTonalElevationOther: Dp = 2.dp
    override val bubbleBorderWidth: Dp = 1.dp
    override val cornerRadiusLarge: Dp = 22.dp
    override val cornerRadiusGrouped: Dp = 14.dp
    override val cornerRadiusTail: Dp = 8.dp
    override val bodyLineHeight: TextUnit = 22.sp
    override val bodyFontWeight: FontWeight = FontWeight.Normal
    override val bodyLetterSpacing: TextUnit = 0.sp
    override val showSenderLabel: Boolean = false
    override val senderLabelFontWeight: FontWeight = FontWeight.Medium
    override val senderLabelLetterSpacing: TextUnit = 0.sp
    override val senderLabelBottomPadding: Dp = 0.dp
    override val showPartnerAvatar: Boolean = true
    override val avatarSize: Dp = 32.dp
    override val avatarRowSpacing: Dp = 8.dp
    override val showStructuralTimeline: Boolean = false
    override val structuralLineWidth: Dp = 0.dp
    override val structuralDividerAlpha: Float = 0f
    override val threadLineAlpha: Float = 0f
    override val unreadDividerUsesCard: Boolean = true
}

/**
 * Premium-contextual structural look: identity anchors (avatar + bold name + thread rail)
 * without bubble chrome.
 */
object EliteChatVisualStrategy : ChatVisualStrategy {
    override val style: ChatVisualStyle = ChatVisualStyle.ELITE
    override val groupedMessageGap: Dp = 6.dp
    override val separatedMessageGap: Dp = 16.dp
    override val listHorizontalGutter: Dp = 8.dp
    override val listContentPaddingBottom: Dp = 16.dp
    override val bubbleHorizontalPadding: Dp = 2.dp
    override val bubbleVerticalPadding: Dp = 4.dp
    override val showBubbleSurface: Boolean = false
    override val bubbleShadowElevation: Dp = 0.dp
    override val bubbleTonalElevationMine: Dp = 0.dp
    override val bubbleTonalElevationOther: Dp = 0.dp
    override val bubbleBorderWidth: Dp = 0.dp
    override val cornerRadiusLarge: Dp = 2.dp
    override val cornerRadiusGrouped: Dp = 2.dp
    override val cornerRadiusTail: Dp = 2.dp
    override val bodyLineHeight: TextUnit = 24.sp
    override val bodyFontWeight: FontWeight = FontWeight.Medium
    override val bodyLetterSpacing: TextUnit = 0.15.sp
    override val showSenderLabel: Boolean = true
    override val senderLabelFontWeight: FontWeight = FontWeight.Bold
    override val senderLabelLetterSpacing: TextUnit = 0.2.sp
    override val senderLabelBottomPadding: Dp = 4.dp
    override val showPartnerAvatar: Boolean = true
    override val avatarSize: Dp = 28.dp
    override val avatarRowSpacing: Dp = 10.dp
    override val showStructuralTimeline: Boolean = true
    override val structuralLineWidth: Dp = 0.5.dp
    override val structuralDividerAlpha: Float = 0.1f
    override val threadLineAlpha: Float = 0.28f
    override val unreadDividerUsesCard: Boolean = false
}

val LocalChatStyle =
    staticCompositionLocalOf<ChatVisualStrategy> { EliteChatVisualStrategy }
