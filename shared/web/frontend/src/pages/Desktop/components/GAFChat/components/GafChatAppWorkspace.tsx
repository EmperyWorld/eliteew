/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Authenticated GAF Chat product workspace: header, sidebar, thread column, composer, and modals.
 * Render-only shell; orchestration and state live in GAFChatApp.tsx via GafChatAppWorkspaceModel.
 *
 * Invariants:
 * - Message context menu provider wraps the full authenticated tree.
 * - No auth or deep-link bootstrap logic in this file — parent passes resolved view model only.
 *
 * Related:
 * - GAFChatApp.tsx
 * - documentation/product/desktop/DESKTOP-SHELL-FOLLOW-UP-BACKLOG-2026-06-30.md (Wave N5)
 */
import type { Content } from '@/components/UnifiedContent/types';
import type {
	SpotlightGuideModalLabels,
	SpotlightGuideStep,
} from '@/components/guided-tour/SpotlightGuideModal';
import type { DesktopWindowStyle } from '@/types/profile';
import type { QueryClient } from '@tanstack/react-query';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { ChangeEvent, ClipboardEvent, DragEvent } from 'react';
import type { toast as sonnerToast } from 'sonner';
import { DesktopProductWorkspace } from '../../DesktopAppChrome';
import {
	gafChatQueryKeys,
	getOrCreateChatByUsername,
	searchUsers,
	type GafE2eeStatus,
} from '../api/gafChatApi';
import { GAF_CHAT_GUIDE_ROOT_ID } from '../gafChatGuideConstants';
import type { GafPendingComposerAttachment } from '../gafChatComposerTypes';
import type { GafChatThreadPrefs } from '../gafChatThreadPrefs';
import type { GAFChatConfirmKind } from '../GAFChatConfirmModal';
import type { GAFChatListItem, GAFChatPartner, GAFMessageItem } from '../types';
import { GafChatAppHeaderToolbar } from './GafChatAppHeaderToolbar';
import { GafChatComposerCluster } from './GafChatComposerCluster';
import { GafChatMainColumnChrome } from './GafChatMainColumnChrome';
import { GafChatMessageContextMenuProvider } from './GafChatMessageContextMenuProvider';
import {
	GafChatModalsCluster,
	type GafMessageDeleteConfirm,
} from './GafChatModalsCluster';
import { GafChatSidebarPanel } from './GafChatSidebarPanel';
import { GafChatThreadPanel } from './GafChatThreadPanel';

export type GafChatSendMutationHandle = {
	isPending: boolean;
	isError: boolean;
	error: unknown;
	variables: unknown;
	reset: () => void;
	mutate: (variables: unknown) => void;
};

