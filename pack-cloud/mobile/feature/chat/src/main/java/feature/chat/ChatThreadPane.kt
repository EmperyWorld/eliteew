/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Single GAF thread pane that composes E2EE consent, message timeline, and composer.
 *
 * Invariants:
 * - Both compact and master-detail shells use this same thread tree.
 * - Loading never unmounts the composer; timeline owns skeleton vs messages.
 * - E2EE consent callbacks remain owned by MainViewModel.
 *
 * Related:
 * - ChatFeature.kt, ChatMessageTimeline.kt, GafChatE2eeCoordinator.kt
 */
package feature.chat

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import world.empery.mobile.core.ui.PremiumGlassCard

@Composable
internal fun ChatThreadPane(
    state: ChatUiState,
    draft: String,
    attachments: List<ChatAttachmentDraft>,
    actions: ChatThreadActions,
    meDisplayName: String? = null,
    meAvatarUrl: String? = null,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxSize()) {
        GafE2eeConsentBar(
            consent = state.e2eeConsent,
            meUserId = state.meUserId,
            onPropose = actions.onProposeChatE2ee,
            onAccept = actions.onAcceptChatE2ee,
            onDecline = actions.onDeclineChatE2ee,
            onDisable = actions.onDisableChatE2ee,
            modifier = Modifier.padding(bottom = 4.dp),
        )
        ChatMessageTimeline(
            state = state,
            draft = draft,
            attachments = attachments,
            actions = actions,
            meDisplayName = meDisplayName,
            meAvatarUrl = meAvatarUrl,
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxWidth(),
        )
    }
}

@Composable
private fun GafE2eeConsentBar(
    consent: GafE2eeConsentUi,
    meUserId: String?,
    onPropose: () -> Unit,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
    onDisable: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (consent.chatId.isNullOrBlank()) return
    val requestedByMe =
        meUserId != null &&
            consent.requestedByUserId != null &&
            consent.requestedByUserId == meUserId
    val canRequest = consent.ready && (consent.status == "off" || consent.status == "declined")
    val canAnswer = consent.ready && consent.status == "pending" && !requestedByMe
    val canDisable = consent.status == "active"
    if (!canRequest && !canAnswer && !canDisable && consent.ready) return
    val message =
        when {
            !consent.ready -> stringResource(R.string.chat_e2ee_consent_unavailable_body)
            consent.status == "active" -> stringResource(R.string.chat_e2ee_consent_active)
            consent.status == "pending" && requestedByMe ->
                stringResource(R.string.chat_e2ee_consent_pending_mine)
            consent.status == "pending" ->
                stringResource(R.string.chat_e2ee_consent_pending_partner)
            else -> stringResource(R.string.chat_e2ee_consent_plain)
        }
    PremiumGlassCard(modifier = modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    Icons.Outlined.Lock,
                    contentDescription = stringResource(R.string.chat_e2ee_secure_mode_cd),
                    modifier = Modifier.size(20.dp),
                    tint = MaterialTheme.colorScheme.primary,
                )
                Column(modifier = Modifier.weight(1f)) {
                    if (!consent.ready) {
                        Text(
                            text = stringResource(R.string.chat_e2ee_consent_unavailable_title),
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                    Text(
                        text = message,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            if (canRequest || canAnswer || canDisable) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    if (canRequest) {
                        TextButton(onClick = onPropose, enabled = !consent.busy) {
                            Text(stringResource(R.string.chat_e2ee_action_request))
                        }
                    }
                    if (canAnswer) {
                        TextButton(onClick = onAccept, enabled = !consent.busy) {
                            Text(stringResource(R.string.chat_e2ee_action_accept))
                        }
                        TextButton(onClick = onDecline, enabled = !consent.busy) {
                            Text(stringResource(R.string.chat_e2ee_action_decline))
                        }
                    }
                    if (canDisable) {
                        TextButton(onClick = onDisable, enabled = !consent.busy) {
                            Text(stringResource(R.string.chat_e2ee_action_disable))
                        }
                    }
                }
            }
        }
    }
}
