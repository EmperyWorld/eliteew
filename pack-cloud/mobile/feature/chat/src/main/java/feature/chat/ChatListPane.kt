/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * GAF chat discovery pane: debounced conversation search, filters, user lookup, and list states.
 *
 * Invariants:
 * - Search debounce remains 320 ms.
 * - Conversation rows are rendered only by ChatConversationList.
 *
 * Related:
 * - ChatFeature.kt, ChatConversationList.kt, ChatTopBar.kt
 */
package feature.chat

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Chat
import androidx.compose.material.icons.automirrored.outlined.VolumeOff
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.outlined.Archive
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.MarkChatUnread
import androidx.compose.material.icons.outlined.PersonSearch
import androidx.compose.material.icons.outlined.PushPin
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import world.empery.mobile.core.storage.ChatEntity
import world.empery.mobile.core.ui.PremiumRowSurface

private const val CHAT_LIST_SEARCH_DEBOUNCE_MS = 320L

@Composable
internal fun ChatListPane(
    state: ChatUiState,
    filteredChats: List<ChatEntity>,
    listPartnerMeta: Map<String, GafChatListPartnerMeta>,
    showTopBar: Boolean,
    masterDetailListPane: Boolean,
    actions: ChatListActions,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    var showNewChatSearch by remember { mutableStateOf(false) }
    var localChatFilter by remember { mutableStateOf(state.chatFilter) }
    LaunchedEffect(state.chatFilter) {
        if (state.chatFilter.isBlank() && localChatFilter.isNotBlank()) {
            localChatFilter = ""
        }
    }
    LaunchedEffect(localChatFilter) {
        delay(CHAT_LIST_SEARCH_DEBOUNCE_MS)
        if (localChatFilter != state.chatFilter) {
            actions.onChatFilterChange(localChatFilter)
        }
    }

    Column(modifier = modifier.fillMaxSize()) {
        if (showTopBar) {
            ChatTopBar(
                selectedChat = null,
                visibleChatsCount = filteredChats.size,
                unreadChatsCount = totalChatUnreadCount(state.chats),
                onCloseChat = {},
                onRequestClearHistory = {},
                onRequestArchiveChat = {},
                onRequestDeleteChat = {},
                showVideoCallAction = false,
                onStartVideoCall = {},
                onStartGroupVideoCall = {},
                showBackNavigation = false,
            )
            Spacer(modifier = Modifier.height(4.dp))
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            ChatSearchField(
                value = localChatFilter,
                onValueChange = { localChatFilter = it },
                placeholder = stringResource(R.string.chat_search_placeholder),
                modifier = Modifier.weight(1f),
                trailingIcon = {
                    if (localChatFilter.isNotBlank()) {
                        IconButton(onClick = { localChatFilter = "" }) {
                            Icon(
                                Icons.Outlined.Close,
                                contentDescription =
                                    context.getString(R.string.chat_search_clear_cd),
                            )
                        }
                    }
                },
            )
            Surface(
                shape = CircleShape,
                color = Color.Transparent,
                border =
                    BorderStroke(
                        1.dp,
                        MaterialTheme.colorScheme.primary.copy(alpha = 0.34f),
                    ),
                tonalElevation = 0.dp,
            ) {
                IconButton(
                    onClick = { showNewChatSearch = !showNewChatSearch },
                    modifier =
                        Modifier
                            .size(50.dp)
                            .background(
                                Brush.radialGradient(
                                    listOf(
                                        MaterialTheme.colorScheme.primary.copy(alpha = 0.22f),
                                        MaterialTheme.colorScheme.primary.copy(alpha = 0.06f),
                                    ),
                                ),
                                CircleShape,
                            ),
                ) {
                    Icon(
                        Icons.Filled.Add,
                        contentDescription = context.getString(R.string.chat_new_chat_cd),
                        tint = MaterialTheme.colorScheme.primary,
                    )
                }
            }
        }
        Spacer(modifier = Modifier.height(6.dp))
        ChatFilterTabs(
            activeTab = state.activeFilterTab,
            onFilterTabChange = actions.onFilterTabChange,
        )
        if (showNewChatSearch) {
            Spacer(modifier = Modifier.height(6.dp))
            OutlinedTextField(
                value = state.userSearchQuery,
                onValueChange = actions.onSetUserSearchQuery,
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                leadingIcon = { Icon(Icons.Outlined.PersonSearch, contentDescription = null) },
                placeholder = { Text(stringResource(R.string.chat_username_placeholder)) },
                shape = RoundedCornerShape(16.dp),
                colors = chatSearchFieldColors(),
                trailingIcon = {
                    if (state.isSearchingUsers) {
                        CircularProgressIndicator(
                            modifier =
                                Modifier
                                    .size(26.dp)
                                    .semantics {
                                        contentDescription =
                                            context.getString(R.string.chat_user_search_cd)
                                    },
                            strokeWidth = 2.dp,
                        )
                    } else {
                        IconButton(
                            onClick = actions.onSearchUsers,
                            enabled = state.userSearchQuery.isNotBlank(),
                        ) {
                            Icon(
                                Icons.Outlined.Search,
                                contentDescription =
                                    context.getString(R.string.chat_user_search_action_cd),
                            )
                        }
                    }
                },
            )
        }
        if (showNewChatSearch && state.userSearchResults.isNotEmpty()) {
            Spacer(modifier = Modifier.height(8.dp))
            ChatUserSearchResults(
                users = state.userSearchResults,
                onOpen = actions.onOpenOrCreateChatByUsername,
            )
        }
        Spacer(modifier = Modifier.height(4.dp))
        Box(
            modifier =
                Modifier
                    .weight(1f, fill = true)
                    .fillMaxWidth(),
        ) {
            when {
                state.isLoading && state.chats.isEmpty() -> {
                    ChatCenterLoading(message = stringResource(R.string.chat_loading))
                }
                !state.isLoading && state.chats.isEmpty() -> EmptyChatsPlaceholder()
                else ->
                    ChatConversationList(
                        chats = filteredChats,
                        chatLocalFlags = state.chatLocalFlags,
                        selectedChatId = state.selectedChatId,
                        listPartnerMeta = listPartnerMeta,
                        masterDetailListPane = masterDetailListPane,
                        showFilteredEmpty =
                            state.chats.isNotEmpty() && filteredChats.isEmpty(),
                        actions = actions,
                        modifier = Modifier.fillMaxSize(),
                    )
            }
        }
    }
}

