/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Friends tab referral invite card — loads `GET /friends/referral` and opens the system share sheet.
 *
 * Invariants:
 * - Russian user-visible copy via `feature.friends` string resources.
 * - Layout follows [MobileScaleChromePolicy] across COMPACT/STANDARD/COMFORT and font scales.
 *
 * Related:
 * - FriendsReferralInviteSupport.kt, FriendsTabViewModel, DEBT-X-06
 */
package feature.friends

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import world.empery.mobile.core.network.api.FriendReferralInviteResponseDto
import world.empery.mobile.core.ui.PremiumLoadingCard
import world.empery.mobile.core.ui.PremiumSectionCard
import world.empery.mobile.core.ui.ScaledOutlinedButton
import world.empery.mobile.core.ui.rememberMobileScaleChromePolicy

@Composable
internal fun FriendsReferralInviteSection(
    invite: FriendReferralInviteResponseDto?,
    isLoading: Boolean,
    error: String?,
    busy: Boolean,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val chrome = rememberMobileScaleChromePolicy()
    val context = LocalContext.current
    val shareCd = stringResource(R.string.friends_referral_share_cd)
    val sectionCd = stringResource(R.string.friends_referral_section_cd)
    PremiumSectionCard(
        title = stringResource(R.string.friends_referral_title),
        subtitle =
            if (chrome.showSecondarySubtitle) {
                stringResource(R.string.friends_referral_subtitle)
            } else {
                null
            },
        icon = Icons.Outlined.Share,
        modifier = modifier.semantics { contentDescription = sectionCd },
    ) {
        when {
            isLoading && invite == null -> {
                PremiumLoadingCard(
                    message = stringResource(R.string.friends_referral_loading),
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            invite != null -> {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(
                        text =
                            stringResource(
                                R.string.friends_referral_inviter_line,
                                invite.inviter_display_name,
                            ),
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = chrome.maxCaptionLines,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        text = invite.invite_url,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = chrome.maxDescriptionLines,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (error != null) {
                        Text(
                            text = stringResource(R.string.friends_referral_refresh_error, error),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.error,
                            maxLines = chrome.maxMetadataLines,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
            }
            error != null -> {
                Text(
                    text = stringResource(R.string.friends_referral_error, error),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                    maxLines = chrome.maxDescriptionLines,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }

        if (chrome.shouldStackChromeActions) {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                ScaledOutlinedButton(
                    onClick = {
                        invite?.let { dto ->
                            context.launchReferralShareChooser(
                                dto,
                                context.getString(R.string.friends_referral_share_chooser),
                            )
                        }
                    },
                    enabled = invite != null && !busy,
                    label = stringResource(R.string.friends_referral_share),
                    icon = Icons.Outlined.Share,
                    loading = isLoading && invite != null,
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .semantics { contentDescription = shareCd },
                )
                if (error != null || (invite == null && !isLoading)) {
                    TextButton(
                        onClick = onRetry,
                        enabled = !busy && !isLoading,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(stringResource(R.string.friends_referral_retry))
                    }
                }
            }
        } else {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                ScaledOutlinedButton(
                    onClick = {
                        invite?.let { dto ->
                            context.launchReferralShareChooser(
                                dto,
                                context.getString(R.string.friends_referral_share_chooser),
                            )
                        }
                    },
                    enabled = invite != null && !busy,
                    label = stringResource(R.string.friends_referral_share),
                    icon = Icons.Outlined.Share,
                    loading = isLoading && invite != null,
                    modifier =
                        Modifier
                            .weight(1f)
                            .semantics { contentDescription = shareCd },
                )
                if (error != null || (invite == null && !isLoading)) {
                    TextButton(
                        onClick = onRetry,
                        enabled = !busy && !isLoading,
                    ) {
                        Text(stringResource(R.string.friends_referral_retry))
                    }
                }
            }
        }
    }
}