export type GafChatAppWorkspaceModel = {
	shellAppToolbarClass: string;
	shellNavAsideClass: string;
	shellSidebarSearchRowClass: string;
	shellSidebarSearchInputClass: string;
	shellMainColumnClass: string;
	shellComposerFormClass: string;
	shellComposerTextareaClass: string;
	shellComposerHintRowClass: string;
	shellFrame: DesktopWindowStyle;
	unreadTotal: number;
	socketConnected: boolean;
	myUserId: string | null;
	meLabel: string;
	isGafAdmin: boolean;
	selectedChatId: string | null;
	partner: GAFChatPartner | null | undefined;
	partnerIsSystemAccount: boolean;
	partnerLastReadIndex: number;
	chatBlocked: boolean;
	chatMuted: boolean;
	composerLocked: boolean;
	e2eeActive: boolean;
	e2eeStatus: GafE2eeStatus | undefined;
	e2eeConsentBusy: boolean;
	showE2eeReadinessBanner: boolean;
	chatsLoading: boolean;
	chatsError: boolean;
	chatsErrorCode: number | undefined;
	chatsErrorDismissed: boolean;
	chats: GAFChatListItem[];
	filteredChats: GAFChatListItem[];
	searchQuery: string;
	sidebarFilter: 'all' | 'unread';
	sidebarCollapsed: boolean;
	sidebarCollapsePersisting: boolean;
	pinnedChatIds: string[];
	resolvingInitialUsername: boolean;
	openingChatTimedOut: boolean;
	messagesLoading: boolean;
	messagesError: boolean;
	messagesErrorDismissed: boolean;
	messagesQueryError: unknown;
	messages: GAFMessageItem[];
	messageById: Map<string, GAFMessageItem>;
	hasNextPage: boolean;
	isFetchingNextPage: boolean;
	showScrollDown: boolean;
	threadPrefs: GafChatThreadPrefs;
	threadSearchQuery: string;
	threadSearchTrimmed: string;
	threadMatchIds: string[];
	threadMatchIndex: number;
	scrollToMessageId: string | null;
	inputText: string;
	replyingTo: GAFMessageItem | null;
	pendingAttachments: GafPendingComposerAttachment[];
	composerDragOver: boolean;
	isVoiceRecording: boolean;
	isVoiceRecordingSupported: boolean;
	voiceElapsedSec: number;
	attachmentUploading: boolean;
	/** 0–100 in 5% steps while uploading bytes; null when idle or library-only busy. */
	attachmentUploadPercent: number | null;
	acceptBusyMessageId: string | null;
	soundEnabled: boolean;
	showNewChat: boolean;
	showContentLibraryPicker: boolean;
	showAdminAppLinkPicker: boolean;
	groupCallPickerOpen: boolean;
	confirmKind: GAFChatConfirmKind | null;
	messageDeleteConfirm: GafMessageDeleteConfirm;
	editingMessage: GAFMessageItem | null;
	editDraft: string;
	editSavePending: boolean;
	guideOpen: boolean;
	guideSteps: SpotlightGuideStep[];
	guideLabels: SpotlightGuideModalLabels;
	guideAudioLocalStorageKey: string;
	guideTourAudioFolder: string;
	startVideoCallPending: boolean;
	startGroupVideoCallPending: boolean;
	groupCallSubmitting: boolean;
	gafPortalRoot: HTMLElement | null;
	chatListRowRefs: RefObject<(HTMLButtonElement | null)[]>;
	sidebarSearchInputRef: RefObject<HTMLInputElement | null>;
	messageListRef: RefObject<HTMLDivElement | null>;
	loadMoreSentinelRef: RefObject<HTMLDivElement | null>;
	threadSearchInputRef: RefObject<HTMLInputElement | null>;
	localAttachInputRef: RefObject<HTMLInputElement | null>;
	inputRef: RefObject<HTMLTextAreaElement | null>;
	editMessageTextareaRef: RefObject<HTMLTextAreaElement | null>;
	editMessageHintId: string;
	queryClient: QueryClient;
	toastApi: typeof sonnerToast;
	sendMutation: GafChatSendMutationHandle;
	setShowNewChat: (open: boolean) => void;
	setSelectedChatId: (chatId: string | null) => void;
	setSearchQuery: (query: string) => void;
	setSidebarFilter: (filter: 'all' | 'unread') => void;
	setGafPortalRoot: (root: HTMLElement | null) => void;
	setChatsErrorDismissed: (dismissed: boolean) => void;
	setMessagesErrorDismissed: (dismissed: boolean) => void;
	setInputText: (text: string) => void;
	setReplyingTo: (message: GAFMessageItem | null) => void;
	setPendingAttachments: Dispatch<
		SetStateAction<GafPendingComposerAttachment[]>
	>;
	setShowContentLibraryPicker: (open: boolean) => void;
	setShowAdminAppLinkPicker: (open: boolean) => void;
	setGroupCallPickerOpen: (open: boolean) => void;
	setConfirmKind: (kind: GAFChatConfirmKind | null) => void;
	setMessageDeleteConfirm: (confirm: GafMessageDeleteConfirm) => void;
	setEditingMessage: (message: GAFMessageItem | null) => void;
	setEditDraft: (draft: string) => void;
	setGuideOpen: (open: boolean) => void;
	onDismissE2eeReadinessBanner: () => void;
	toggleSidebarCollapsed: () => void;
	refetchChats: () => void;
	refetchMessages: () => void;
	handleSelectChat: (chatId: string) => void;
	handleTogglePin: (chatId: string) => void;
	prefetchChatMessages: (chatId: string) => void;
	handleRetryOpenChat: () => void;
	handleThreadPrefsChange: (next: GafChatThreadPrefs) => void;
	handleSetupE2eeKeys: () => void;
	handleProposeE2ee: () => void;
	handleAcceptE2ee: () => void;
	handleDeclineE2ee: () => void;
	handleDisableE2ee: () => void;
	handleStartVideoCall: () => void;
	handleStartGroupVideoCall: () => void;
	handleClearHistory: () => void;
	handleArchiveChat: () => void;
	handleDeleteForEveryone: () => void;
	toggleSound: () => void;
	handleCopyPartnerUsername: (username: string) => void;
	handleCopyMessagePlainText: (text: string) => void;
	updateMessageListScrollUi: () => void;
	scrollMessagesToBottom: () => void;
	handleLoadOlder: () => void;
	onConsumedScrollToMessage: () => void;
	setThreadSearchQuery: (query: string) => void;
	goPrevThreadMatch: () => void;
	goNextThreadMatch: () => void;
	handleAcceptIncomingAttachment: (message: GAFMessageItem) => void;
	handleReply: (message: GAFMessageItem) => void;
	handleJumpToMessage: (messageId: string) => void;
	handleOpenEditMessage: (message: GAFMessageItem) => void;
	handleMessageDeleteForMe: (m: GAFMessageItem) => void;
	handleMessageDeleteForEveryone: (m: GAFMessageItem) => void;
	handleSend: () => void;
	handleComposerDragEnter: (event: DragEvent<HTMLFormElement>) => void;
	handleComposerDragLeave: (event: DragEvent<HTMLFormElement>) => void;
	handleComposerDragOver: (event: DragEvent<HTMLFormElement>) => void;
	handleComposerDrop: (event: DragEvent<HTMLFormElement>) => void;
	handleComposerPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
	handlePickLocalFile: (
		event: ChangeEvent<HTMLInputElement>
	) => void | Promise<void>;
	cancelVoiceRecording: () => void;
	beginVoiceRecording: () => void;
	finishVoiceRecording: () => void;
	handleContentLibraryPick: (file: Content) => void;
	handleConfirmGroupVideoCall: (participantIds: string[]) => void;
	executeConfirmedAction: () => void;
	handleConfirmMessageDelete: () => void;
	handleSaveEditedMessage: () => void;
};