@Composable
private fun ChatSearchField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    trailingIcon: @Composable (() -> Unit)? = null,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier,
        placeholder = { Text(placeholder) },
        leadingIcon = {
            Icon(
                Icons.Outlined.Search,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        },
        trailingIcon = trailingIcon,
        singleLine = true,
        shape = RoundedCornerShape(16.dp),
        colors = chatSearchFieldColors(),
    )
}

@Composable
private fun chatSearchFieldColors() =
    OutlinedTextFieldDefaults.colors(
        focusedContainerColor = MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = 0.65f),
        unfocusedContainerColor = MaterialTheme.colorScheme.surfaceContainer.copy(alpha = 0.45f),
        focusedBorderColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.4f),
        unfocusedBorderColor = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.35f),
    )

@Composable
private fun ChatFilterTabs(
    activeTab: ChatListFilterTab,
    onFilterTabChange: (ChatListFilterTab) -> Unit,
) {
    val context = LocalContext.current
    LazyRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        items(
            items = ChatListFilterTab.entries,
            key = { it.ordinal },
        ) { tab ->
            val selected = activeTab == tab
            val label = stringResource(tab.labelRes)
            FilterChip(
                selected = selected,
                onClick = { onFilterTabChange(tab) },
                label = {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            chatListFilterTabIcon(tab),
                            contentDescription = null,
                            modifier = Modifier.size(if (selected) 18.dp else 22.dp),
                        )
                        if (selected) {
                            Text(label, style = MaterialTheme.typography.labelMedium)
                        }
                    }
                },
                modifier =
                    Modifier.semantics {
                        contentDescription = context.getString(R.string.chat_filter_cd, label)
                    },
            )
        }
    }
}

@Composable
private fun ChatUserSearchResults(
    users: List<ChatUserSearchUi>,
    onOpen: (String) -> Unit,
) {
    val context = LocalContext.current
    LazyRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(
            items = users,
            key = { it.id },
            contentType = { "chat_user_search_result" },
        ) { user ->
            val username =
                if (user.username.isBlank()) {
                    stringResource(R.string.chat_no_username)
                } else {
                    "@${user.username}"
                }
            PremiumRowSurface(
                modifier =
                    Modifier
                        .widthIn(max = 220.dp)
                        .semantics(mergeDescendants = true) {
                            contentDescription =
                                context.getString(
                                    R.string.chat_user_search_result_cd,
                                    "${user.displayName}, $username",
                                )
                        },
            ) {
                Column(modifier = Modifier.weight(1f, fill = false)) {
                    Text(
                        user.displayName,
                        style = MaterialTheme.typography.titleSmall,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        username,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                    )
                }
                IconButton(
                    onClick = { onOpen(user.username) },
                    enabled = user.username.isNotBlank(),
                ) {
                    Icon(
                        Icons.AutoMirrored.Outlined.Chat,
                        contentDescription =
                            context.getString(R.string.chat_open_chat_cd, user.displayName),
                    )
                }
            }
        }
    }
}

private fun chatListFilterTabIcon(tab: ChatListFilterTab): ImageVector =
    when (tab) {
        ChatListFilterTab.All -> Icons.AutoMirrored.Outlined.Chat
        ChatListFilterTab.Unread -> Icons.Outlined.MarkChatUnread
        ChatListFilterTab.Pinned -> Icons.Outlined.PushPin
        ChatListFilterTab.Muted -> Icons.AutoMirrored.Outlined.VolumeOff
        ChatListFilterTab.Archived -> Icons.Outlined.Archive
    }
