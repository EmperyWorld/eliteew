/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * GAF Chat overlay cluster: new chat, confirm dialogs, edit message, content/admin pickers,
 * group video picker, and guided tour modal — all portaled with DESKTOP_Z_INDEX backdrops.
 *
 * Invariants:
 * - Backdrop click closes modal; inner frames stop propagation; z-index from DESKTOP_Z_INDEX only.
 *
 * Related:
 * - src/pages/Desktop/components/GAFChat/GAFChatApp.tsx
 * - documentation/product/GAF-CHAT-DESKTOP-REFERENCE.md §1
 */
import {
	SpotlightGuideModal,
	type SpotlightGuideModalLabels,
	type SpotlightGuideStep,
} from '@/components/guided-tour/SpotlightGuideModal';
import type { Content } from '@/components/UnifiedContent/types';
import { cn } from '@/utils/cn';
import { AnimatePresence, m } from 'framer-motion';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { toast as sonnerToast } from 'sonner';
import {
	DESKTOP_OVERLAY,
	DESKTOP_TYPOGRAPHY,
	DESKTOP_Z_INDEX,
} from '@/pages/Desktop/constants';
import { VideoCallParticipantPickerModal } from '../../VideoCall/VideoCallParticipantPickerModal';
import {
	GAFChatConfirmModal,
	type GAFChatConfirmKind,
} from '../GAFChatConfirmModal';
import { GAF_CHAT_GUIDE_ROOT_ID } from '../gafChatGuideConstants';
import { GafChatDesktopIconTooltip } from '../gafChatDesktopIconTooltip';
import type { GAFMessageItem } from '../types';
import { DesktopAppButton, DesktopAppModalFrame } from '../../DesktopAppChrome';
import { DesktopChromeTooltip } from '../../DesktopChromeTooltip';
import { GAFChatNewChatModal } from './GAFChatNewChatModal';
import { GafChatAdminAppLinkPicker } from './GafChatAdminAppLinkPicker';
import { GafContentLibraryPicker } from './GafContentLibraryPicker';
import type { getOrCreateChatByUsername, searchUsers } from '../api/gafChatApi';
export type GafMessageDeleteConfirm = {
	kind: 'me' | 'everyone';
	messageId: string;
} | null;

export type GafChatModalsClusterProps = {
	showNewChat: boolean;
	onCloseNewChat: () => void;
	onSelectNewChat: (chatId: string) => void;
	searchUsersFn: typeof searchUsers;
	getOrCreateChatByUsernameFn: typeof getOrCreateChatByUsername;
	toastApi: typeof sonnerToast;
	showContentLibraryPicker: boolean;
	onCloseContentLibraryPicker: () => void;
	onContentLibraryPick: (file: Content) => void;
	groupCallPickerOpen: boolean;
	onCloseGroupCallPicker: () => void;
	onConfirmGroupVideoCall: (participantIds: string[]) => void;
	groupCallLockedParticipantIds: string[];
	groupCallSubmitting: boolean;
	showAdminAppLinkPicker: boolean;
	selectedChatId: string | null;
	onCloseAdminAppLinkPicker: () => void;
	onAdminAppLinkSent: () => void;
	confirmKind: GAFChatConfirmKind | null;
	onCloseConfirm: () => void;
	onConfirmAction: () => void;
	messageDeleteConfirm: GafMessageDeleteConfirm;
	onCloseMessageDeleteConfirm: () => void;
	onConfirmMessageDelete: () => void;
	editingMessage: GAFMessageItem | null;
	editDraft: string;
	onEditDraftChange: (value: string) => void;
	onCloseEditMessage: () => void;
	editMessageTextareaRef: RefObject<HTMLTextAreaElement | null>;
	editMessageHintId: string;
	shellComposerTextareaClass: string;
	editSavePending: boolean;
	onSaveEditedMessage: () => void;
	guideOpen: boolean;
	onCloseGuide: () => void;
	guideSteps: SpotlightGuideStep[];
	guideLabels: SpotlightGuideModalLabels;
	guideAudioLocalStorageKey: string;
	guideTourAudioFolder: string;
};

