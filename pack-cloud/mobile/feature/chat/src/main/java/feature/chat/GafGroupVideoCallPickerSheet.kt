/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Friend multi-select sheet for starting a GAF group video call from mobile chat.
 *
 * Invariants:
 * - Chat partner is locked in; at least one additional friend must be selected.
 *
 * Related:
 * - MainViewModel.kt, GAFChat group call API, VideoCallParticipantPickerModal (web)
 */
package feature.chat

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

data class GafGroupCallFriendOption(
    val id: String,
    val displayName: String,
    val username: String?,
)

data class GafGroupCallPickerUi(
    val chatId: String,
    val chatPartnerId: String?,
    val chatPartnerName: String,
    val friends: List<GafGroupCallFriendOption>,
    val isLoading: Boolean = false,
    val isSubmitting: Boolean = false,
)

@Composable
fun GafGroupVideoCallPickerSheet(
    state: GafGroupCallPickerUi,
    onDismiss: () -> Unit,
    onConfirm: (List<String>) -> Unit,
) {
    val selected =
        remember(state.chatId, state.friends) {
            mutableStateMapOf<String, Boolean>()
        }
    val additionalSelected =
        state.friends
            .map { it.id }
            .filter { selected[it] == true }
    val canConfirm = additionalSelected.isNotEmpty() && !state.isSubmitting

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(stringResource(R.string.chat_video_call_group_picker_title))
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = stringResource(R.string.chat_video_call_group_picker_body, state.chatPartnerName),
                    style = MaterialTheme.typography.bodyMedium,
                )
                if (state.isLoading) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.Center,
                    ) {
                        CircularProgressIndicator()
                    }
                } else if (state.friends.isEmpty()) {
                    Text(
                        text = stringResource(R.string.chat_video_call_group_picker_empty),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(2.dp),
                    ) {
                        items(state.friends, key = { it.id }) { friend ->
                            val checked = selected[friend.id] == true
                            Row(
                                modifier =
                                    Modifier
                                        .fillMaxWidth()
                                        .clickable {
                                            selected[friend.id] = !checked
                                        }
                                        .padding(vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                Checkbox(
                                    checked = checked,
                                    onCheckedChange = { selected[friend.id] = it },
                                )
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = friend.displayName,
                                        style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Medium),
                                        maxLines = 1,
                                    )
                                    friend.username?.takeIf { it.isNotBlank() }?.let { username ->
                                        Text(
                                            text = "@$username",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                            maxLines = 1,
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onConfirm(additionalSelected) },
                enabled = canConfirm,
            ) {
                Text(stringResource(R.string.chat_video_call_group_picker_confirm))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.chat_video_call_group_picker_cancel))
            }
        },
    )
}
