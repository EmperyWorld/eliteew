/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Desktop AI Chat composer: voice status, ensemble council, doc confirm, textarea, actions.
 *
 * Invariants:
 * - Composer DOM ids/testids come from desktopAiChatDomIds.ts.
 * - No persistent Enter/Shift+Enter hint strip above the textarea.
 * - Ensemble council stays rich for the full stream (`deliberating` + `speaking`); speaking highlights `active_speaker_id`.
 * - Council / dock width aligns with `DESKTOP_AI_CHAT_THREAD_COLUMN_CLASS`.
 * - Composer dock uses toolbar-cluster chrome; textarea is inset (no double card).
 * - Focus targets composer textarea id (not the dock wrapper).
 * - Attach opens via native `<label htmlFor>` on a visually-hidden (`sr-only`) file
 *   input — not `display:none` and not JS `.click()` (WebKitGTK / tooltip wrappers
 *   often swallow programmatic activation).
 *
 * Related:
 * - desktopAiChatDomIds.ts, hooks/useDesktopAiChatStream.ts
 * - layout/desktopAiChatLayoutTokens.ts
 */
import type { TFunction } from 'i18next';
import * as React from 'react';
import { BlueprintQualityChip } from '../DesktopAiBlueprintArtifactBubble';
import type { DesktopEnsembleCouncilUiState } from '../ensemble';
import { getDesktopAiHero } from '../desktopAiHeroes';
import type { EnsembleDocConfirmState } from '../hooks/useDesktopAiChatEnsemble';
import { DesktopAiChatIconTooltip } from './desktopAiChatIconTooltip';
import { DesktopAiWebSearchArmChip } from './DesktopAiWebSearchArmChip';
import {
	ArrowPathIcon,
	MicrophoneIcon,
	PaperAirplaneIcon,
	PaperClipIcon,
	Square2StackIcon,
} from '@heroicons/react/24/outline';
import {
	DESKTOP_INTERACTIVE,
	DESKTOP_TYPOGRAPHY,
} from '../../../pages/Desktop/constants';
import { cn } from '@/utils/cn';
import { DESKTOP_AI_CHAT_COMPOSER_ATTACH_INPUT_ID } from '../desktopAiChatDomIds';
import { DESKTOP_AI_CHAT_THREAD_COLUMN_CLASS } from '../layout/desktopAiChatLayoutTokens';
import type { useMicRecorder } from '@/voice-core';

export type DesktopAiChatComposerProps = {
	voiceAllowed: boolean;
	voiceIn: boolean;
	sttBusy: boolean;
	ttsBusy: boolean;
	sttMic: ReturnType<typeof useMicRecorder>;
	isEnsembleActive: boolean;
	ensembleCouncilUi: DesktopEnsembleCouncilUiState | null;
	ensembleDocConfirm: EnsembleDocConfirmState;
	soloSendsBlocked: boolean;
	streamLockHeldByOther: boolean;
	streamLockStatusHint: string | null;
	ugsCreditsBalance: number | null;
	composerHint: string | null;
	/** Armed for next send only; shown as static chip above composer. */
	webSearchArmed: boolean;
	onDisarmWebSearch: () => void;
	networkOnline: boolean;
	sttLevelMeterRef: React.RefObject<HTMLDivElement | null>;
	composerRegionId: string;
	composerTestId: string;
	composerTextareaId: string;
	composerTextareaTestId: string;
	composerOfflineDescId: string;
	shellComposerDockClass: string;
	shellComposerTextareaClass: string;
	shellComposerIconBtnClass: string;
	shellComposerStopBtnClass: string;
	activeId: string | null;
	input: string;
	onInputChange: (value: string) => void;
	attachRef: React.RefObject<HTMLInputElement | null>;
	onAttach: React.ChangeEventHandler<HTMLInputElement>;
	sending: boolean;
	onSend: () => void | Promise<void>;
	onStopStream: () => void;
	onMicStt: () => void | Promise<void>;
	onEnsembleDocumentConfirm: (
		decision: 'accept' | 'decline'
	) => void | Promise<void>;
	onOpenSoloSlotModal: () => void;
	sttCancelNextBlobRef: React.MutableRefObject<boolean>;
	lucideStroke: number;
	t: TFunction<'desktopAiChat'>;
};

