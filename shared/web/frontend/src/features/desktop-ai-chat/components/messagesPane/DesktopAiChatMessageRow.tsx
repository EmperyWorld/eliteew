/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Single Desktop AI Chat message row JSX (avatar, bubble, toolbar, clock).
 *
 * Invariants:
 * - Row class uses `'flex flex-col w-full min-w-0 gap-1'` PLUS DESKTOP_AI_CHAT_THREAD_COLUMN_CLASS.
 * - Peer user messages never reuse SecureAvatar useProfileApi.
 * - Live/finalizing assistant keeps streaming markdown (no blueprint/expert remount).
 * - Evidence once inside documents; no «Опора» footnote under bubbles.
 * - Wave F2: when `council_transcript` is present, Document | Совещание shell wraps
 *   expert / plain / live markdown (blueprint embeds its own council tab).
 *
 * Related:
 * - buildDesktopAiChatMessageRowModel.ts
 * - DesktopAiChatMessagesPaneView.tsx
 * - components/DesktopAiCouncilTabsShell.tsx
 */
import {
	ArrowPathIcon,
	DocumentDuplicateIcon,
	SparklesIcon,
	TrashIcon,
} from '@heroicons/react/24/outline';
import type { TFunction } from 'i18next';
import * as React from 'react';
import { SecureAvatar } from '@/components/profile/SecureAvatar';
import { DesktopChromeTooltip } from '@/pages/Desktop/components/DesktopChromeTooltip';
import { DESKTOP_TYPOGRAPHY } from '../../../../pages/Desktop/constants';
import { cn } from '@/utils/cn';
import type { DesktopAiMessage } from '../../api/desktopChatClient';
import { DesktopAiBlueprintArtifactBubble } from '../../DesktopAiBlueprintArtifactBubble';
import {
	DesktopAiCollapsibleAssistantMarkdown,
	DESKTOP_AI_EXPERT_DOC_COLLAPSE_PX,
} from '../../DesktopAiCollapsibleAssistantMarkdown';
import { DesktopAiExpertAnswerDocument } from '../../DesktopAiExpertAnswerDocument';
import { FreeformInterviewHandoffBar } from '../../discussion/FreeformInterviewHandoffBar';
import { normalizeDesktopCouncilTranscript } from '../../desktopChatDocumentReplacement';
import { DESKTOP_AI_CHAT_THREAD_COLUMN_CLASS } from '../../layout/desktopAiChatLayoutTokens';
import { desktopAiChatAuthorInitials } from '../../utils/desktopAiChatOwnUserMessage';
import { isPersistedDesktopAiMessageId } from '../../utils/desktopAiChatMessageIds';
import type { DesktopAiChatBubbleContextPayload } from '../DesktopAiChatBubbleContextMenu';
import { DesktopAiChatIconTooltip } from '../desktopAiChatIconTooltip';
import { DesktopAiCouncilTabsShell } from '../DesktopAiCouncilTabsShell';
import { DesktopAiWebSearchSources } from '../DesktopAiWebSearchSources';
import type { DesktopAiChatMessageRowModel } from './buildDesktopAiChatMessageRowModel';

const BUBBLE_ICON_BTN_CLASS =
	'inline-flex size-8 shrink-0 items-center justify-center rounded-md p-1 opacity-65 hover:opacity-100 hover:bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.08)_100%,transparent)] outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)] focus-visible:ring-offset-1 focus-visible:ring-offset-transparent motion-reduce:transition-none';

