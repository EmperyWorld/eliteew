/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Chat inbox/thread session: list refresh, open/close, E2EE, search, drafts, and thread CRUD.
 *
 * Invariants:
 * - Mutates MainUiState.chatState only via ChatSessionHost.mainState updates.
 * - Composed by ChatSessionController; public API remains on ChatSessionController / MainViewModel.
 *
 * Related:
 * - ChatSessionController, ChatSessionBag, MainViewModel
 */
package world.empery.mobile.chat

import feature.chat.ChatListFilterTab
import feature.chat.ChatLocalFlags
import feature.chat.GafE2eeConsentUi
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import world.empery.mobile.R
import world.empery.mobile.observability.MobileTelemetry

internal class ChatInboxSession(
    private val bag: ChatSessionBag,
    private val scheduleChatRefresh: (Long) -> Unit,
) {
    fun refreshChats(): Job = refreshChatsInternal(force = true)

    fun refreshChatsInternal(force: Boolean): Job = bag.scope.launch {
        if (!bag.mainState.value.isAuthenticated) return@launch
        bag.refreshChatsMutex.withLock {
            if (!force && bag.mainState.value.chatState.isLoading) return@withLock
            bag.host.connectRealtimeIfAllowed()
            bag.mainState.update { it.copy(chatState = it.chatState.copy(isLoading = true, error = null)) }
            val result = runCatching { bag.container.chatRepository.refreshChatList() }
            result.onSuccess { chats ->
                val meId =
                    bag.mainState.value.chatState.meUserId
                        ?: bag.container.chatRepository.getCurrentUserId()
                val localFlags = bag.container.chatRepository.loadLocalFlags()
                val selectedChatId = bag.mainState.value.chatState.selectedChatId
                val partnerReadMarker =
                    selectedChatId?.let { opened ->
                        chats.find { it.chatId == opened }?.partnerLastReadMessageId
                    }
                bag.mainState.update {
                    it.copy(
                        chatState = it.chatState.copy(
                            chats = chats,
                            chatLocalFlags = localFlags,
                            meUserId = meId ?: it.chatState.meUserId,
                            selectedChatPartnerLastReadMessageId = partnerReadMarker,
                            isLoading = false,
                            error = null,
                        ),
                    )
                }
            }.onFailure { err ->
                if (err is CancellationException) throw err
                MobileTelemetry.reportError(err, "refreshChats failed")
                val cached = bag.container.chatRepository.loadChatListFromCache()
                val localFlags = bag.container.chatRepository.loadLocalFlags()
                bag.mainState.update {
                    it.copy(
                        chatState = it.chatState.copy(
                            chats = cached,
                            chatLocalFlags = localFlags,
                            isLoading = false,
                            error = err.message,
                        ),
                    )
                }
            }
        }
    }
    fun openChat(chatId: String) {
        bag.openChatJob?.cancel()
        bag.openChatGeneration++
        val generation = bag.openChatGeneration
        bag.openChatJob = bag.scope.launch {
            if (!bag.mainState.value.isAuthenticated) return@launch
            MobileTelemetry.trackBusinessEvent(
                "chat_opened",
                mapOf("chat_id_len" to chatId.length.toString()),
            )
            val meResolved =
                withContext(Dispatchers.IO) {
                    bag.mainState.value.chatState.meUserId ?: bag.container.chatRepository.getCurrentUserId()
                }
            if (generation != bag.openChatGeneration) return@launch
            var cachedMessages =
                bag.chatMessagesCache[chatId]
                    ?: withContext(Dispatchers.IO) {
                        bag.container.chatRepository.loadMessageCache(chatId)
                    }
            val durablePending =
                withContext(Dispatchers.IO) {
                    bag.container.chatRepository.loadPendingSends(chatId)
                }
            bag.pendingSendPayloads.entries.removeIf { it.value.chatId == chatId }
            durablePending.forEach { entity ->
                bag.pendingSendPayloads[entity.id] = with(bag) { entity.toPayload() }
            }
            val restoredPending = bag.pendingMessagesForChat(chatId, meResolved)
            val sortedCached = bag.sortChatMessages(cachedMessages + restoredPending)
            val diskPreviews =
                withContext(Dispatchers.IO) {
                    bag.container.chatRepository.attachmentPreviewUrisFromDiskCache(chatId, sortedCached)
                }
            if (generation != bag.openChatGeneration) return@launch
            val chatMeta = bag.mainState.value.chatState.chats.find { it.chatId == chatId }
            val unreadCount = chatMeta?.unreadCount ?: 0
            val partnerRead = chatMeta?.partnerLastReadMessageId
            bag.mainState.update {
                it.copy(
                    chatState = it.chatState.copy(
                        meUserId = meResolved ?: it.chatState.meUserId,
                        selectedChatId = chatId,
                        selectedChatUnreadBeforeOpen = unreadCount,
                        selectedChatPartnerLastReadMessageId = partnerRead,
                        selectedChatMessages = sortedCached,
                        hasMoreMessages = sortedCached.size < bag.chatPageSize,
                        isMessagesLoading = sortedCached.isEmpty(),
                        attachmentPreviewUris = diskPreviews,
                        attachmentLoadingIds = emptySet(),
                        error = null,
                    ),
                )
            }
            val pageResult =
                runCatching {
                    withContext(Dispatchers.IO) {
                        bag.container.chatRepository.ensureGafE2eeWireIdentity()
                        bag.container.chatRepository.loadMessagesPage(chatId, bag.chatPageSize, beforeMessageId = null)
                    }
                }
            if (generation != bag.openChatGeneration) return@launch
            pageResult.onSuccess { page ->
                val merged = bag.sortChatMessages(page + bag.pendingMessagesForChat(chatId, meResolved))
                val pageDisk =
                    withContext(Dispatchers.IO) {
                        bag.container.chatRepository.attachmentPreviewUrisFromDiskCache(chatId, merged)
                    }
                runCatching {
                    withContext(Dispatchers.IO) {
                        val lastId = merged.lastOrNull()?.id
                        if (lastId != null) {
                            bag.container.chatRepository.markRead(chatId, lastId)
                        }
                    }
                }.onFailure { err ->
                    if (err is CancellationException) throw err
                    MobileTelemetry.reportError(err, "markRead failed")
                }
                if (generation != bag.openChatGeneration) return@launch
                if (bag.mainState.value.chatState.selectedChatId != chatId) return@launch
                bag.chatMessagesCache[chatId] = merged
                bag.mainState.update {
                    val cs = it.chatState
                    it.copy(
                        chatState = cs.copy(
                            selectedChatId = chatId,
                            selectedChatMessages = merged,
                            hasMoreMessages = page.size < bag.chatPageSize,
                            isMessagesLoading = false,
                            attachmentPreviewUris = pageDisk + cs.attachmentPreviewUris,
                            error = null,
                        ),
                    )
                }
                scheduleChatRefresh(CHAT_OPEN_FOLLOWUP_REFRESH_MS)
                refreshChatE2eeConsent(chatId)
            }.onFailure { err ->
                if (err is CancellationException) throw err
                MobileTelemetry.reportError(err, "openChat failed")
                if (generation != bag.openChatGeneration) return@launch
                bag.mainState.update {
                    it.copy(
                        chatState = it.chatState.copy(
                            isMessagesLoading = false,
                            error = if (sortedCached.isEmpty()) err.message else it.chatState.error,
                        ),
                    )
                }
            }
        }
    }

    fun setChatFilter(query: String) {
        bag.mainState.update { it.copy(chatState = it.chatState.copy(chatFilter = query)) }
    }

    fun closeChat() {
        bag.openChatJob?.cancel()
        bag.openChatJob = null
        bag.openChatGeneration++
        bag.mainState.update {
            it.copy(
                chatState = it.chatState.copy(
                    selectedChatId = null,
                    selectedChatUnreadBeforeOpen = 0,
                    selectedChatPartnerLastReadMessageId = null,
                    selectedChatMessages = emptyList(),
                    hasMoreMessages = false,
                    isMessagesLoading = false,
                    attachmentPreviewUris = emptyMap(),
                    attachmentLoadingIds = emptySet(),
                    e2eeConsent = GafE2eeConsentUi(),
                ),
            )
        }
    }

    fun mapE2eeConsentUi(
        chatId: String,
        dto: world.empery.mobile.core.network.api.GafE2eeConsentStatusDto,
        busy: Boolean = false,
    ): GafE2eeConsentUi =
        GafE2eeConsentUi(
            chatId = chatId,
            status = dto.status,
            ready = dto.ready,
            requestedByUserId = dto.requested_by_user_id,
            busy = busy,
        )

    suspend fun refreshChatE2eeConsent(chatId: String) {
        val dto =
            runCatching {
                withContext(Dispatchers.IO) {
                    bag.container.chatRepository.fetchE2eeConsentStatus(chatId)
                }
            }.getOrNull() ?: return
        if (bag.mainState.value.chatState.selectedChatId != chatId) return
        bag.mainState.update {
            it.copy(
                chatState =
                    it.chatState.copy(
                        e2eeConsent = mapE2eeConsentUi(chatId, dto),
                    ),
            )
        }
    }

    fun proposeChatE2ee() {
        val chatId = bag.mainState.value.chatState.selectedChatId ?: return
        bag.scope.launch {
            bag.mainState.update {
                it.copy(
                    chatState =
                        it.chatState.copy(
                            e2eeConsent = it.chatState.e2eeConsent.copy(busy = true),
                        ),
                )
            }
            runCatching {
                withContext(Dispatchers.IO) { bag.container.chatRepository.proposeE2ee(chatId) }
            }.onSuccess { dto ->
                if (bag.mainState.value.chatState.selectedChatId == chatId) {
                    bag.mainState.update {
                        it.copy(
                            chatState =
                                it.chatState.copy(
                                    e2eeConsent = mapE2eeConsentUi(chatId, dto),
                                ),
                        )
                    }
                }
            }.onFailure { err ->
                if (err is CancellationException) throw err
                MobileTelemetry.reportError(err, "gaf e2ee propose failed")
            }
            bag.mainState.update {
                if (it.chatState.selectedChatId == chatId) {
                    it.copy(
                        chatState =
                            it.chatState.copy(
                                e2eeConsent = it.chatState.e2eeConsent.copy(busy = false),
                            ),
                    )
                } else {
                    it
                }
            }
        }
    }

    fun acceptChatE2ee() {
        val chatId = bag.mainState.value.chatState.selectedChatId ?: return
        bag.scope.launch {
            bag.mainState.update {
                it.copy(
                    chatState =
                        it.chatState.copy(
                            e2eeConsent = it.chatState.e2eeConsent.copy(busy = true),
                        ),
                )
            }
            runCatching {
                withContext(Dispatchers.IO) { bag.container.chatRepository.acceptE2ee(chatId) }
            }.onSuccess { dto ->
                if (bag.mainState.value.chatState.selectedChatId == chatId) {
                    bag.mainState.update {
                        it.copy(
                            chatState =
                                it.chatState.copy(
                                    e2eeConsent = mapE2eeConsentUi(chatId, dto),
                                ),
                        )
                    }
                }
            }.onFailure { err ->
                if (err is CancellationException) throw err
                MobileTelemetry.reportError(err, "gaf e2ee accept failed")
            }
            bag.mainState.update {
                if (it.chatState.selectedChatId == chatId) {
                    it.copy(
                        chatState =
                            it.chatState.copy(
                                e2eeConsent = it.chatState.e2eeConsent.copy(busy = false),
                            ),
                    )
                } else {
                    it
                }
            }
        }
    }

    fun declineChatE2ee() {
        val chatId = bag.mainState.value.chatState.selectedChatId ?: return
        bag.scope.launch {
            bag.mainState.update {
                it.copy(
                    chatState =
                        it.chatState.copy(
                            e2eeConsent = it.chatState.e2eeConsent.copy(busy = true),
                        ),
                )
            }
            runCatching {
                withContext(Dispatchers.IO) { bag.container.chatRepository.declineE2ee(chatId) }
            }.onSuccess { dto ->
                if (bag.mainState.value.chatState.selectedChatId == chatId) {
                    bag.mainState.update {
                        it.copy(
                            chatState =
                                it.chatState.copy(
                                    e2eeConsent = mapE2eeConsentUi(chatId, dto),
                                ),
                        )
                    }
                }
            }.onFailure { err ->
                if (err is CancellationException) throw err
                MobileTelemetry.reportError(err, "gaf e2ee decline failed")
            }
            bag.mainState.update {
                if (it.chatState.selectedChatId == chatId) {
                    it.copy(
                        chatState =
                            it.chatState.copy(
                                e2eeConsent = it.chatState.e2eeConsent.copy(busy = false),
                            ),
                    )
                } else {
                    it
                }
            }
        }
    }

    fun disableChatE2ee() {
        val chatId = bag.mainState.value.chatState.selectedChatId ?: return
        bag.scope.launch {
            bag.mainState.update {
                it.copy(
                    chatState =
                        it.chatState.copy(
                            e2eeConsent = it.chatState.e2eeConsent.copy(busy = true),
                        ),
                )
            }
            runCatching {
                withContext(Dispatchers.IO) { bag.container.chatRepository.disableE2ee(chatId) }
            }.onSuccess { dto ->
                if (bag.mainState.value.chatState.selectedChatId == chatId) {
                    bag.mainState.update {
                        it.copy(
                            chatState =
                                it.chatState.copy(
                                    e2eeConsent = mapE2eeConsentUi(chatId, dto),
                                ),
                        )
                    }
                }
            }.onFailure { err ->
                if (err is CancellationException) throw err
                MobileTelemetry.reportError(err, "gaf e2ee disable failed")
            }
            bag.mainState.update {
                if (it.chatState.selectedChatId == chatId) {
                    it.copy(
                        chatState =
                            it.chatState.copy(
                                e2eeConsent = it.chatState.e2eeConsent.copy(busy = false),
                            ),
                    )
                } else {
                    it
                }
            }
        }
    }

    fun setChatListFilterTab(tab: ChatListFilterTab) {
        bag.mainState.update { it.copy(chatState = it.chatState.copy(activeFilterTab = tab)) }
    }

    fun setChatDraft(chatId: String, draft: String) {
        val normalized = draft.trimEnd()
        bag.mainState.update { s ->
            val drafts = s.chatState.composerDrafts.toMutableMap()
            if (normalized.isBlank()) {
                drafts.remove(chatId)
            } else {
                drafts[chatId] = normalized
            }
            s.copy(chatState = s.chatState.copy(composerDrafts = drafts))
        }
        bag.chatDraftPersistJob?.cancel()
        bag.chatDraftPersistJob =
            bag.scope.launch(Dispatchers.IO) {
                delay(CHAT_COMPOSER_DRAFT_PERSIST_DEBOUNCE_MS)
                bag.container.chatRepository.saveDraft(chatId, draft)
            }
    }

    fun setChatUserSearchQuery(query: String) {
        bag.userSearchDebounceJob?.cancel()
        bag.userSearchDebounceJob = null
        val trimmed = query.trim()
        bag.mainState.update {
            it.copy(
                chatState = it.chatState.copy(
                    userSearchQuery = query,
                    userSearchResults = if (trimmed.isBlank()) emptyList() else it.chatState.userSearchResults,
                    isSearchingUsers = trimmed.isNotBlank() && it.chatState.isSearchingUsers,
                ),
            )
        }
        if (trimmed.isBlank()) return
        bag.userSearchDebounceJob = bag.scope.launch {
            delay(USER_SEARCH_DEBOUNCE_MS)
            if (trimmed != bag.mainState.value.chatState.userSearchQuery.trim()) return@launch
            performChatUserSearch()
        }
    }

    fun searchChatUsers(): Job = bag.scope.launch { performChatUserSearch() }

    fun openOrCreateChatByUsername(username: String) = bag.scope.launch {
        if (!bag.mainState.value.isAuthenticated) return@launch
        val trimmed = username.trim()
        if (trimmed.isBlank()) return@launch
        runCatching {
            withContext(Dispatchers.IO) {
                bag.container.chatRepository.getOrCreateChatByUsername(trimmed)
            }
        }.onSuccess { chatId ->
            bag.mainState.update {
                it.copy(
                    chatState = it.chatState.copy(
                        userSearchQuery = "",
                        userSearchResults = emptyList(),
                    ),
                )
            }
            refreshChatsInternal(force = true)
            openChat(chatId)
        }.onFailure { err ->
            if (err is CancellationException) throw err
            MobileTelemetry.reportError(err, "openOrCreateChatByUsername failed")
            bag.mainState.update {
                it.copy(
                    chatState = it.chatState.copy(
                        error = err.message ?: bag.host.appString(R.string.app_chat_open_user_failed),
                    ),
                )
            }
        }
    }

    fun loadOlderMessages(): Job = bag.scope.launch {
        val chatId = bag.mainState.value.chatState.selectedChatId ?: return@launch
        if (!bag.mainState.value.isAuthenticated) return@launch
        if (bag.mainState.value.chatState.isLoadingOlderMessages) return@launch
        if (!bag.mainState.value.chatState.hasMoreMessages) return@launch
        val beforeId =
            bag.mainState.value.chatState.selectedChatMessages
                .firstOrNull { bag.isServerBackedMessageId(it.id) }
                ?.id
                ?: return@launch
        bag.mainState.update { it.copy(chatState = it.chatState.copy(isLoadingOlderMessages = true, error = null)) }
        val result =
            runCatching {
                withContext(Dispatchers.IO) {
                    bag.container.chatRepository.loadMessagesPage(chatId, bag.chatPageSize, beforeId)
                }
            }
        result.onSuccess { older ->
            if (bag.mainState.value.chatState.selectedChatId != chatId) return@launch
            val merged = bag.sortChatMessages(older + bag.mainState.value.chatState.selectedChatMessages)
            bag.chatMessagesCache[chatId] = merged
            withContext(Dispatchers.IO) {
                bag.container.chatRepository.replaceMessageCache(chatId, merged)
            }
            val olderDisk =
                withContext(Dispatchers.IO) {
                    bag.container.chatRepository.attachmentPreviewUrisFromDiskCache(chatId, merged)
                }
            bag.mainState.update {
                val cs = it.chatState
                it.copy(
                    chatState = cs.copy(
                        selectedChatMessages = merged,
                        hasMoreMessages = older.size < bag.chatPageSize,
                        isLoadingOlderMessages = false,
                        attachmentPreviewUris = olderDisk + cs.attachmentPreviewUris,
                        error = null,
                    ),
                )
            }
        }.onFailure { err ->
            if (err is CancellationException) throw err
            MobileTelemetry.reportError(err, "loadOlderMessages failed")
            bag.mainState.update {
                it.copy(
                    chatState = it.chatState.copy(
                        isLoadingOlderMessages = false,
                        error = err.message ?: bag.host.appString(R.string.app_chat_load_older_failed),
                    ),
                )
            }
        }
    }

    fun toggleChatPinned(chatId: String) {
        updateChatFlags(chatId) { flags -> flags.copy(pinned = !flags.pinned) }
    }

    fun toggleChatMuted(chatId: String) {
        updateChatFlags(chatId) { flags -> flags.copy(muted = !flags.muted) }
    }

    fun toggleChatArchived(chatId: String) {
        updateChatFlags(chatId) { flags ->
            val archived = !flags.archived
            flags.copy(pinned = if (archived) false else flags.pinned, archived = archived)
        }
    }

    fun startReplyToMessage(messageId: String) {
        bag.mainState.update { it.copy(chatState = it.chatState.copy(replyingToMessageId = messageId)) }
    }

    fun cancelReplyToMessage() {
        bag.mainState.update { it.copy(chatState = it.chatState.copy(replyingToMessageId = null)) }
    }

    fun startEditMessage(messageId: String) {
        val chatId = bag.mainState.value.chatState.selectedChatId ?: return
        val message = bag.mainState.value.chatState.selectedChatMessages.find { it.id == messageId } ?: return
        setChatDraft(chatId, message.body)
        bag.mainState.update {
            it.copy(
                chatState = it.chatState.copy(
                    editingMessageId = messageId,
                    replyingToMessageId = null,
                ),
            )
        }
    }

    fun cancelEditMessage() {
        bag.mainState.value.chatState.selectedChatId?.let { setChatDraft(it, "") }
        bag.mainState.update {
            it.copy(
                chatState = it.chatState.copy(
                    editingMessageId = null,
                    replyingToMessageId = null,
                ),
            )
        }
    }

    fun deleteChatMessage(messageId: String, forMeOnly: Boolean = false): Job = bag.scope.launch {
        val chatId = bag.mainState.value.chatState.selectedChatId ?: return@launch
        if (!bag.mainState.value.isAuthenticated) return@launch
        val result =
            runCatching {
                withContext(Dispatchers.IO) {
                    bag.container.chatRepository.deleteMessage(chatId, messageId, forMeOnly)
                }
            }
        result.onSuccess {
            val updated =
                bag.sortChatMessages(
                    bag.mainState.value.chatState.selectedChatMessages.filter { it.id != messageId },
                )
            bag.pendingSendPayloads.remove(messageId)
            bag.chatMessagesCache[chatId] = updated
            withContext(Dispatchers.IO) {
                bag.container.chatRepository.deletePendingSend(messageId)
                bag.container.chatRepository.replaceMessageCache(chatId, updated)
            }
            bag.mainState.update { it.copy(chatState = it.chatState.copy(selectedChatMessages = updated)) }
            scheduleChatRefresh(CHAT_OPEN_FOLLOWUP_REFRESH_MS)
        }.onFailure { err ->
            if (err is CancellationException) throw err
            MobileTelemetry.reportError(err, "deleteChatMessage failed")
            bag.mainState.update {
                it.copy(
                    chatState = it.chatState.copy(
                        error = err.message ?: bag.host.appString(R.string.app_chat_delete_message_failed),
                    ),
                )
            }
        }
    }

    fun clearCurrentChatHistory(): Job = bag.scope.launch {
        val chatId = bag.mainState.value.chatState.selectedChatId ?: return@launch
        if (!bag.mainState.value.isAuthenticated) return@launch
        runCatching {
            withContext(Dispatchers.IO) { bag.container.chatRepository.clearChatHistory(chatId) }
        }.onSuccess {
            bag.chatMessagesCache[chatId] = emptyList()
            bag.pendingSendPayloads.entries.removeIf { it.value.chatId == chatId }
            bag.mainState.update {
                it.copy(
                    chatState = it.chatState.copy(
                        selectedChatMessages = emptyList(),
                        hasMoreMessages = false,
                        attachmentPreviewUris = emptyMap(),
                        attachmentLoadingIds = emptySet(),
                        operationHint = bag.host.appString(R.string.app_chat_history_cleared),
                        error = null,
                    ),
                )
            }
            scheduleChatRefresh(CHAT_QUICK_REFRESH_MS)
        }.onFailure { err ->
            if (err is CancellationException) throw err
            MobileTelemetry.reportError(err, "clearCurrentChatHistory failed")
            bag.mainState.update {
                it.copy(
                    chatState = it.chatState.copy(
                        error = err.message ?: bag.host.appString(R.string.app_chat_clear_history_failed),
                    ),
                )
            }
        }
    }

    fun archiveCurrentChat(): Job = bag.scope.launch {
        val chatId = bag.mainState.value.chatState.selectedChatId ?: return@launch
        if (!bag.mainState.value.isAuthenticated) return@launch
        runCatching {
            withContext(Dispatchers.IO) { bag.container.chatRepository.archiveChat(chatId) }
        }.onSuccess {
            bag.pendingSendPayloads.entries.removeIf { it.value.chatId == chatId }
            withContext(Dispatchers.IO) {
                bag.container.chatRepository.deletePendingSendsByChat(chatId)
            }
            bag.mainState.update {
                it.copy(
                    chatState = it.chatState.copy(
                        operationHint = bag.host.appString(R.string.app_chat_archived),
                        error = null,
                    ),
                )
            }
            closeChat()
            refreshChatsInternal(force = true)
        }.onFailure { err ->
            if (err is CancellationException) throw err
            MobileTelemetry.reportError(err, "archiveCurrentChat failed")
            bag.mainState.update {
                it.copy(
                    chatState = it.chatState.copy(
                        error = err.message ?: bag.host.appString(R.string.app_chat_archive_failed),
                    ),
                )
            }
        }
    }

    fun deleteCurrentChat(): Job = bag.scope.launch {
        val chatId = bag.mainState.value.chatState.selectedChatId ?: return@launch
        if (!bag.mainState.value.isAuthenticated) return@launch
        runCatching {
            withContext(Dispatchers.IO) { bag.container.chatRepository.deleteChat(chatId) }
        }.onSuccess {
            bag.chatMessagesCache.remove(chatId)
            bag.pendingSendPayloads.entries.removeIf { it.value.chatId == chatId }
            bag.mainState.update {
                it.copy(
                    chatState = it.chatState.copy(
                        operationHint = bag.host.appString(R.string.app_chat_deleted),
                        error = null,
                    ),
                )
            }
            closeChat()
            refreshChatsInternal(force = true)
        }.onFailure { err ->
            if (err is CancellationException) throw err
            MobileTelemetry.reportError(err, "deleteCurrentChat failed")
            bag.mainState.update {
                it.copy(
                    chatState = it.chatState.copy(
                        error = err.message ?: bag.host.appString(R.string.app_chat_delete_failed),
                    ),
                )
            }
        }
    }

    suspend fun performChatUserSearch() {
        if (!bag.mainState.value.isAuthenticated) return
        val query = bag.mainState.value.chatState.userSearchQuery.trim()
        if (query.isBlank()) {
            bag.mainState.update { it.copy(chatState = it.chatState.copy(userSearchResults = emptyList())) }
            return
        }
        bag.mainState.update { it.copy(chatState = it.chatState.copy(isSearchingUsers = true)) }
        val result = runCatching { bag.container.chatRepository.searchUsers(query) }
        result.onSuccess { users ->
            if (bag.mainState.value.isAuthenticated &&
                query == bag.mainState.value.chatState.userSearchQuery.trim()
            ) {
                bag.mainState.update {
                    it.copy(
                        chatState = it.chatState.copy(
                            userSearchResults = users,
                            isSearchingUsers = false,
                        ),
                    )
                }
            }
        }.onFailure { err ->
            if (err is CancellationException) throw err
            MobileTelemetry.reportError(err, "searchChatUsers failed")
            if (bag.mainState.value.isAuthenticated &&
                query == bag.mainState.value.chatState.userSearchQuery.trim()
            ) {
                bag.mainState.update {
                    it.copy(
                        chatState = it.chatState.copy(
                            isSearchingUsers = false,
                            error = err.message ?: bag.host.appString(R.string.app_chat_user_search_failed),
                        ),
                    )
                }
            }
        }
    }
    fun updateChatFlags(
        chatId: String,
        update: (ChatLocalFlags) -> ChatLocalFlags,
    ) {
        val next = bag.container.chatRepository.updateLocalFlags(chatId, update)
        bag.mainState.update {
            it.copy(
                chatState = it.chatState.copy(chatLocalFlags = next),
            )
        }
    }
}