export type GafChatAppWorkspaceProps = {
	m: GafChatAppWorkspaceModel;
};

export function GafChatAppWorkspace({ m }: GafChatAppWorkspaceProps) {
	return (
		<GafChatMessageContextMenuProvider>
			<DesktopProductWorkspace
				id={GAF_CHAT_GUIDE_ROOT_ID}
				className="relative"
				data-testid="gaf-chat-product-workspace"
				header={
					<GafChatAppHeaderToolbar
						shellAppToolbarClass={m.shellAppToolbarClass}
						unreadTotal={m.unreadTotal}
						socketConnected={m.socketConnected}
						onOpenNewChat={() => m.setShowNewChat(true)}
						partner={m.partner}
						chatsError={m.chatsError}
						chatsErrorCode={m.chatsErrorCode}
						chatsErrorDismissed={m.chatsErrorDismissed}
						onRefetchChats={() => {
							void m.refetchChats();
						}}
						onDismissChatsError={() => m.setChatsErrorDismissed(true)}
						onCopyPartnerUsername={m.handleCopyPartnerUsername}
						selectedChatId={m.selectedChatId}
						partnerIsSystemAccount={m.partnerIsSystemAccount}
						e2eeStatus={m.e2eeStatus}
						myUserId={m.myUserId}
						e2eeConsentBusy={m.e2eeConsentBusy}
						onProposeE2ee={m.handleProposeE2ee}
						onAcceptE2ee={m.handleAcceptE2ee}
						onDeclineE2ee={m.handleDeclineE2ee}
						onDisableE2ee={m.handleDisableE2ee}
						onSetupE2eeKeys={m.handleSetupE2eeKeys}
						onStartVideoCall={m.handleStartVideoCall}
						onStartGroupVideoCall={m.handleStartGroupVideoCall}
						startVideoCallPending={m.startVideoCallPending}
						startGroupVideoCallPending={m.startGroupVideoCallPending}
						chatBlocked={m.chatBlocked}
						soundEnabled={m.soundEnabled}
						onToggleSound={m.toggleSound}
						onClearHistory={m.handleClearHistory}
						onArchiveChat={m.handleArchiveChat}
						onDeleteForEveryone={m.handleDeleteForEveryone}
					/>
				}
				contentClassName="overflow-hidden !overflow-y-hidden flex min-h-0 flex-col"
			>
				<div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
					<GafChatSidebarPanel
						shellNavAsideClass={m.shellNavAsideClass}
						shellFrame={m.shellFrame}
						shellSidebarSearchRowClass={m.shellSidebarSearchRowClass}
						shellSidebarSearchInputClass={m.shellSidebarSearchInputClass}
						sidebarCollapsed={m.sidebarCollapsed}
						sidebarCollapsePersisting={m.sidebarCollapsePersisting}
						toggleSidebarCollapsed={m.toggleSidebarCollapsed}
						sidebarSearchInputRef={m.sidebarSearchInputRef}
						searchQuery={m.searchQuery}
						onSearchQueryChange={m.setSearchQuery}
						sidebarFilter={m.sidebarFilter}
						onSidebarFilterChange={m.setSidebarFilter}
						chatsLoading={m.chatsLoading}
						chatsError={m.chatsError}
						chats={m.chats}
						filteredChats={m.filteredChats}
						selectedChatId={m.selectedChatId}
						onSelectChat={m.handleSelectChat}
						chatListRowRefs={m.chatListRowRefs}
						pinnedChatIds={m.pinnedChatIds}
						onTogglePin={m.handleTogglePin}
						onPrefetchThread={m.prefetchChatMessages}
						onRefetchChats={() => {
							void m.refetchChats();
						}}
					/>
					<GafChatMainColumnChrome
						shellMainColumnClass={m.shellMainColumnClass}
						gafPortalRoot={m.gafPortalRoot}
						setGafPortalRoot={m.setGafPortalRoot}
						selectedChatId={m.selectedChatId}
						resolvingInitialUsername={m.resolvingInitialUsername}
						openingChatTimedOut={m.openingChatTimedOut}
						onRetryOpenChat={m.handleRetryOpenChat}
						activeThreadContent={
							<>
								<GafChatThreadPanel
									shellFrame={m.shellFrame}
									selectedChatId={m.selectedChatId ?? ''}
									partner={m.partner}
									chatMuted={m.chatMuted}
									chatBlocked={m.chatBlocked}
									threadPrefs={m.threadPrefs}
									onThreadPrefsChange={m.handleThreadPrefsChange}
									showE2eeReadinessBanner={m.showE2eeReadinessBanner}
									e2eeStatusValue={m.e2eeStatus?.status}
									e2eeActive={m.e2eeActive}
									onSetupE2eeKeys={m.handleSetupE2eeKeys}
									onDismissE2eeReadinessBanner={m.onDismissE2eeReadinessBanner}
									messageListRef={m.messageListRef}
									loadMoreSentinelRef={m.loadMoreSentinelRef}
									onMessageListScroll={m.updateMessageListScrollUi}
									showScrollDown={m.showScrollDown}
									onScrollToBottom={m.scrollMessagesToBottom}
									messagesLoading={m.messagesLoading}
									messagesError={m.messagesError}
									messagesErrorDismissed={m.messagesErrorDismissed}
									messagesQueryError={m.messagesQueryError}
									onRefetchMessages={() => void m.refetchMessages()}
									onDismissMessagesError={() =>
										m.setMessagesErrorDismissed(true)
									}
									messages={m.messages}
									messageById={m.messageById}
									hasNextPage={m.hasNextPage}
									isFetchingNextPage={m.isFetchingNextPage}
									onLoadOlder={m.handleLoadOlder}
									myUserId={m.myUserId}
									meLabel={m.meLabel}
									partnerLastReadIndex={m.partnerLastReadIndex}
									threadSearchQuery={m.threadSearchQuery}
									onThreadSearchQueryChange={m.setThreadSearchQuery}
									threadSearchInputRef={m.threadSearchInputRef}
									threadSearchTrimmed={m.threadSearchTrimmed}
									threadMatchIds={m.threadMatchIds}
									threadMatchIndex={m.threadMatchIndex}
									onPrevThreadMatch={m.goPrevThreadMatch}
									onNextThreadMatch={m.goNextThreadMatch}
									scrollToMessageId={m.scrollToMessageId}
									onConsumedScrollToMessage={m.onConsumedScrollToMessage}
									onCopyPlainText={m.handleCopyMessagePlainText}
									onAcceptAttachment={m.handleAcceptIncomingAttachment}
									acceptBusyMessageId={m.acceptBusyMessageId}
									onReply={m.handleReply}
									onJumpToMessage={m.handleJumpToMessage}
									onEditMessage={m.handleOpenEditMessage}
									onDeleteMessageForMe={m.handleMessageDeleteForMe}
									onDeleteMessageForEveryone={m.handleMessageDeleteForEveryone}
								/>
								<GafChatComposerCluster
									composerLocked={m.composerLocked}
									chatBlocked={m.chatBlocked}
									e2eeActive={m.e2eeActive}
									partnerIsSystemAccount={m.partnerIsSystemAccount}
									shellComposerFormClass={m.shellComposerFormClass}
									shellComposerTextareaClass={m.shellComposerTextareaClass}
									shellComposerHintRowClass={m.shellComposerHintRowClass}
									composerDragOver={m.composerDragOver}
									selectedChatId={m.selectedChatId}
									localAttachInputRef={m.localAttachInputRef}
									inputRef={m.inputRef}
									inputText={m.inputText}
									onInputTextChange={m.setInputText}
									onSend={m.handleSend}
									onComposerDragEnter={m.handleComposerDragEnter}
									onComposerDragLeave={m.handleComposerDragLeave}
									onComposerDragOver={m.handleComposerDragOver}
									onComposerDrop={m.handleComposerDrop}
									onComposerPaste={m.handleComposerPaste}
									onPickLocalFile={m.handlePickLocalFile}
									replyingTo={m.replyingTo}
									onClearReply={() => m.setReplyingTo(null)}
									pendingAttachments={m.pendingAttachments}
									onRemovePendingAttachment={(contentId) =>
										m.setPendingAttachments((prev) =>
											prev.filter((x) => x.contentId !== contentId)
										)
									}
									threadPrefs={m.threadPrefs}
									isVoiceRecording={m.isVoiceRecording}
									isVoiceRecordingSupported={m.isVoiceRecordingSupported}
									voiceElapsedSec={m.voiceElapsedSec}
									onCancelVoiceRecording={m.cancelVoiceRecording}
									onBeginVoiceRecording={m.beginVoiceRecording}
									onFinishVoiceRecording={m.finishVoiceRecording}
									attachmentUploading={m.attachmentUploading}
									attachmentUploadPercent={m.attachmentUploadPercent}
									sendPending={m.sendMutation.isPending}
									sendError={
										m.sendMutation.isError ? m.sendMutation.error : null
									}
									sendVariables={m.sendMutation.variables}
									onRetrySend={() => {
										const vars = m.sendMutation.variables;
										m.sendMutation.reset();
										if (vars) m.sendMutation.mutate(vars);
									}}
									onDismissSendError={() => m.sendMutation.reset()}
									isGafAdmin={m.isGafAdmin}
									onOpenContentLibraryPicker={() =>
										m.setShowContentLibraryPicker(true)
									}
									onOpenAdminAppLinkPicker={() =>
										m.setShowAdminAppLinkPicker(true)
									}
								/>
							</>
						}
					/>
				</div>
			</DesktopProductWorkspace>
			<GafChatModalsCluster
				showNewChat={m.showNewChat}
				onCloseNewChat={() => m.setShowNewChat(false)}
				onSelectNewChat={(chatId) => {
					m.setSelectedChatId(chatId);
					void m.queryClient.invalidateQueries({
						queryKey: gafChatQueryKeys.chats,
					});
					m.setShowNewChat(false);
				}}
				searchUsersFn={searchUsers}
				getOrCreateChatByUsernameFn={getOrCreateChatByUsername}
				toastApi={m.toastApi}
				showContentLibraryPicker={m.showContentLibraryPicker}
				onCloseContentLibraryPicker={() => m.setShowContentLibraryPicker(false)}
				onContentLibraryPick={m.handleContentLibraryPick}
				groupCallPickerOpen={m.groupCallPickerOpen}
				onCloseGroupCallPicker={() => m.setGroupCallPickerOpen(false)}
				onConfirmGroupVideoCall={m.handleConfirmGroupVideoCall}
				groupCallLockedParticipantIds={m.partner?.id ? [m.partner.id] : []}
				groupCallSubmitting={m.groupCallSubmitting}
				showAdminAppLinkPicker={m.showAdminAppLinkPicker}
				selectedChatId={m.selectedChatId}
				onCloseAdminAppLinkPicker={() => m.setShowAdminAppLinkPicker(false)}
				onAdminAppLinkSent={() => {
					void m.queryClient.invalidateQueries({
						queryKey: gafChatQueryKeys.messages(m.selectedChatId ?? ''),
					});
				}}
				confirmKind={m.confirmKind}
				onCloseConfirm={() => m.setConfirmKind(null)}
				onConfirmAction={m.executeConfirmedAction}
				messageDeleteConfirm={m.messageDeleteConfirm}
				onCloseMessageDeleteConfirm={() => m.setMessageDeleteConfirm(null)}
				onConfirmMessageDelete={m.handleConfirmMessageDelete}
				editingMessage={m.editingMessage}
				editDraft={m.editDraft}
				onEditDraftChange={m.setEditDraft}
				onCloseEditMessage={() => {
					m.setEditingMessage(null);
					m.setEditDraft('');
				}}
				editMessageTextareaRef={m.editMessageTextareaRef}
				editMessageHintId={m.editMessageHintId}
				shellComposerTextareaClass={m.shellComposerTextareaClass}
				editSavePending={m.editSavePending}
				onSaveEditedMessage={m.handleSaveEditedMessage}
				guideOpen={m.guideOpen}
				onCloseGuide={() => m.setGuideOpen(false)}
				guideSteps={m.guideSteps}
				guideLabels={m.guideLabels}
				guideAudioLocalStorageKey={m.guideAudioLocalStorageKey}
				guideTourAudioFolder={m.guideTourAudioFolder}
			/>
		</GafChatMessageContextMenuProvider>
	);
}