export type DesktopAiChatMessageRowProps = {
	model: DesktopAiChatMessageRowModel;
	sending: boolean;
	isEnsembleActive: boolean;
	canDeleteMessages: boolean;
	saveBlueprintToProjectBusyId: string | null;
	lucideStroke: number;
	onRegenerate: () => void | Promise<void>;
	onCopyBubble: (content: string) => void | Promise<void>;
	onDeleteUserMessage: (m: DesktopAiMessage) => void;
	onSaveBlueprintToProject: (m: DesktopAiMessage) => void | Promise<void>;
	onStartInterviewFromMessage?: (m: DesktopAiMessage) => void | Promise<void>;
	interviewStartBusy?: boolean;
	onExportAssistantMarkdown: (m: DesktopAiMessage) => void;
	onOpenBubbleHeroDossier: (heroId: string | null) => void;
	onBubbleContextMenu: (payload: DesktopAiChatBubbleContextPayload) => void;
	ensembleActiveSpeakerId?: string | null;
	t: TFunction<'desktopAiChat'>;
};

export function DesktopAiChatMessageRow(props: DesktopAiChatMessageRowProps) {
	const {
		model,
		sending,
		isEnsembleActive,
		canDeleteMessages,
		saveBlueprintToProjectBusyId,
		lucideStroke,
		onRegenerate,
		onCopyBubble,
		onDeleteUserMessage,
		onSaveBlueprintToProject,
		onStartInterviewFromMessage,
		interviewStartBusy = false,
		onExportAssistantMarkdown,
		onOpenBubbleHeroDossier,
		onBubbleContextMenu,
		ensembleActiveSpeakerId = null,
		t,
	} = props;
	const m = model.message;

	return (
		<div
			key={m.id}
			className={cn(
				'flex flex-col w-full min-w-0 gap-1',
				DESKTOP_AI_CHAT_THREAD_COLUMN_CLASS,
				model.userBubbleAlignEnd ? 'items-end' : 'items-start',
				model.compactTop ? '-mt-2 motion-reduce:mt-0' : ''
			)}
		>
			<div
				className={[
					'flex w-full min-w-0 gap-2.5',
					model.userBubbleAlignEnd ? 'flex-row-reverse' : 'flex-row',
				].join(' ')}
			>
				{m.role === 'user' ? (
					model.isOwnUserBubble ? (
						<DesktopChromeTooltip
							content={t('messageFromYouTitle')}
							placement="top"
							offsetExtra={4}
						>
							<div className="shrink-0 w-9 h-9 rounded-full overflow-hidden border mt-0.5 border-[rgb(var(--desktop-accent-rgb)/0.38)]">
								<SecureAvatar
									useProfileApi
									alt={t('messageFromYouAlt')}
									className="h-full w-full object-cover"
								/>
							</div>
						</DesktopChromeTooltip>
					) : (
						<DesktopChromeTooltip
							content={model.peerAuthorLabel || t('messageFromPeerFallback')}
							placement="top"
							offsetExtra={4}
						>
							<div
								className="shrink-0 w-9 h-9 rounded-full overflow-hidden border mt-0.5 border-(--desktop-border-strong)"
								role="img"
								aria-label={
									model.peerAuthorLabel || t('messageFromPeerFallback')
								}
							>
								{model.participantForAuthor?.avatar_url ? (
									<SecureAvatar
										avatarUrl={model.participantForAuthor.avatar_url}
										alt={model.peerAuthorLabel || ''}
										className="h-full w-full object-cover"
									/>
								) : (
									<div className="flex h-full w-full items-center justify-center bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.12)_100%,transparent)]">
										<span
											className={cn(
												'font-semibold text-(--desktop-text-secondary)',
												DESKTOP_TYPOGRAPHY.captionInherit
											)}
										>
											{desktopAiChatAuthorInitials(
												model.peerAuthorLabel || '?'
											)}
										</span>
									</div>
								)}
							</div>
						</DesktopChromeTooltip>
					)
				) : (
					<DesktopAiChatIconTooltip
						content={t('userBubbleDetails', {
							label: model.bubbleSpeakerLabel,
						})}
					>
						<button
							type="button"
							onClick={() => onOpenBubbleHeroDossier(model.bubbleHeroId)}
							aria-label={t('heroAboutAria')}
							className={[
								'shrink-0 w-9 h-9 rounded-full overflow-hidden border mt-0.5 cursor-pointer border-(--desktop-border-strong) bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.34)_100%,transparent)] p-0 outline-none',
								'focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)] focus-visible:ring-offset-1 focus-visible:ring-offset-transparent',
							].join(' ')}
						>
							{model.bubbleAvatarPath ? (
								<img
									src={model.bubbleAvatarPath}
									alt=""
									className="pointer-events-none h-full w-full object-cover"
								/>
							) : (
								<div className="flex h-full w-full items-center justify-center bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.1)_100%,transparent)]">
									<SparklesIcon
										className="h-4 w-4 text-[rgb(var(--desktop-accent-rgb)/0.88)]"
										strokeWidth={lucideStroke}
									/>
								</div>
							)}
						</button>
					</DesktopAiChatIconTooltip>
				)}
				<div
					className={[
						'relative group min-w-0 flex-1 rounded-(--desktop-radius-xl) px-3.5 py-2.5 text-sm leading-[1.65] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]',
						m.role === 'user' && model.isOwnUserBubble
							? 'rounded-br-md border border-[rgb(var(--desktop-accent-rgb)/0.38)] bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb)/0.16)_100%,transparent)] shadow-(--desktop-shadow-soft)'
							: m.role === 'user'
								? 'rounded-bl-md border border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_88%,rgb(var(--desktop-bg-primary-rgb))_12%)] shadow-(--desktop-shadow-soft)'
								: 'rounded-bl-md border border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_82%,rgb(var(--desktop-bg-primary-rgb))_18%)] shadow-(--desktop-shadow-soft)',
					].join(' ')}
					onContextMenuCapture={(e) => {
						const hasText = Boolean((m.content || '').trim());
						const canDeleteUser =
							m.role === 'user' &&
							model.isOwnUserBubble &&
							canDeleteMessages &&
							isPersistedDesktopAiMessageId(m.id) &&
							!sending;
						if (!hasText && !canDeleteUser) return;
						e.preventDefault();
						e.stopPropagation();
						onBubbleContextMenu({
							anchor: {
								clientX: e.clientX,
								clientY: e.clientY,
							},
							messageRole: m.role === 'assistant' ? 'assistant' : 'user',
							onCopy: hasText ? () => void onCopyBubble(m.content) : undefined,
							onDeleteFromHere: canDeleteUser
								? () => onDeleteUserMessage(m)
								: undefined,
						});
					}}
				>
					{model.showEnsembleSpeakerLabel ? (
						<div
							className={cn(
								'mb-1.5 flex flex-wrap items-center gap-1 border-b border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.08)_100%,transparent)] pb-1',
								DESKTOP_TYPOGRAPHY.shellMeta10
							)}
							title={model.speakerChips.fullLabel ?? undefined}
							data-testid="desktop-ai-ensemble-speaker-attr"
						>
							{model.speakerChips.visible.map((part) => (
								<span
									key={part.id}
									className="inline-flex max-w-44 truncate rounded-md border border-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb)/0.22)_100%,transparent)] bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb)/0.1)_100%,transparent)] px-1.5 py-0.5 font-medium tracking-normal text-[rgb(var(--desktop-accent-rgb)/0.95)]"
								>
									{part.label}
								</span>
							))}
							{model.speakerChips.overflow > 0 ? (
								<span
									className="inline-flex rounded-md px-1.5 py-0.5 font-medium text-(--desktop-text-muted)"
									title={t('ensembleSpeakerOverflowAria', {
										count: model.speakerChips.overflow,
									})}
								>
									+{model.speakerChips.overflow}
								</span>
							) : null}
						</div>
					) : null}
					{model.sharedAuthorLabel || model.peerAuthorLabel ? (
						<p
							className={cn(
								'mb-1 font-medium text-(--desktop-text-secondary)',
								DESKTOP_TYPOGRAPHY.captionInherit
							)}
						>
							{model.isOwnUserBubble
								? t('messageFromYouTitle')
								: model.peerAuthorLabel || model.sharedAuthorLabel}
						</p>
					) : null}
					{model.userBubbleShowActionsOwned ? (
						<div className="absolute top-1.5 right-1.5 z-1 flex items-center gap-px">
							{model.showUserCopy ? (
								<DesktopAiChatIconTooltip content={t('copyUserMessageTitle')}>
									<button
										type="button"
										onClick={() => void onCopyBubble(m.content)}
										className={BUBBLE_ICON_BTN_CLASS}
										aria-label={t('copyUserMessageAria')}
									>
										<DocumentDuplicateIcon
											className="h-3.5 w-3.5"
											strokeWidth={lucideStroke}
										/>
									</button>
								</DesktopAiChatIconTooltip>
							) : null}
							<DesktopAiChatIconTooltip content={t('deleteFromHereTitle')}>
								<button
									type="button"
									onClick={() => onDeleteUserMessage(m)}
									className={`${BUBBLE_ICON_BTN_CLASS} text-amber-200/90 hover:text-amber-100`}
									aria-label={t('deleteFromHereAria')}
								>
									<TrashIcon
										className="h-3.5 w-3.5"
										strokeWidth={lucideStroke}
									/>
								</button>
							</DesktopAiChatIconTooltip>
						</div>
					) : null}
					{model.assistantBubbleShowToolbar ? (
						<div className="absolute top-1.5 right-1.5 z-1 flex items-center gap-px">
							{model.showRegenerate ? (
								<DesktopAiChatIconTooltip
									content={
										isEnsembleActive ? t('regenGroupTitle') : t('regenTitle')
									}
								>
									<button
										type="button"
										onClick={() => void onRegenerate()}
										className={BUBBLE_ICON_BTN_CLASS}
										aria-label={t('regenAria')}
									>
										<ArrowPathIcon
											className="h-3.5 w-3.5"
											strokeWidth={lucideStroke}
										/>
									</button>
								</DesktopAiChatIconTooltip>
							) : null}
							<DesktopAiChatIconTooltip content={t('copyAnswerTitle')}>
								<button
									type="button"
									onClick={() => void onCopyBubble(m.content)}
									className={BUBBLE_ICON_BTN_CLASS}
									aria-label={t('copyAnswerAria')}
								>
									<DocumentDuplicateIcon
										className="h-3.5 w-3.5"
										strokeWidth={lucideStroke}
									/>
								</button>
							</DesktopAiChatIconTooltip>
						</div>
					) : null}
					{m.role === 'assistant' ? (
						<div className={model.assistantToolbarPadRight}>
							{(() => {
								const councilTranscript = normalizeDesktopCouncilTranscript(
									m.metadata?.council_transcript
								);
								const councilLive = Boolean(
									sending || m.metadata?.desktop_stream_finalizing === true
								);
								const councilHasTurns =
									(councilTranscript?.turns?.filter(
										(turn) => turn.kind !== 'orchestrator_brief'
									).length ?? 0) > 0 ||
									(councilLive && ensembleActiveSpeakerId);
								const councilLivePrimary =
									councilTranscript && councilLive && councilHasTurns;
								const councilDocFormingPane = (
									<p
										className="text-sm text-(--desktop-text-muted) antialiased"
										role="status"
									>
										{t('ensembleCouncilDocForming')}
									</p>
								);
								const wrapCouncil = (
									documentPane: React.ReactNode,
									live: boolean
								) =>
									councilTranscript ? (
										<DesktopAiCouncilTabsShell
											transcript={councilTranscript}
											live={live}
											documentPane={documentPane}
											activeSpeakerId={live ? ensembleActiveSpeakerId : null}
										/>
									) : (
										documentPane
									);

								if (m.content) {
									if (model.isBlueprintArtifact) {
										return (
											<DesktopAiBlueprintArtifactBubble
												message={m}
												markdown={m.content}
												ensembleBodyTint={model.ensembleBubbleTint}
												sources={model.messageWebSearchSources}
												maxCollapsedPx={900}
												showSaveToProject={model.showSaveBlueprintToProject}
												saveToProjectBusy={
													saveBlueprintToProjectBusyId === m.id
												}
												onSaveToProject={() => void onSaveBlueprintToProject(m)}
												onStartInterview={onStartInterviewFromMessage}
												interviewStartBusy={interviewStartBusy}
												onExportMarkdown={() => onExportAssistantMarkdown(m)}
											/>
										);
									}
									if (councilLivePrimary) {
										return wrapCouncil(councilDocFormingPane, true);
									}
									if (model.showExpertDocument) {
										return wrapCouncil(
											<>
												<FreeformInterviewHandoffBar
													message={m}
													onStartInterviewFromMessage={
														onStartInterviewFromMessage
													}
													interviewStartBusy={interviewStartBusy}
													t={t}
												/>
												<DesktopAiExpertAnswerDocument
													markdown={m.content}
													analysis={model.expertDocumentAnalysis}
													ensembleBodyTint={model.ensembleBubbleTint}
													evidenceSources={model.messageEvidenceSources}
													qualityStatus={m.metadata?.quality_status}
													onExportMarkdown={() => onExportAssistantMarkdown(m)}
												/>
											</>,
											false
										);
									}
									return wrapCouncil(
										<>
											<FreeformInterviewHandoffBar
												message={m}
												onStartInterviewFromMessage={
													onStartInterviewFromMessage
												}
												interviewStartBusy={interviewStartBusy}
												t={t}
											/>
											<DesktopAiCollapsibleAssistantMarkdown
												markdown={m.content}
												ensembleBodyTint={model.ensembleBubbleTint}
												presentation="document"
												citationSources={model.messageEvidenceSources}
												maxCollapsedPx={
													councilTranscript
														? DESKTOP_AI_EXPERT_DOC_COLLAPSE_PX
														: isEnsembleActive
															? 400
															: 288
												}
											/>
										</>,
										Boolean(
											sending || m.metadata?.desktop_stream_finalizing === true
										)
									);
								}
								if (sending) {
									if (councilLivePrimary) {
										return wrapCouncil(councilDocFormingPane, true);
									}
									const streamingPlaceholder = (
										<div
											className="space-y-2"
											role="status"
											aria-live="polite"
											aria-busy="true"
										>
											<div
												className="h-0.5 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.1)_100%,transparent)]"
												aria-hidden
											>
												<div className="h-full w-2/5 max-w-[45%] animate-pulse motion-reduce:animate-none rounded-full bg-[rgb(var(--desktop-accent-rgb)/0.85)] shadow-[0_0_12px_rgb(var(--desktop-accent-rgb)/0.35)]" />
											</div>
											<span className="text-(--desktop-text-muted) text-sm font-medium">
												{t('streamingReply')}
											</span>
										</div>
									);
									return wrapCouncil(streamingPlaceholder, true);
								}
								return null;
							})()}
						</div>
					) : (
						<div
							className={[
								'whitespace-pre-wrap wrap-break-word text-(--desktop-text-primary) text-[0.9375rem] leading-[1.65]',
								model.userBubblePadRight,
							]
								.filter(Boolean)
								.join(' ')}
						>
							{m.content}
						</div>
					)}
				</div>
			</div>
			{m.role === 'assistant' && !model.useWideDocumentLayout ? (
				<DesktopAiWebSearchSources
					sources={model.messageWebSearchSources}
					className={DESKTOP_AI_CHAT_THREAD_COLUMN_CLASS}
					compact
				/>
			) : null}
			{model.clock ? (
				<span
					className={cn(
						DESKTOP_TYPOGRAPHY.small,
						'tabular-nums px-1',
						model.userBubbleAlignEnd ? 'text-right' : 'text-left'
					)}
				>
					{model.clock}
				</span>
			) : null}
		</div>
	);
}
