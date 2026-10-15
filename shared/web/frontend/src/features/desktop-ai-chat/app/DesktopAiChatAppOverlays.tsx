/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Overlay modals for Desktop AI Chat (picker, dossier, guide, members, confirms).
 *
 * Invariants:
 * - Delete-chat confirm copy stays on this surface (not the main column).
 *
 * Related:
 * - components/DesktopAiChatModals.tsx, DesktopAiChatAppView.tsx
 */
import * as React from 'react';
import { UserMinusIcon } from '@heroicons/react/24/outline';
import { ConfirmDeleteModal } from '@/components/ui/modals/ConfirmDeleteModal';
import { DeleteConfirmModal } from '@/pages/MarketingCabinet/components/DeleteConfirmModal';
import { DesktopAiChatGuideModal } from '../DesktopAiChatGuideModal';
import { DesktopEnsembleBlueprintCommandsModal } from '../DesktopEnsembleBlueprintCommandsModal';
import { DesktopAiHeroDossierModal } from '../DesktopAiHeroDossierModal';
import { DesktopAiChatBubbleContextMenu } from '../components/DesktopAiChatBubbleContextMenu';
import { DesktopAiChatMembersPanel } from '../components/DesktopAiChatMembersPanel';
import { DesktopAiChatModals } from '../components/DesktopAiChatModals';
import { DiscussionSetupHost } from '../discussion';
import { getDesktopAiHero } from '../desktopAiHeroes';
import type { DesktopAiChatAppComposeResult } from './useDesktopAiChatAppCompose';

type DesktopAiChatAppOverlaysProps = {
	vm: DesktopAiChatAppComposeResult;
};

