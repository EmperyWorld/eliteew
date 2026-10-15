/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Full-screen friend detail with notes, circles, timeline, and shared-content parity with desktop Social Hub.
 *
 * Invariants:
 * - Shared-content rows are read-only summaries from Social Hub API.
 *
 * Related:
 * - FriendDetailSharedSections.kt, FriendsFeature.kt
 */
package feature.friends

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import world.empery.mobile.core.ui.MobileAvatarPlaceholder
import world.empery.mobile.core.ui.mobileAvatarInitials
import world.empery.mobile.core.network.api.FriendCircleItemDto
import world.empery.mobile.core.network.api.SocialHubSharedContentItemDto
import world.empery.mobile.core.ui.MobileAdaptiveContent
import world.empery.mobile.core.ui.PremiumGlassCard
import world.empery.mobile.core.ui.PremiumLoadingCard
import world.empery.mobile.core.ui.rememberMobileScaleChromePolicy

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FriendDetailScreen(
    friend: FriendLiteItem,
    state: FriendsUiState,
    circles: List<FriendCircleItemDto>,
    noteDraft: String,
    onNoteDraftChange: (String) -> Unit,
    detailCircleIds: Set<String>,
    onDetailCircleToggle: (String, Boolean) -> Unit,
    sharedContent: List<SocialHubSharedContentItemDto>,
    isSharedContentLoading: Boolean,
    sharedContentError: String?,
    onLoadSharedContent: (String) -> Unit,
    onRetrySharedContent: () -> Unit,
    onSave: () -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val displayName = friend.fullName ?: friend.username ?: friend.id
    val chrome = rememberMobileScaleChromePolicy()
    var scrollToShared by remember(friend.id) { mutableStateOf(false) }
    val scrollState = rememberScrollState()

    LaunchedEffect(friend.id) {
        onLoadSharedContent(friend.id)
    }

    LaunchedEffect(scrollToShared) {
        if (scrollToShared) {
            scrollState.scrollTo(scrollState.maxValue.coerceAtLeast(0))
            scrollToShared = false
        }
    }

    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = stringResource(R.string.friends_detail_screen_title),
                        maxLines = chrome.maxHeroTitleLines,
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.friends_detail_back_cd))
                    }
                },
            )
        },
    ) { inner ->
        MobileAdaptiveContent(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(inner),
        ) {
            Column(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .verticalScroll(scrollState)
                        .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                PremiumGlassCard(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        MobileAvatarPlaceholder(
                            initials = mobileAvatarInitials(displayName, friend.username),
                            imageUrl = friend.avatarUrl,
                            contentDescription = displayName,
                            modifier = Modifier.size(if (chrome.shouldStackChromeActions) 64.dp else 72.dp),
                        )
                        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(displayName, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                            FriendRelationshipChips(chips = friend.relationshipChips())
                        }
                    }
                }

                FriendDetailRelationshipActionCard(
                    friend = friend,
                    onOpenSharedTab = { scrollToShared = true },
                )

                if (state.isFriendDetailLoading) {
                    PremiumLoadingCard(message = stringResource(R.string.friends_detail_loading))
                }
                state.friendDetailError?.let {
                    Text(stringResource(R.string.friends_detail_error, it), color = MaterialTheme.colorScheme.error)
                }

                FriendDetailTimelineSection(friend = friend)
                FriendDetailSharedContextSection(friend = friend)
                FriendDetailSharedContentSection(
                    items = sharedContent,
                    isLoading = isSharedContentLoading,
                    errorMessage = sharedContentError,
                    onRetry = onRetrySharedContent,
                )

                FriendDetailCirclesEditor(
                    circles = circles,
                    selectedCircleIds = detailCircleIds,
                    onCircleToggle = onDetailCircleToggle,
                    enabled = state.inFlightRequestId == null && !state.isFriendDetailLoading,
                )

                OutlinedTextField(
                    value = noteDraft,
                    onValueChange = onNoteDraftChange,
                    label = { Text(stringResource(R.string.friends_detail_note_label)) },
                    supportingText = { Text(stringResource(R.string.friends_note_autosave_hint)) },
                    minLines = if (chrome.shouldStackChromeActions) 3 else 4,
                    modifier = Modifier.fillMaxWidth(),
                )
                Text(
                    text = stringResource(R.string.friends_detail_privacy_hint),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                TextButton(onClick = onSave, enabled = state.inFlightRequestId == null && !state.isFriendDetailLoading) {
                    Text(stringResource(R.string.friends_detail_save))
                }
            }
        }
    }
}
