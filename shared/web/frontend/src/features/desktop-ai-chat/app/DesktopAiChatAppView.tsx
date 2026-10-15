/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shell JSX for Desktop AI Chat: sidebar, main column, and composer.
 * Overlay modals and Discussion Process dock live in sibling files.
 *
 * Invariants:
 * - Journey region order: sidebar → messages → composer (guide anchors in child components).
 *
 * Related:
 * - useDesktopAiChatAppCompose.ts, DesktopAiChatAppOverlays.tsx,
 *   DesktopAiChatAppDiscussionDock.tsx
 */
import * as React from 'react';
import { toast } from 'sonner';
import { DESKTOP_INTERACTIVE } from '../../../pages/Desktop/constants';
import { DesktopProductStatusBanner } from '../../../pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_AI_CHAT_ROOT_ID } from '../DesktopAiChatGuideModal';
import { DesktopAiChatSidebar } from '../components/DesktopAiChatSidebar';
import { DesktopAiChatMainHeader } from '../components/DesktopAiChatMainHeader';
import { DesktopAiChatSettingsRail } from '../components/DesktopAiChatSettingsRail';
import { DesktopAiChatContextBar } from '../components/DesktopAiChatContextBar';
import { DesktopAiChatMessagesPane } from '../components/DesktopAiChatMessagesPane';
import { DesktopAiChatStreamStatus } from '../components/DesktopAiChatStreamStatus';
import { DesktopAiChatComposer } from '../components/DesktopAiChatComposer';
import { DesktopAiChatStatePanel } from '../layout/DesktopAiChatStatePanel';
import {
	DESKTOP_AI_CHAT_COMPOSER_ID,
	DESKTOP_AI_CHAT_COMPOSER_OFFLINE_DESC_ID,
	DESKTOP_AI_CHAT_COMPOSER_TESTID,
	DESKTOP_AI_CHAT_COMPOSER_TEXTAREA_ID,
	DESKTOP_AI_CHAT_COMPOSER_TEXTAREA_TESTID,
	DESKTOP_AI_CHAT_MESSAGES_ID,
	DESKTOP_AI_CHAT_MESSAGES_TESTID,
} from '../desktopAiChatDomIds';
import { persistChatDraft } from '../utils/desktopAiChatDraft';
import { isPersistedDesktopAiMessageId } from '../utils/desktopAiChatMessageIds';
import { buildInterviewDiscussionStartInput } from '../discussion/interviewHandoff';
import { discussionBlocksNormalChatSend } from '../discussion/discussionControls';
import type { DesktopAiMessage } from '../api/desktopChatClient';
import { DesktopAiChatAppDiscussionDock } from './DesktopAiChatAppDiscussionDock';
import { DesktopAiChatAppOverlays } from './DesktopAiChatAppOverlays';
import type { DesktopAiChatAppComposeResult } from './useDesktopAiChatAppCompose';

type DesktopAiChatAppViewProps = {
	vm: DesktopAiChatAppComposeResult;
};