export function DesktopAiChatAppOverlays({
	vm,
}: DesktopAiChatAppOverlaysProps): React.ReactElement {
	const {
		t,
		solo,
		embeddedModalZ,
		soloSlotStackedModalZ,
		ensembleSelectedIds,
		setEnsembleSelectedIds,
		toggleEnsembleHeroPick,
		defaultEnsembleHeroIds,
		activeId,
		lucideStroke,
		bubbleCtxMenu,
		setBubbleCtxMenu,
		chatGuideMountKey,
		chatGuideOpen,
		setChatGuideOpen,
		prepareChatGuideStep,
		headerCollapsed,
		settings,
		ensemblePlanCommandsOpen,
		setEnsemblePlanCommandsOpen,
		ensemblePlanCommands,
		ensemblePlanCommandsLoading,
		ensemblePlanCommandsErr,
		discussionNav,
		discussion,
		ensembleRosterHeroes,
		heroDossierOpen,
		setHeroDossierOpen,
		setDossierHeroId,
		heroIdForDossier,
		assistantHeaderLabel,
		toolsHint,
		resolvedModelLabel,
		collab,
		activeChat,
		retryListLoad,
		deleteChatConfirmOpen,
		setDeleteChatConfirmOpen,
		deleteChatBusy,
		handleDeleteChat,
		userMessageDeleteTarget,
		setUserMessageDeleteTarget,
		userMessageDeleteLoading,
		pendingUserMessageDeleteCount,
		truncateUserMessageConfirmed,
	} = vm;

	return (
		<>
			<DesktopAiChatModals
				heroPickerOpen={solo.heroPickerOpen}
				heroDialogRef={solo.heroDialogRef}
				embeddedModalZ={embeddedModalZ}
				soloSlotStackedModalZ={soloSlotStackedModalZ}
				newChatKind={solo.newChatKind}
				setNewChatKind={solo.setNewChatKind}
				newChatSoloStep={solo.newChatSoloStep}
				setNewChatSoloStep={solo.setNewChatSoloStep}
				pickedHeroId={solo.pickedHeroId}
				setPickedHeroId={solo.setPickedHeroId}
				ensembleSelectedIds={ensembleSelectedIds}
				setEnsembleSelectedIds={setEnsembleSelectedIds}
				toggleEnsembleHeroPick={toggleEnsembleHeroPick}
				defaultEnsembleHeroIds={defaultEnsembleHeroIds}
				newChatSoloDuration={solo.newChatSoloDuration}
				setNewChatSoloDuration={solo.setNewChatSoloDuration}
				newChatSoloSelectedEnergy={solo.newChatSoloSelectedEnergy}
				newChatCreateBusy={solo.newChatCreateBusy}
				soloSlotTariffs={solo.soloSlotTariffs}
				ugsCreditsBalance={solo.ugsCreditsBalance}
				memoryCellsForPicker={solo.memoryCellsForPicker}
				pickedMemoryCellId={solo.pickedMemoryCellId}
				setPickedMemoryCellId={solo.setPickedMemoryCellId}
				onCloseHeroPicker={() => {
					solo.setHeroPickerOpen(false);
					solo.setNewChatSoloStep('pick');
				}}
				onConfirmNewChat={solo.confirmNewChatWithHero}
				soloSlotModalOpen={solo.soloSlotModalOpen}
				activeId={activeId}
				soloSlotStep={solo.soloSlotStep}
				setSoloSlotStep={solo.setSoloSlotStep}
				soloSlotDuration={solo.soloSlotDuration}
				setSoloSlotDuration={solo.setSoloSlotDuration}
				soloSlotHeroPick={solo.soloSlotHeroPick}
				setSoloSlotHeroPick={solo.setSoloSlotHeroPick}
				soloSlotSelectedEnergy={solo.soloSlotSelectedEnergy}
				soloSlotPurchaseBusy={solo.soloSlotPurchaseBusy}
				onCloseSoloSlotModal={() => {
					solo.setSoloSlotModalOpen(false);
					solo.setSoloSlotStep('pick');
				}}
				onPurchaseSoloSlot={solo.purchaseSoloSlot}
				lucideStroke={lucideStroke}
				t={t}
			/>
			<DesktopAiChatBubbleContextMenu
				open={bubbleCtxMenu !== null}
				payload={bubbleCtxMenu}
				onClose={() => setBubbleCtxMenu(null)}
			/>
			<DesktopAiChatGuideModal
				key={chatGuideMountKey}
				open={chatGuideOpen}
				onClose={() => setChatGuideOpen(false)}
				onPrepareStep={prepareChatGuideStep}
				spotlightLayoutKey={headerCollapsed ? 'collapsed' : 'expanded'}
				voiceEnabled={settings.voice_enabled !== false}
			/>
			<DesktopEnsembleBlueprintCommandsModal
				open={ensemblePlanCommandsOpen}
				onClose={() => setEnsemblePlanCommandsOpen(false)}
				items={ensemblePlanCommands}
				loading={ensemblePlanCommandsLoading}
				error={ensemblePlanCommandsErr}
			/>
			<DiscussionSetupHost
				openForActiveChat={discussionNav.openForActiveChat}
				onClose={discussionNav.closeDiscussionSetup}
				presets={discussion.presets}
				rosterOptions={ensembleRosterHeroes.map((h) => h.id)}
				busy={discussion.busy}
				displayNameHint={discussion.participantDisplayName}
				initialRoleTitle={discussion.preferredRoleTitle}
				errorMessage={
					discussion.error === 'discussion_already_active_for_account'
						? t('discussionAlreadyActiveForAccount')
						: discussion.error === 'discussion_already_active'
							? t('discussionAlreadyActiveInChat')
							: discussion.error
				}
				onStart={async (input) => {
					const next = await discussion.start(input);
					if (next) discussionNav.closeDiscussionSetup();
					return next;
				}}
				switchConfirmOpen={discussionNav.discussionSwitchConfirmOpen}
				onSwitchConfirmClose={discussionNav.onSwitchConfirmClose}
				onSwitchConfirm={discussionNav.confirmDiscussionSwitchChat}
			/>
			<DesktopAiHeroDossierModal
				open={heroDossierOpen}
				onClose={() => {
					setDossierHeroId(null);
					setHeroDossierOpen(false);
				}}
				hero={getDesktopAiHero(heroIdForDossier ?? undefined) ?? null}
				fallbackTitle={assistantHeaderLabel}
				toolsEnvironmentLine={toolsHint}
				modelLabel={resolvedModelLabel}
				heroPromptVersion={
					getDesktopAiHero(heroIdForDossier ?? undefined)?.promptVersion ?? null
				}
			/>
			<ConfirmDeleteModal
				isOpen={collab.leaveConfirmOpen}
				onClose={() => {
					if (!collab.leaveBusy) collab.setLeaveConfirmOpen(false);
				}}
				onConfirm={collab.handleLeaveChat}
				title={t('collabLeaveConfirmTitle')}
				itemName={activeChat?.title || t('defaultChatTitle')}
				warningMessage={t('collabLeaveConfirmBody')}
				confirmButtonLabel={t('collabLeaveConfirmButton')}
				confirmButtonLoadingLabel={t('collabLeaveConfirmLoading')}
				cancelButtonLabel={t('cancel')}
				isDangerous
				confirmIcon={
					<UserMinusIcon
						className="size-4.5"
						aria-hidden
						strokeWidth={lucideStroke}
					/>
				}
			/>
			<DesktopAiChatMembersPanel
				open={collab.membersPanelOpen}
				onClose={() => collab.setMembersPanelOpen(false)}
				activeChat={activeChat}
				embeddedModalZ={embeddedModalZ}
				onMembersChanged={retryListLoad}
				lucideStroke={lucideStroke}
				t={t}
			/>
			<ConfirmDeleteModal
				isOpen={deleteChatConfirmOpen}
				onClose={() => {
					if (!deleteChatBusy) setDeleteChatConfirmOpen(false);
				}}
				onConfirm={handleDeleteChat}
				title={t('deleteChatConfirmTitle')}
				itemName={activeChat?.title || t('defaultChatTitle')}
				warningMessage={t('deleteChatConfirmBody')}
				confirmButtonLabel={t('deleteChatConfirmButton')}
				confirmButtonLoadingLabel={t('deleteChatConfirmLoading')}
				cancelButtonLabel={t('cancel')}
				isDangerous
			/>
			<ConfirmDeleteModal
				isOpen={solo.releaseConsultantModalOpen}
				onClose={() => {
					if (!solo.releaseConsultantBusy) {
						solo.setReleaseConsultantModalOpen(false);
					}
				}}
				onConfirm={solo.performReleaseConsultant}
				title={t('soloSlotReleaseModalTitle')}
				warningMessage={t('soloSlotReleaseConfirm')}
				confirmButtonLabel={t('soloSlotReleaseModalConfirm')}
				confirmButtonLoadingLabel={t('soloSlotReleaseModalDeleting')}
				cancelButtonLabel={t('cancel')}
				confirmIcon={
					<UserMinusIcon
						className="size-4.5"
						aria-hidden
						strokeWidth={lucideStroke}
					/>
				}
			/>
			<DeleteConfirmModal
				isOpen={userMessageDeleteTarget !== null}
				title={t('deleteMessagesTitle')}
				message={[
					t('deleteMessagesBody1'),
					t('deleteMessagesBodyCount', {
						count: pendingUserMessageDeleteCount,
					}),
					t('deleteMessagesBodyFinal'),
				].join('\n\n')}
				confirmLabel={t('deleteMessagesConfirm')}
				cancelLabel={t('cancel')}
				pendingLabel={t('deleteMessagesPending')}
				onConfirm={() => void truncateUserMessageConfirmed()}
				onCancel={() => {
					if (!userMessageDeleteLoading) setUserMessageDeleteTarget(null);
				}}
				isLoading={userMessageDeleteLoading}
			/>
		</>
	);
}