export function GafChatModalsCluster({
	showNewChat,
	onCloseNewChat,
	onSelectNewChat,
	searchUsersFn,
	getOrCreateChatByUsernameFn,
	toastApi,
	showContentLibraryPicker,
	onCloseContentLibraryPicker,
	onContentLibraryPick,
	groupCallPickerOpen,
	onCloseGroupCallPicker,
	onConfirmGroupVideoCall,
	groupCallLockedParticipantIds,
	groupCallSubmitting,
	showAdminAppLinkPicker,
	selectedChatId,
	onCloseAdminAppLinkPicker,
	onAdminAppLinkSent,
	confirmKind,
	onCloseConfirm,
	onConfirmAction,
	messageDeleteConfirm,
	onCloseMessageDeleteConfirm,
	onConfirmMessageDelete,
	editingMessage,
	editDraft,
	onEditDraftChange,
	onCloseEditMessage,
	editMessageTextareaRef,
	editMessageHintId,
	shellComposerTextareaClass,
	editSavePending,
	onSaveEditedMessage,
	guideOpen,
	onCloseGuide,
	guideSteps,
	guideLabels,
	guideAudioLocalStorageKey,
	guideTourAudioFolder,
}: GafChatModalsClusterProps) {
	const { t } = useTranslation('gafChat');

	return (
		<>
			<AnimatePresence>
				{showNewChat ? (
					<m.div
						key="gaf-new-chat"
						className={cn(
							'fixed inset-0 flex items-center justify-center',
							DESKTOP_OVERLAY.backdrop
						)}
						style={{ zIndex: DESKTOP_Z_INDEX.GAF_NEW_CHAT_BACKDROP }}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.15 }}
						onClick={onCloseNewChat}
					>
						<GAFChatNewChatModal
							onClose={onCloseNewChat}
							onSelectChat={onSelectNewChat}
							searchUsers={searchUsersFn}
							getOrCreateChatByUsername={getOrCreateChatByUsernameFn}
							toast={toastApi}
						/>
					</m.div>
				) : null}
			</AnimatePresence>
			<GafContentLibraryPicker
				isOpen={showContentLibraryPicker}
				onClose={onCloseContentLibraryPicker}
				onPick={onContentLibraryPick}
			/>
			<VideoCallParticipantPickerModal
				open={groupCallPickerOpen}
				onClose={onCloseGroupCallPicker}
				onConfirm={onConfirmGroupVideoCall}
				title={t('videoCallGroupPickerTitle')}
				description={t('videoCallGroupPickerDescription')}
				confirmLabel={t('videoCallGroupPickerConfirm')}
				lockedParticipantIds={groupCallLockedParticipantIds}
				submitting={groupCallSubmitting}
				minSelectable={1}
			/>
			<GafChatAdminAppLinkPicker
				isOpen={showAdminAppLinkPicker}
				chatId={selectedChatId}
				onClose={onCloseAdminAppLinkPicker}
				onSent={onAdminAppLinkSent}
			/>
			<AnimatePresence>
				{confirmKind ? (
					<m.div
						key="gaf-confirm"
						className={cn(
							'fixed inset-0 flex items-center justify-center',
							DESKTOP_OVERLAY.backdrop
						)}
						style={{ zIndex: DESKTOP_Z_INDEX.GAF_CONFIRM_BACKDROP }}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.15 }}
						onClick={onCloseConfirm}
					>
						<GAFChatConfirmModal
							kind={confirmKind}
							onClose={onCloseConfirm}
							onConfirm={onConfirmAction}
						/>
					</m.div>
				) : null}
			</AnimatePresence>
			<AnimatePresence>
				{messageDeleteConfirm ? (
					<m.div
						key="gaf-msg-delete"
						className={cn(
							'fixed inset-0 flex items-center justify-center',
							DESKTOP_OVERLAY.backdrop
						)}
						style={{ zIndex: DESKTOP_Z_INDEX.GAF_CONFIRM_BACKDROP }}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.15 }}
						onClick={onCloseMessageDeleteConfirm}
					>
						<GAFChatConfirmModal
							kind={
								messageDeleteConfirm.kind === 'me'
									? 'deleteMessageMe'
									: 'deleteMessageEveryone'
							}
							onClose={onCloseMessageDeleteConfirm}
							onConfirm={onConfirmMessageDelete}
						/>
					</m.div>
				) : null}
			</AnimatePresence>
			<AnimatePresence>
				{editingMessage ? (
					<m.div
						key="gaf-edit-msg"
						className={cn(
							'fixed inset-0 flex items-center justify-center',
							DESKTOP_OVERLAY.backdrop
						)}
						style={{ zIndex: DESKTOP_Z_INDEX.GAF_CONFIRM_BACKDROP }}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.15 }}
						onClick={onCloseEditMessage}
					>
						<DesktopAppModalFrame
							title={t('editMessageModalTitle')}
							onClose={onCloseEditMessage}
							className="max-w-lg"
							onClick={(e) => e.stopPropagation()}
						>
							<div className="flex flex-col gap-3 p-4">
								<div className="relative min-w-0">
									<textarea
										ref={editMessageTextareaRef}
										className={cn(
											shellComposerTextareaClass,
											'min-h-30 resize-y',
											editDraft.length > 0 ? 'pb-7' : ''
										)}
										value={editDraft}
										onChange={(e) => onEditDraftChange(e.target.value)}
										maxLength={2000}
										rows={6}
										aria-label={t('editMessageModalTitle')}
										aria-describedby={editMessageHintId}
										onKeyDown={(e) => {
											if (e.key === 'Escape') {
												e.stopPropagation();
												onCloseEditMessage();
												return;
											}
											if (
												e.key === 'Enter' &&
												(e.ctrlKey || e.metaKey) &&
												!e.nativeEvent.isComposing
											) {
												e.preventDefault();
												onSaveEditedMessage();
											}
										}}
									/>
									{editDraft.length > 0 ? (
										<span
											className={cn(
												'pointer-events-none absolute inset-e-3 bottom-2 tabular-nums text-(--desktop-text-dim)',
												DESKTOP_TYPOGRAPHY.shellMeta10,
												editDraft.length > 1800 ? 'text-amber-400' : ''
											)}
											aria-live="polite"
										>
											{editDraft.length}/2000
										</span>
									) : null}
								</div>
								<p
									id={editMessageHintId}
									className={cn(
										'text-(--desktop-text-dim)',
										DESKTOP_TYPOGRAPHY.shellMeta10
									)}
								>
									{t('editMessageSaveHint')}
								</p>
								<div className="flex flex-wrap justify-end gap-2">
									<DesktopChromeTooltip
										content={t('editMessageCancel')}
										placement="top"
										offsetExtra={4}
									>
										<DesktopAppButton
											type="button"
											variant="neutral"
											onClick={onCloseEditMessage}
										>
											{t('editMessageCancel')}
										</DesktopAppButton>
									</DesktopChromeTooltip>
									<GafChatDesktopIconTooltip content={t('editMessageSave')}>
										<DesktopAppButton
											type="button"
											variant="accent"
											disabled={editSavePending}
											onClick={onSaveEditedMessage}
										>
											{t('editMessageSave')}
										</DesktopAppButton>
									</GafChatDesktopIconTooltip>
								</div>
							</div>
						</DesktopAppModalFrame>
					</m.div>
				) : null}
			</AnimatePresence>
			<SpotlightGuideModal
				open={guideOpen}
				onClose={onCloseGuide}
				rootId={GAF_CHAT_GUIDE_ROOT_ID}
				steps={guideSteps}
				audioLocalStorageKey={guideAudioLocalStorageKey}
				tourAudioFolder={guideTourAudioFolder}
				labels={guideLabels}
				dialogTitleId="gaf-chat-guide-title"
			/>
		</>
	);
}
