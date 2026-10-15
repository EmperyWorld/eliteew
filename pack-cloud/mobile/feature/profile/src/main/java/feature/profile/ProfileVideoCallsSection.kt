/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Profile editor for users.preferences.video_calls.call_target (shared write path with web Связи → Телефон).
 *
 * Invariants:
 * - Options: both | desktop_only | mobile_only; PATCH goes to profile/preferences.
 * - Optimistic selection rolls back when [onCallTargetChange] fails (parent restores prior value).
 *
 * Related:
 * - VideoCallTarget, MobileProfileRepository.updateCallTarget, INTERNAL-VIDEO-CALLS.md
 */
package feature.profile

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Videocam
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import world.empery.mobile.core.ui.PremiumRowSurface
import world.empery.mobile.core.ui.PremiumSectionCard

private data class CallTargetOption(
    val value: String,
    val labelRes: Int,
    val hintRes: Int,
)

@Composable
fun ProfileVideoCallsSection(
    callTarget: String,
    saving: Boolean,
    error: String?,
    onCallTargetChange: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val normalized = VideoCallTarget.normalize(callTarget)
    val options =
        listOf(
            CallTargetOption(
                VideoCallTarget.BOTH,
                R.string.profile_call_target_both,
                R.string.profile_call_target_hint_both,
            ),
            CallTargetOption(
                VideoCallTarget.DESKTOP_ONLY,
                R.string.profile_call_target_desktop_only,
                R.string.profile_call_target_hint_desktop_only,
            ),
            CallTargetOption(
                VideoCallTarget.MOBILE_ONLY,
                R.string.profile_call_target_mobile_only,
                R.string.profile_call_target_hint_mobile_only,
            ),
        )
    PremiumSectionCard(
        modifier = modifier.fillMaxWidth(),
        title = stringResource(R.string.profile_call_target_title),
        subtitle = stringResource(R.string.profile_call_target_subtitle),
        icon = Icons.Outlined.Videocam,
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            options.forEach { option ->
                val isSelected = normalized == option.value
                PremiumRowSurface(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .semantics {
                                role = Role.RadioButton
                                selected = isSelected
                            }
                            .clickable(enabled = !saving) {
                                if (!isSelected) onCallTargetChange(option.value)
                            },
                    containerColor =
                        if (isSelected) {
                            MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.72f)
                        } else {
                            null
                        },
                    borderColor =
                        if (isSelected) {
                            MaterialTheme.colorScheme.primary.copy(alpha = 0.4f)
                        } else {
                            null
                        },
                    tonalElevation = if (isSelected) 3.dp else null,
                ) {
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(2.dp),
                    ) {
                        Text(
                            text = stringResource(option.labelRes),
                            fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Medium,
                        )
                        Text(
                            text = stringResource(option.hintRes),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
            if (saving) {
                Text(
                    text = stringResource(R.string.profile_call_target_saving),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (!error.isNullOrBlank()) {
                Text(
                    text = stringResource(R.string.profile_call_target_error, error),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                )
            }
            Text(
                text = stringResource(R.string.profile_call_target_chat_gate_hint),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