export function DesktopAiChatAppView({
	vm,
}: DesktopAiChatAppViewProps): React.ReactElement {
	const {
		t,
		i18n,
		surfaceRef,
		isCompactSurface,
		isDenseSurface,
		shellTheme,
		lowGpu,
		shellClass,
		featureOn,
		shellNavAsideClass,
		shellMessagesPanelClass,
		shellComposerDockClass,
		shellComposerTextareaClass,
		shellComposerIconBtnClass,
		shellHeaderBarClusterClass,
		shellChatSearchInputClass,
		shellNewChatBtnClass,
		shellComposerStopBtnClass,
		shellHeaderCollapseBtnClass,
		settings,
		chats,
		chatFilter,
		setChatFilter,
		activeId,
		setActiveId,
		activeChat,
		loadingList,
		listLoadState,
		retryListLoad,
		chatPins,
		titleDraft,
		setTitleDraft,
		titleEditChatId,
		setTitleEditChatId,
		filteredChats,
		togglePinChat,
		saveChatTitle,
		cancelTitleEdit,
		useProjectRag,
		setUseProjectRag,
		projectId,
		projectMenuOpen,
		setProjectMenuOpen,
		projectQuery,
		setProjectQuery,
		projectMenuRef,
		projectSearchInputRef,
		filteredProjects,
		selectedProjectName,
		applyProjectBinding,
		input,
		setInput,
		sending,
		messages,
		messagesTotal,
		messagesLoading,
		messagesLoadState,
		retryLoadMessages,
		messagesLoadingOlder,
		messageListEntries,
		showLoadOlderMessages,
		handleLoadOlderMessages,
		scrollRef,
		showScrollDown,
		attachments,
		attachRef,
		onAttach,
		onDropFiles,
		onDragOverFiles,
		isEnsembleActive,
		ensembleRosterHeroes,
		ensembleRosterSubtitle,
		ensembleRoutingMode,
		ensembleRoutingModeLabel,
		ensembleRoutingMenuRef,
		ensembleRoutingMenuOpen,
		setEnsembleRoutingMenuOpen,
		ensembleDocConfirm,
		ensembleRoutingBusy,
		setEnsemblePlanCommandsOpen,
		loadEnsemblePlanCommands,
		applyEnsembleRoutingMode,
		openEnsembleRoutingMenu,
		assistantHeaderLabel,
		activeHeroId,
		soloSendsBlocked,
		soloCanReleaseConsultant,
		solo,
		headerCollapsed,
		setPanelPref,
		consumeWebSearchArm,
		useTools,
		useWebSearch,
		voiceIn,
		voiceOut,
		voiceAllowed,
		activeHeroAvatarPath,
		toolsHint,
		handleSend,
		handleRegenerate,
		handleEnsembleDocumentConfirm,
		handleStopStream,
		handleRetryLastStream,
		sttBusy,
		ttsBusy,
		sttMic,
		sttLevelMeterRef,
		toolsHistory,
		streamErrorBanner,
		streamLockClearBusy,
		composerHint,
		ensembleCouncilUi,
		saveBlueprintToProjectBusyId,
		setBubbleCtxMenu,
		setHeroDossierOpen,
		setDossierHeroId,
		setChatGuideOpen,
		setChatGuideMountKey,
		networkOnline,
		discussion,
		discussionNav,
		lucideStroke,
		setUserMessageDeleteTarget,
		webSearchSourcesByMessageId,
		sttCancelNextBlobRef,
		chatCapabilities,
		currentUserId,
		collab,
		streamLockStatusHint,
		toggleHeaderCollapsed,
		handleClearStreamLock,
		requestDeleteChat,
		requestExtractMemoryCell,
		focusComposer,
		handleExportMd,
		handleExportAssistantMarkdown,
		handleSaveBlueprintToProject,
		handleMicStt,
		copyBubble,
		onMessagesScroll,
		scrollMessagesToBottom,
	} = vm;

	const handleStartInterviewFromMessage = React.useCallback(
		async (message: DesktopAiMessage) => {
			if (!activeId || discussion.busy) return;
			if (discussion.controls.finish) {
				toast.error(t('discussionAlreadyActiveInChat'));
				return;
			}
			if (!isPersistedDesktopAiMessageId(message.id)) return;
			const chatEnsembleIds = Array.isArray(
				activeChat?.settings?.desktop_ensemble_ids
			)
				? (activeChat.settings.desktop_ensemble_ids as string[])
				: [];
			const input = buildInterviewDiscussionStartInput(
				message,
				chatEnsembleIds
			);
			if (!input) return;
			const next = await discussion.start(input);
			if (next) toast.success(t('interviewStartedToast'));
			else toast.error(t('interviewStartFailed'));
		},
		[activeId, activeChat?.settings, discussion, t]
	);

	if (!featureOn) {
		return (
			<div
				className={`${shellClass(shellTheme)} items-center justify-center p-6`}
			>
				<DesktopAiChatStatePanel
					state="permissionDenied"
					title={t('featureDisabledPanel.title')}
					description={t('featureDisabledPanel.description')}
					className="min-h-0 w-full max-w-md"
				/>
			</div>
		);
	}

	return (
		<div
			id={DESKTOP_AI_CHAT_ROOT_ID}
			ref={surfaceRef}
			className={`${shellClass(shellTheme)} text-(--desktop-text-primary)`}
		>
			<div
				className={`flex min-h-0 flex-1 overflow-x-hidden ${
					isCompactSurface ? 'flex-col' : 'flex-col lg:flex-row'
				}`}
			>
				<DesktopAiChatSidebar
					filteredChats={filteredChats}
					loadingList={loadingList}
					listLoadState={listLoadState}
					onRetryListLoad={retryListLoad}
					activeId={activeId}
					chatPins={chatPins}
					titleEditChatId={titleEditChatId}
					titleDraft={titleDraft}
					setTitleDraft={setTitleDraft}
					setActiveId={setActiveId}
					setTitleEditChatId={setTitleEditChatId}
					saveChatTitle={saveChatTitle}
					cancelTitleEdit={cancelTitleEdit}
					togglePinChat={togglePinChat}
					onOpenHeroPicker={solo.openHeroPicker}
					chatFilter={chatFilter}
					setChatFilter={setChatFilter}
					shellNavAsideClass={shellNavAsideClass}
					shellNewChatBtnClass={shellNewChatBtnClass}
					shellChatSearchInputClass={shellChatSearchInputClass}
					isCompactSurface={isCompactSurface}
					shellTheme={shellTheme}
					lucideStroke={lucideStroke}
					pendingInvites={collab.pendingInvites}
					pendingInvitesLoading={collab.pendingInvitesLoading}
					inviteActionBusyId={collab.inviteActionBusyId}
					onAcceptInvite={collab.handleAcceptInvite}
					onDeclineInvite={collab.handleDeclineInvite}
					currentUserId={currentUserId}
					t={t}
				/>
				<main
					className={`relative flex min-h-0 min-w-0 flex-1 flex-col ${
						isDenseSurface ? 'm-2 gap-2' : 'm-3 gap-3'
					}`}
					aria-label={t('chatMainLandmark')}
					onDrop={onDropFiles}
					onDragOver={onDragOverFiles}
				>
					{!networkOnline ? (
						<DesktopProductStatusBanner
							tone="warning"
							title={t('offlineBannerTitle')}
							description={t('offlineBanner')}
							className="rounded-lg"
						/>
					) : null}
					<a
						href={`#${DESKTOP_AI_CHAT_MESSAGES_ID}`}
						className={`sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 rounded-xl px-3 py-2 text-xs outline-none ${DESKTOP_INTERACTIVE.btnPrimary}`}
					>
						{t('skipToMessages')}
					</a>
					<header className="relative flex min-w-0 flex-col gap-1 px-1">
						<DesktopAiChatMainHeader
							isCompactSurface={isCompactSurface}
							shellHeaderBarClusterClass={shellHeaderBarClusterClass}
							shellHeaderCollapseBtnClass={shellHeaderCollapseBtnClass}
							isEnsembleActive={isEnsembleActive}
							ensembleRosterHeroes={ensembleRosterHeroes}
							assistantHeaderLabel={assistantHeaderLabel}
							ensembleRosterSubtitle={ensembleRosterSubtitle}
							activeHeroAvatarPath={activeHeroAvatarPath}
							activeChat={activeChat}
							currentUserId={currentUserId}
							soloSlotCountdownLabel={solo.soloSlotCountdownLabel}
							soloCanReleaseConsultant={soloCanReleaseConsultant}
							releaseConsultantBusy={solo.releaseConsultantBusy}
							sending={sending}
							headerCollapsed={headerCollapsed}
							activeId={activeId}
							messagesCount={messages.length}
							onOpenRosterHeroDossier={(heroId) => {
								setDossierHeroId(heroId);
								setHeroDossierOpen(true);
							}}
							onOpenHeroDossier={() => {
								setDossierHeroId(activeHeroId);
								setHeroDossierOpen(true);
							}}
							onOpenReleaseConsultantModal={() =>
								solo.setReleaseConsultantModalOpen(true)
							}
							onOpenEnsemblePlanCommands={() => {
								setEnsemblePlanCommandsOpen(true);
								void loadEnsemblePlanCommands();
							}}
							onOpenDiscussion={discussionNav.openDiscussionSetup}
							onToggleHeaderCollapsed={toggleHeaderCollapsed}
							onExportMd={handleExportMd}
							onDeleteChat={requestDeleteChat}
							onExtractMemoryCell={requestExtractMemoryCell}
							onOpenMembersPanel={() => collab.setMembersPanelOpen(true)}
							onRequestLeaveChat={collab.requestLeaveChat}
							canManageMembers={chatCapabilities.can_manage_members ?? false}
							canLeave={chatCapabilities.can_leave ?? false}
							canDeleteChat={chatCapabilities.can_delete_chat ?? false}
							canExport={chatCapabilities.can_export ?? false}
							onOpenGuide={() => {
								setChatGuideMountKey((k) => k + 1);
								setChatGuideOpen(true);
							}}
							lucideStroke={lucideStroke}
							t={t}
						/>
						{!headerCollapsed ? (
							<div className="flex flex-col gap-1 border-t border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.05)_100%,transparent)] pt-1">
								<DesktopAiChatSettingsRail
									activeChat={activeChat}
									settings={settings}
									useProjectRag={useProjectRag}
									setUseProjectRag={setUseProjectRag}
									projectId={projectId}
									projectMenuRef={projectMenuRef}
									projectMenuOpen={projectMenuOpen}
									setProjectMenuOpen={setProjectMenuOpen}
									projectQuery={projectQuery}
									setProjectQuery={setProjectQuery}
									projectSearchInputRef={projectSearchInputRef}
									filteredProjects={filteredProjects}
									selectedProjectName={selectedProjectName}
									onApplyProjectBinding={applyProjectBinding}
									useTools={useTools}
									useWebSearch={useWebSearch}
									voiceIn={voiceIn}
									voiceOut={voiceOut}
									voiceAllowed={voiceAllowed}
									setPanelPref={setPanelPref}
									toolsHint={toolsHint}
									isEnsembleActive={isEnsembleActive}
									ensembleRoutingMenuRef={ensembleRoutingMenuRef}
									ensembleRoutingMenuOpen={ensembleRoutingMenuOpen}
									ensembleRoutingMode={ensembleRoutingMode}
									ensembleRoutingModeLabel={ensembleRoutingModeLabel}
									ensembleRoutingBusy={ensembleRoutingBusy}
									onEnsembleRoutingToggle={openEnsembleRoutingMenu}
									onEnsembleRoutingSelect={(mode) => {
										void applyEnsembleRoutingMode(mode);
									}}
									onCloseEnsembleRoutingMenu={() =>
										setEnsembleRoutingMenuOpen(false)
									}
									canPatchSettings={
										chatCapabilities.can_patch_settings ?? false
									}
									canManageProject={
										chatCapabilities.can_manage_project ?? false
									}
									lucideStroke={lucideStroke}
									t={t}
								/>
							</div>
						) : null}
					</header>
					<DesktopAiChatContextBar
						activeChat={activeChat}
						activeId={activeId}
						attachments={attachments}
						selectedProjectName={selectedProjectName}
						lucideStroke={lucideStroke}
						t={t}
					/>
					<DesktopAiChatMessagesPane
						scrollRef={scrollRef}
						messagesRegionId={DESKTOP_AI_CHAT_MESSAGES_ID}
						messagesTestId={DESKTOP_AI_CHAT_MESSAGES_TESTID}
						shellMessagesPanelClass={shellMessagesPanelClass}
						showLoadOlderMessages={showLoadOlderMessages}
						messages={messages}
						messagesTotal={messagesTotal}
						messagesLoadingOlder={messagesLoadingOlder}
						onLoadOlderMessages={handleLoadOlderMessages}
						loadingList={loadingList}
						activeId={activeId}
						chatsCount={chats.length}
						messagesLoading={messagesLoading}
						messagesLoadState={messagesLoadState}
						onRetryLoadMessages={retryLoadMessages}
						sending={sending}
						streamLockHeldByOther={collab.lockedByOther}
						isEnsembleActive={isEnsembleActive}
						ensembleRosterSubtitle={ensembleRosterSubtitle}
						messageListEntries={messageListEntries}
						activeChat={activeChat}
						activeHeroId={activeHeroId}
						assistantHeaderLabel={assistantHeaderLabel}
						ensembleDocConfirm={ensembleDocConfirm}
						soloSendsBlocked={soloSendsBlocked}
						canRegenerate={chatCapabilities.can_regenerate ?? false}
						canDeleteMessages={chatCapabilities.can_delete_messages ?? false}
						isSharedChat={activeChat?.is_shared === true}
						currentUserId={currentUserId}
						ensembleActiveSpeakerId={ensembleCouncilUi?.active_speaker_id}
						webSearchSourcesByMessageId={webSearchSourcesByMessageId}
						saveBlueprintToProjectBusyId={saveBlueprintToProjectBusyId}
						showScrollDown={showScrollDown}
						lowGpu={lowGpu}
						onMessagesScroll={onMessagesScroll}
						scrollMessagesToBottom={scrollMessagesToBottom}
						onRegenerate={handleRegenerate}
						onCopyBubble={copyBubble}
						onDeleteUserMessage={setUserMessageDeleteTarget}
						onSaveBlueprintToProject={handleSaveBlueprintToProject}
						onStartInterviewFromMessage={handleStartInterviewFromMessage}
						interviewStartBusy={
							discussion.busy ||
							Boolean(discussion.controls.finish) ||
							!networkOnline
						}
						onExportAssistantMarkdown={handleExportAssistantMarkdown}
						onOpenBubbleHeroDossier={(heroId) => {
							setDossierHeroId(heroId);
							setHeroDossierOpen(true);
						}}
						onBubbleContextMenu={setBubbleCtxMenu}
						i18nLanguage={i18n.language}
						lucideStroke={lucideStroke}
						onOpenNewChat={solo.openHeroPicker}
						onFocusComposer={focusComposer}
						t={t}
					/>
					<DesktopAiChatStreamStatus
						streamErrorBanner={streamErrorBanner}
						streamLockClearBusy={streamLockClearBusy}
						onClearStreamLock={handleClearStreamLock}
						onRetryLastStream={handleRetryLastStream}
						toolsHistory={toolsHistory}
						i18nLanguage={i18n.language}
						lucideStroke={lucideStroke}
						t={t}
					/>
					<DesktopAiChatAppDiscussionDock vm={vm} />
					<DesktopAiChatComposer
						voiceAllowed={voiceAllowed}
						voiceIn={voiceIn}
						sttBusy={sttBusy}
						ttsBusy={ttsBusy}
						sttMic={sttMic}
						isEnsembleActive={isEnsembleActive}
						ensembleCouncilUi={ensembleCouncilUi}
						ensembleDocConfirm={ensembleDocConfirm}
						soloSendsBlocked={
							soloSendsBlocked ||
							discussionBlocksNormalChatSend(discussion.session?.status)
						}
						streamLockHeldByOther={collab.lockedByOther}
						streamLockStatusHint={streamLockStatusHint}
						ugsCreditsBalance={solo.ugsCreditsBalance}
						composerHint={composerHint}
						webSearchArmed={useWebSearch}
						onDisarmWebSearch={consumeWebSearchArm}
						networkOnline={networkOnline}
						sttLevelMeterRef={sttLevelMeterRef}
						composerRegionId={DESKTOP_AI_CHAT_COMPOSER_ID}
						composerTestId={DESKTOP_AI_CHAT_COMPOSER_TESTID}
						composerTextareaId={DESKTOP_AI_CHAT_COMPOSER_TEXTAREA_ID}
						composerTextareaTestId={DESKTOP_AI_CHAT_COMPOSER_TEXTAREA_TESTID}
						composerOfflineDescId={DESKTOP_AI_CHAT_COMPOSER_OFFLINE_DESC_ID}
						shellComposerDockClass={shellComposerDockClass}
						shellComposerTextareaClass={shellComposerTextareaClass}
						shellComposerIconBtnClass={shellComposerIconBtnClass}
						shellComposerStopBtnClass={shellComposerStopBtnClass}
						activeId={activeId}
						input={input}
						onInputChange={(v) => {
							setInput(v);
							if (activeId) persistChatDraft(activeId, v);
						}}
						attachRef={attachRef}
						onAttach={onAttach}
						sending={sending || discussion.busy}
						onSend={() => {
							if (discussion.session && discussion.controls.composerEnabled) {
								const text = input.trim();
								if (!text) return;
								void discussion.interject(text).then((res) => {
									if (res) {
										setInput('');
										if (activeId) persistChatDraft(activeId, '');
									}
								});
								return;
							}
							handleSend();
						}}
						onStopStream={handleStopStream}
						onMicStt={handleMicStt}
						onEnsembleDocumentConfirm={handleEnsembleDocumentConfirm}
						onOpenSoloSlotModal={() => solo.setSoloSlotModalOpen(true)}
						sttCancelNextBlobRef={sttCancelNextBlobRef}
						lucideStroke={lucideStroke}
						t={t}
					/>
				</main>
			</div>
			<DesktopAiChatAppOverlays vm={vm} />
		</div>
	);
}