export function DesktopAiChatComposer(props: DesktopAiChatComposerProps) {
	const {
		voiceAllowed,
		voiceIn,
		sttBusy,
		ttsBusy,
		sttMic,
		isEnsembleActive,
		ensembleCouncilUi,
		ensembleDocConfirm,
		soloSendsBlocked,
		streamLockHeldByOther,
		streamLockStatusHint,
		ugsCreditsBalance,
		composerHint,
		webSearchArmed,
		onDisarmWebSearch,
		networkOnline,
		sttLevelMeterRef,
		composerRegionId,
		composerTestId,
		composerTextareaId,
		composerTextareaTestId,
		composerOfflineDescId,
		shellComposerDockClass,
		shellComposerTextareaClass,
		shellComposerIconBtnClass,
		shellComposerStopBtnClass,
		activeId,
		input,
		onInputChange,
		attachRef,
		onAttach,
		sending,
		onSend,
		onStopStream,
		onMicStt,
		onEnsembleDocumentConfirm,
		onOpenSoloSlotModal,
		sttCancelNextBlobRef,
		lucideStroke,
		t,
	} = props;

	const councilCompact = ensembleCouncilUi?.phase === 'speaking';

	return (
		<div className="flex flex-col gap-1">
			{voiceAllowed && voiceIn ? (
				<p
					className={cn(
						'min-h-3.5 px-0.5 text-(--desktop-text-muted)',
						DESKTOP_TYPOGRAPHY.shellMeta10
					)}
					aria-live="polite"
				>
					{ttsBusy
						? t('voiceStatusTts')
						: sttBusy
							? t('voiceStatusStt')
							: sttMic.isRecording
								? t('voiceStatusRecording')
								: ''}
				</p>
			) : null}
			{isEnsembleActive && ensembleCouncilUi ? (
				<div
					role="status"
					aria-live="polite"
					data-testid="desktop-ai-ensemble-council"
					data-phase={ensembleCouncilUi.phase}
					className={cn(
						'rounded-lg border border-[rgb(var(--desktop-accent-rgb)/0.28)] bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.55)_100%,rgb(var(--desktop-accent-rgb)/0.08))] px-2 py-1.5',
						DESKTOP_AI_CHAT_THREAD_COLUMN_CLASS,
						ensembleCouncilUi.phase === 'deliberating'
							? 'shadow-[0_0_12px_rgba(139,92,246,0.08)]'
							: ''
					)}
				>
					<div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
						<p
							className={cn(
								'font-semibold tracking-normal text-[rgb(var(--desktop-accent-rgb)/0.92)]',
								ensembleCouncilUi.phase === 'deliberating' &&
									'animate-pulse motion-reduce:animate-none',
								DESKTOP_TYPOGRAPHY.captionInherit
							)}
						>
							{ensembleCouncilUi.phase === 'speaking'
								? t('ensembleSpeaking')
								: t('ensembleDeliberating')}
						</p>
						{ensembleCouncilUi.blueprint &&
						ensembleCouncilUi.plan_template_title?.trim() ? (
							<p
								className={cn(
									'truncate text-(--desktop-text-muted)',
									DESKTOP_TYPOGRAPHY.shellMeta10
								)}
							>
								{ensembleCouncilUi.plan_template_title.trim()}
							</p>
						) : null}
					</div>
					{ensembleCouncilUi.phase === 'speaking' &&
					ensembleCouncilUi.active_speaker_id ? (
						<p
							className={cn(
								'mt-0.5 truncate text-(--desktop-text-muted)',
								DESKTOP_TYPOGRAPHY.shellMeta10
							)}
						>
							{t('hintWriting', {
								speaker:
									getDesktopAiHero(ensembleCouncilUi.active_speaker_id)
										?.shortLabel ?? ensembleCouncilUi.active_speaker_id,
							})}
						</p>
					) : null}
					{councilCompact ? (
						<p
							className={cn(
								'mt-0.5 text-(--desktop-text-secondary)',
								DESKTOP_TYPOGRAPHY.bodyMuted
							)}
						>
							{t('ensembleCouncilLiveInBubble')}
						</p>
					) : null}
					{!councilCompact ? (
						<div className="mt-1 max-h-[min(11rem,24vh)] space-y-1 overflow-y-auto overscroll-contain pr-0.5">
							{ensembleCouncilUi.huddle_lines.length > 0 ? (
								<ul
									className={cn(
										'mt-1 space-y-0.5 italic text-(--desktop-text-secondary)',
										DESKTOP_TYPOGRAPHY.shellMeta10
									)}
								>
									{ensembleCouncilUi.huddle_lines.map((ln) => (
										<li key={ln}>{ln}</li>
									))}
								</ul>
							) : null}
							{Array.isArray(ensembleCouncilUi.deferred_plan_templates) &&
							ensembleCouncilUi.deferred_plan_templates.length > 0 ? (
								<p
									className={cn(
										'mt-1 leading-snug text-amber-100/95',
										DESKTOP_TYPOGRAPHY.shellMeta10
									)}
								>
									{t('ensembleDeferredTemplatesHint', {
										list: ensembleCouncilUi.deferred_plan_templates
											.map((row) => {
												if (!row || typeof row !== 'object') return '';
												return (
													(typeof row.title === 'string' && row.title.trim()) ||
													(typeof row.plan_template_id === 'string'
														? row.plan_template_id
														: '')
												);
											})
											.filter(Boolean)
											.join(', '),
									})}
								</p>
							) : null}
							{ensembleCouncilUi.reason ? (
								<p
									className={cn(
										'mt-1 leading-snug text-(--desktop-text-secondary)',
										DESKTOP_TYPOGRAPHY.shellMeta10
									)}
								>
									{ensembleCouncilUi.reason}
								</p>
							) : null}
							{ensembleCouncilUi.blueprint &&
							Array.isArray(ensembleCouncilUi.steps_preview) &&
							ensembleCouncilUi.steps_preview.length > 0 ? (
								<div className="mt-1.5 rounded-md border border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.1)_100%,transparent)] bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.22)_100%,transparent)] px-1.5 py-1">
									<div className="flex flex-wrap items-start justify-between gap-1.5">
										<p
											className={cn(
												'font-medium text-[rgb(var(--desktop-accent-rgb)/0.92)]',
												DESKTOP_TYPOGRAPHY.shellMeta10
											)}
										>
											{t('ensembleTemplateLabel')}{' '}
											{ensembleCouncilUi.plan_template_title?.trim() ||
												t('structuredPlanFallback')}
										</p>
										{(() => {
											const qs = ensembleCouncilUi.quality_status as
												| { status?: unknown; label?: unknown }
												| undefined;
											const label =
												typeof qs?.label === 'string' ? qs.label.trim() : '';
											if (!label) {
												return null;
											}
											const status =
												typeof qs?.status === 'string' ? qs.status : undefined;
											return (
												<BlueprintQualityChip status={status} label={label} />
											);
										})()}
									</div>
									<p
										className={cn(
											'mt-0.5 text-(--desktop-text-muted)',
											DESKTOP_TYPOGRAPHY.micro,
											'font-normal'
										)}
									>
										{t('ensembleStepsHint')}
									</p>
									<ol
										className={cn(
											'mt-1 list-decimal space-y-0.5 pl-3 text-(--desktop-text-secondary)',
											DESKTOP_TYPOGRAPHY.shellMeta10
										)}
									>
										{ensembleCouncilUi.steps_preview.map((st, i) => {
											const k = `${String(st.step_id ?? i)}-${i}`;
											const hid =
												typeof st.hero_id === 'string' ? st.hero_id : '';
											const who = hid
												? (getDesktopAiHero(hid)?.shortLabel ?? hid)
												: '';
											const ttl =
												typeof st.title === 'string' && st.title.trim()
													? st.title.trim()
													: t('ensembleStepFallback', {
															n: i + 1,
														});
											const isActive =
												Boolean(hid) &&
												hid === ensembleCouncilUi.active_speaker_id;
											return (
												<li
													key={k}
													className={cn(
														'leading-snug',
														isActive &&
															'font-medium text-(--desktop-text-primary)'
													)}
													data-active-step={isActive ? 'true' : undefined}
												>
													{ttl}
													{who ? ` — ${who}` : ''}
													{st.fallback ? (
														<span className="text-(--desktop-text-muted)">
															{' '}
															{t('ensembleReplacement')}
														</span>
													) : null}
												</li>
											);
										})}
									</ol>
								</div>
							) : null}
							{Array.isArray(ensembleCouncilUi.task_blocks) &&
							ensembleCouncilUi.task_blocks.length > 0 ? (
								<div className="mt-1.5 rounded-md border border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.1)_100%,transparent)] bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.22)_100%,transparent)] px-1.5 py-1">
									<p
										className={cn(
											'text-(--desktop-text-muted)',
											DESKTOP_TYPOGRAPHY.micro,
											'font-normal'
										)}
									>
										{t('ensembleTaskBlocksHint')}
									</p>
									<ul
										className={cn(
											'mt-1 list-disc space-y-1 pl-3 text-(--desktop-text-secondary)',
											DESKTOP_TYPOGRAPHY.shellMeta10
										)}
									>
										{ensembleCouncilUi.task_blocks.map((bl, i) => {
											const hid =
												typeof bl.hero_id === 'string' ? bl.hero_id : '';
											const who = hid
												? (getDesktopAiHero(hid)?.shortLabel ?? hid)
												: '';
											const ttl =
												typeof bl.title === 'string' && bl.title.trim()
													? bl.title.trim()
													: t('ensembleStepFallback', { n: i + 1 });
											const obj =
												typeof bl.objective === 'string' && bl.objective.trim()
													? bl.objective.trim()
													: '';
											const isActive =
												Boolean(hid) &&
												hid === ensembleCouncilUi.active_speaker_id;
											return (
												<li
													key={String(bl.id ?? i)}
													className={cn(
														'leading-snug',
														isActive && 'text-(--desktop-text-primary)'
													)}
													data-active-step={isActive ? 'true' : undefined}
												>
													<span className="font-medium text-(--desktop-text-primary)">
														{ttl}
													</span>
													{who ? (
														<span className="text-(--desktop-text-muted)">
															{' '}
															— {who}
														</span>
													) : null}
													{obj ? (
														<span
															className={cn(
																'mt-0.5 block text-(--desktop-text-muted)',
																DESKTOP_TYPOGRAPHY.micro,
																'font-normal'
															)}
														>
															{obj}
														</span>
													) : null}
												</li>
											);
										})}
									</ul>
								</div>
							) : null}
						</div>
					) : null}
					<div className="mt-1.5 flex flex-wrap gap-1">
						{ensembleCouncilUi.speakers.map((hid) => {
							const isActive = hid === ensembleCouncilUi.active_speaker_id;
							return (
								<span
									key={hid}
									data-active-speaker={isActive ? 'true' : undefined}
									className={cn(
										'rounded-md border px-1.5 py-0.5 font-medium',
										DESKTOP_TYPOGRAPHY.captionInherit,
										isActive
											? 'border-[rgb(var(--desktop-accent-rgb)/0.45)] bg-[rgb(var(--desktop-accent-rgb)/0.18)] text-(--desktop-text-primary)'
											: 'border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.1)_100%,transparent)] bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.28)_100%,transparent)] text-(--desktop-text-primary)'
									)}
								>
									{getDesktopAiHero(hid)?.shortLabel ?? hid}
								</span>
							);
						})}
					</div>
					{ensembleCouncilUi.roster_size >
					ensembleCouncilUi.max_speakers_this_turn ? (
						<p
							className={cn(
								'mt-1 text-(--desktop-text-muted)',
								DESKTOP_TYPOGRAPHY.shellMeta10
							)}
						>
							{t('ensembleSpeakerCap', {
								max: ensembleCouncilUi.max_speakers_this_turn,
								total: ensembleCouncilUi.roster_size,
							})}
						</p>
					) : null}
				</div>
			) : null}
			{isEnsembleActive && ensembleDocConfirm ? (
				<section
					aria-label={t('docConfirmRegionAria')}
					className="rounded-xl border border-[rgb(var(--desktop-accent-rgb)/0.32)] bg-[rgb(var(--desktop-accent-rgb)/0.1)] px-3 py-2 space-y-2"
				>
					<p className="text-xs leading-snug text-(--desktop-text-primary) antialiased">
						{ensembleDocConfirm.reason.trim()
							? ensembleDocConfirm.reason
							: t('docConfirmReasonFallback')}
					</p>
					<div className="flex flex-wrap gap-2">
						<button
							type="button"
							disabled={sending}
							onClick={() => void onEnsembleDocumentConfirm('accept')}
							className={`inline-flex min-h-9 items-center rounded-lg px-3 py-1.5 text-xs font-medium bg-[rgb(var(--desktop-accent-rgb)/0.9)] border border-[rgb(var(--desktop-accent-rgb)/0.35)] text-white hover:brightness-110 active:brightness-95 ${DESKTOP_INTERACTIVE.btnRounded} disabled:opacity-40`}
						>
							{t('docConfirmAccept')}
						</button>
						<button
							type="button"
							disabled={sending}
							onClick={() => void onEnsembleDocumentConfirm('decline')}
							className={`inline-flex min-h-9 items-center rounded-lg px-3 py-1.5 text-xs font-medium border border-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.15)_100%,transparent)] bg-[color-mix(in_srgb,rgb(var(--desktop-bg-primary-rgb)/0.28)_100%,transparent)] ${DESKTOP_INTERACTIVE.btnRounded} disabled:opacity-40`}
						>
							{t('docConfirmDecline')}
						</button>
					</div>
				</section>
			) : null}
			{soloSendsBlocked && !isEnsembleActive ? (
				<section
					aria-label={t('soloSlotBannerAria')}
					className="rounded-xl border border-amber-400/40 bg-[color-mix(in_srgb,rgb(120_53_15/0.35)_100%,transparent)] px-3 py-2 space-y-2"
				>
					<p
						className={cn(
							'text-xs leading-snug text-amber-50/95',
							DESKTOP_TYPOGRAPHY.shellMeta10
						)}
					>
						{t('soloSlotBanner')}
					</p>
					<div className="flex flex-wrap items-center gap-2">
						{ugsCreditsBalance != null ? (
							<span
								className={cn(
									'text-xs text-amber-50/85',
									DESKTOP_TYPOGRAPHY.shellMeta10
								)}
							>
								{t('soloUgsCreditsBalance', {
									balance: ugsCreditsBalance,
								})}
							</span>
						) : null}
						<button
							type="button"
							onClick={() => onOpenSoloSlotModal()}
							className={`inline-flex min-h-9 items-center rounded-lg px-3 py-1.5 text-xs font-medium bg-[rgb(var(--desktop-accent-rgb)/0.88)] border border-[rgb(var(--desktop-accent-rgb)/0.35)] text-white hover:brightness-110 ${DESKTOP_INTERACTIVE.btnRounded}`}
						>
							{t('soloSlotBuyCta')}
						</button>
					</div>
				</section>
			) : null}
			{webSearchArmed ? (
				<DesktopAiWebSearchArmChip
					onDisarm={onDisarmWebSearch}
					lucideStroke={lucideStroke}
					t={t}
				/>
			) : null}
			{streamLockStatusHint ? (
				<p
					className={cn(
						'px-0.5 leading-snug text-amber-200/90',
						DESKTOP_TYPOGRAPHY.shellMeta10
					)}
					role="status"
					aria-live="polite"
				>
					{streamLockStatusHint}
				</p>
			) : null}
			{composerHint ? (
				<p
					className={cn(
						'px-0.5 text-[rgb(var(--desktop-accent-rgb)/0.88)] animate-pulse motion-reduce:animate-none',
						DESKTOP_TYPOGRAPHY.shellMeta10
					)}
					aria-live="polite"
					aria-atomic="true"
				>
					{composerHint}
				</p>
			) : null}
			<div className="flex flex-col gap-1">
				{!networkOnline ? (
					<p
						id={composerOfflineDescId}
						role="status"
						aria-live="polite"
						className={cn(
							'px-0.5 leading-snug text-amber-200/90',
							DESKTOP_TYPOGRAPHY.shellMeta10
						)}
					>
						{t('composerOfflineDesc')}
					</p>
				) : null}
				{sttMic.isRecording ? (
					<div
						ref={sttLevelMeterRef}
						className="h-1 w-full max-w-md rounded-full bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.1)_100%,transparent)] overflow-hidden [--stt-level:0%]"
						aria-hidden
					>
						<div className="h-full w-(--stt-level) rounded-full bg-[rgb(var(--desktop-accent-rgb)/0.88)] transition-[width] duration-75" />
					</div>
				) : null}
				<div
					id={composerRegionId}
					data-testid={composerTestId}
					data-ai-chat-guide="composer"
					className={cn(
						shellComposerDockClass,
						'flex flex-col gap-1.5 sm:flex-row sm:items-end min-w-0'
					)}
				>
					<textarea
						data-testid={composerTextareaTestId}
						id={composerTextareaId}
						className={shellComposerTextareaClass}
						placeholder={t('composerPlaceholder')}
						aria-label={t('composerAriaLabel')}
						aria-describedby={
							!networkOnline ? composerOfflineDescId : undefined
						}
						disabled={
							!activeId || Boolean(ensembleDocConfirm) || soloSendsBlocked
						}
						value={input}
						onChange={(e) => onInputChange(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Escape' && sttMic.isRecording) {
								e.preventDefault();
								sttCancelNextBlobRef.current = true;
								void onMicStt();
								return;
							}
							if (e.key === 'Enter' && !e.shiftKey) {
								e.preventDefault();
								if (streamLockHeldByOther || sending) return;
								void onSend();
							}
						}}
					/>
					<input
						id={DESKTOP_AI_CHAT_COMPOSER_ATTACH_INPUT_ID}
						ref={attachRef}
						type="file"
						multiple
						className="sr-only"
						tabIndex={-1}
						aria-label={t('attachFile')}
						onChange={onAttach}
					/>
					<div className="flex flex-wrap items-end justify-end gap-2 shrink-0">
						<DesktopAiChatIconTooltip
							content={
								!voiceAllowed
									? t('micTitleDisabled')
									: !voiceIn
										? t('micTitleEnablePanel')
										: sttBusy
											? t('micTitleBusy')
											: sttMic.isRecording
												? t('micTitleStopHint')
												: t('micTitleRecord')
							}
						>
							<button
								type="button"
								disabled={
									!voiceIn ||
									!voiceAllowed ||
									sttBusy ||
									sending ||
									soloSendsBlocked
								}
								onClick={() => void onMicStt()}
								aria-label={
									sttBusy
										? t('micBusy')
										: sttMic.isRecording
											? t('micStop')
											: t('micStart')
								}
								className={cn(
									shellComposerIconBtnClass,
									'disabled:opacity-40',
									sttMic.isRecording
										? 'border-red-400/55 bg-red-500/20 animate-pulse motion-reduce:animate-none'
										: ''
								)}
							>
								{sttBusy ? (
									<ArrowPathIcon
										className="h-4 w-4 animate-spin motion-reduce:animate-none"
										aria-hidden
										strokeWidth={lucideStroke}
									/>
								) : (
									<MicrophoneIcon
										className="h-4 w-4"
										aria-hidden
										strokeWidth={lucideStroke}
									/>
								)}
							</button>
						</DesktopAiChatIconTooltip>
						<DesktopAiChatIconTooltip
							content={t('attachToRagTitle')}
							disabled={!activeId || soloSendsBlocked}
						>
							<label
								htmlFor={
									!activeId || soloSendsBlocked
										? undefined
										: DESKTOP_AI_CHAT_COMPOSER_ATTACH_INPUT_ID
								}
								aria-disabled={!activeId || soloSendsBlocked}
								aria-label={t('attachFile')}
								className={cn(
									shellComposerIconBtnClass,
									'cursor-pointer',
									(!activeId || soloSendsBlocked) &&
										'pointer-events-none opacity-40'
								)}
							>
								<PaperClipIcon
									className="h-4 w-4"
									aria-hidden
									strokeWidth={lucideStroke}
								/>
							</label>
						</DesktopAiChatIconTooltip>
						{sending ? (
							<DesktopAiChatIconTooltip content={t('stopGenTitle')}>
								<button
									type="button"
									onClick={onStopStream}
									className={cn(
										shellComposerStopBtnClass,
										'min-w-11 border border-red-400/40 bg-red-500/15 text-(--desktop-text-primary)'
									)}
									aria-label={t('stopGeneration')}
								>
									<Square2StackIcon
										className="h-4 w-4 shrink-0 fill-current"
										aria-hidden
										strokeWidth={lucideStroke}
									/>
									{t('stopShort')}
								</button>
							</DesktopAiChatIconTooltip>
						) : (
							<button
								type="button"
								onClick={() => void onSend()}
								disabled={
									!activeId ||
									Boolean(ensembleDocConfirm) ||
									soloSendsBlocked ||
									streamLockHeldByOther
								}
								aria-label={t('sendMessage')}
								className={`inline-flex min-h-11 min-w-11 items-center justify-center p-3 rounded-xl bg-[rgb(var(--desktop-accent-rgb)/0.88)] border border-[rgb(var(--desktop-accent-rgb)/0.32)] hover:brightness-110 active:brightness-95 ${DESKTOP_INTERACTIVE.btnRounded} text-white disabled:opacity-40`}
							>
								<PaperAirplaneIcon
									className="h-4 w-4"
									aria-hidden
									strokeWidth={lucideStroke}
								/>
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
