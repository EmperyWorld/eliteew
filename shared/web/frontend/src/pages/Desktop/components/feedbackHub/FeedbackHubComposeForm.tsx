/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * New-ticket compose panel for Feedback Hub: kind toggle, main message, optional
 * structured template, preview, quota warnings, and submit action.
 *
 * Invariants:
 * - Text-only submission; body assembled from main message plus optional template.
 * - Ctrl/Cmd+Enter submits when validation passes; form uses preventDefault onSubmit.
 *
 * Related:
 * - FeedbackHubComposePreview.tsx · mapFeedbackSubmitError.ts · FEEDBACK-HUB.md
 */
import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
	ArrowPathIcon,
	BookOpenIcon,
	BugAntIcon,
	ChevronDownIcon,
	LightBulbIcon,
	PaperAirplaneIcon,
	PencilIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';
import { DESKTOP_LUCIDE, DESKTOP_TYPOGRAPHY } from '../../constants';
import {
	createFeedbackTicket,
	type FeedbackSummary,
	type FeedbackTicket,
} from '../../services/productDesktopApi';
import {
	assembleBugBody,
	assembleWishBody,
	buildFeedbackSubmitBody,
	BUG_FREQ_LABEL_KEYS,
	createEmptyBugForm,
	createEmptyWishForm,
	WISH_FORM_KEYS,
} from '../../utils/feedbackHubBodyAssembler';
import { FEEDBACK_BODY_MAX } from '../../utils/feedbackHubConstants';
import {
	canSubmitFeedback,
	getFeedbackSubmitBlockReason,
	isFeedbackQuotaNearLimit,
} from '../../utils/feedbackHubSubmitGate';
import { feedbackSendAriaI18nKey } from '../../utils/feedbackHubSendLabels';
import { buildFeedbackClientMeta } from '../../utils/feedbackHubClientMeta';
import {
	isFeedbackBodyNearLimit,
	isFeedbackBodyOverLimit,
} from '../../utils/feedbackHubCharCount';
import {
	feedbackSummaryQueryKey,
	feedbackTicketsPagedQueryKey,
	FEEDBACK_QUERY_ROOT,
	type FeedbackKindFilter,
} from '../feedbackQueryOptions';
import { DesktopAppButton, DesktopAppSurface } from '../DesktopAppChrome';
import {
	FEEDBACK_HUB_FORM_TEXTAREA_CLASS,
	FEEDBACK_HUB_KIND_TOGGLE_BUTTON_CLASS,
	FEEDBACK_HUB_MAIN_MESSAGE_FIELD_ID,
	FEEDBACK_HUB_MAIN_MESSAGE_HINT_ID,
	FEEDBACK_HUB_SECTION_HEADING_CLASS,
	FEEDBACK_HUB_SEND_SHORTCUT_HINT_ID,
	FEEDBACK_HUB_STRUCTURE_SECTION_ID,
	feedbackHubBugFieldId,
	feedbackHubWishFieldId,
} from './feedbackHubComposeStyles';
import { FeedbackHubComposePreview } from './FeedbackHubComposePreview';
import { mapFeedbackSubmitError } from './mapFeedbackSubmitError';

export type FeedbackHubComposeFormHandle = {
	focusMainMessage: () => void;
};

export type FeedbackHubComposeFormProps = {
	embeddedMobileLayout?: boolean;
	kindToggleClusterClass: string;
	sendActionBarClass: string;
	summary: FeedbackSummary | undefined;
	listKindFilter: FeedbackKindFilter;
	initialQuickMode?: 'text';
	initialDraftBody?: string;
	onTicketCreated: (created: FeedbackTicket) => void;
	onGuideLayoutChange?: (layoutKey: string) => void;
};

export const FeedbackHubComposeForm = React.forwardRef<
	FeedbackHubComposeFormHandle,
	FeedbackHubComposeFormProps
>(function FeedbackHubComposeForm(
	{
		embeddedMobileLayout,
		kindToggleClusterClass,
		sendActionBarClass,
		summary,
		listKindFilter,
		initialQuickMode,
		initialDraftBody,
		onTicketCreated,
		onGuideLayoutChange,
	},
	ref
): React.ReactElement {
	const { t } = useTranslation('desktopUi', { keyPrefix: 'feedbackHub' });
	const qc = useQueryClient();
	const [kind, setKind] = React.useState<'wish' | 'bug'>('wish');
	const [mainMessage, setMainMessage] = React.useState('');
	const [structuredOpen, setStructuredOpen] = React.useState(false);
	const [wishForm, setWishForm] = React.useState(createEmptyWishForm);
	const [bugForm, setBugForm] = React.useState(createEmptyBugForm);
	const mainMessageRef = React.useRef<HTMLTextAreaElement | null>(null);
	const bugExpectedRef = React.useRef<HTMLTextAreaElement | null>(null);

	React.useImperativeHandle(ref, () => ({
		focusMainMessage: () => {
			mainMessageRef.current?.focus();
			mainMessageRef.current?.scrollIntoView({
				behavior: 'smooth',
				block: 'nearest',
			});
		},
	}));

	React.useEffect(() => {
		onGuideLayoutChange?.(`${kind}-${structuredOpen}`);
	}, [kind, structuredOpen, onGuideLayoutChange]);

	const handleSubmitKindChange = React.useCallback(
		(nextKind: 'wish' | 'bug') => {
			if (kind === nextKind) return;
			setKind(nextKind);
			setWishForm(createEmptyWishForm());
			setBugForm(createEmptyBugForm());
		},
		[kind]
	);

	const structuredPart = React.useMemo(() => {
		if (!structuredOpen) return '';
		return kind === 'wish'
			? assembleWishBody(wishForm, t)
			: assembleBugBody(bugForm, t);
	}, [structuredOpen, kind, wishForm, bugForm, t]);

	const bodyForSubmit = React.useMemo(
		() => buildFeedbackSubmitBody(mainMessage, structuredPart),
		[mainMessage, structuredPart]
	);

	const textLen = bodyForSubmit.length;
	const overLimit = isFeedbackBodyOverLimit(textLen, FEEDBACK_BODY_MAX);
	const charNearLimit = isFeedbackBodyNearLimit(textLen, FEEDBACK_BODY_MAX);

	const wishAtLimit =
		summary !== undefined && summary.wish_count >= summary.wish_limit;
	const bugAtLimit =
		summary !== undefined && summary.bug_count >= summary.bug_limit;
	const kindQuotaBlocked = kind === 'wish' ? wishAtLimit : bugAtLimit;
	const kindQuotaNear =
		summary !== undefined &&
		!kindQuotaBlocked &&
		(kind === 'wish'
			? isFeedbackQuotaNearLimit(summary.wish_count, summary.wish_limit)
			: isFeedbackQuotaNearLimit(summary.bug_count, summary.bug_limit));

	const sendMutation = useMutation({
		mutationFn: () => {
			const env = import.meta.env as {
				VITE_APP_VERSION?: string;
				MODE: string;
			};
			const viteVersion =
				typeof env.VITE_APP_VERSION === 'string'
					? env.VITE_APP_VERSION
					: undefined;
			return createFeedbackTicket({
				kind,
				body: bodyForSubmit.trim(),
				client_meta: buildFeedbackClientMeta({
					mode: env.MODE,
					viteAppVersion: viteVersion,
					userAgent:
						typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
				}),
			});
		},
		onSuccess: async (created) => {
			setMainMessage('');
			setStructuredOpen(false);
			setWishForm(createEmptyWishForm());
			setBugForm(createEmptyBugForm());
			toast.success(t('toastSent'));
			onTicketCreated(created);
			await qc.invalidateQueries({ queryKey: FEEDBACK_QUERY_ROOT });
			await qc.invalidateQueries({ queryKey: feedbackSummaryQueryKey() });
			await qc.refetchQueries({
				queryKey: feedbackTicketsPagedQueryKey(listKindFilter),
			});
		},
		onError: (e: unknown) => {
			toast.error(mapFeedbackSubmitError(e, t));
		},
	});

	const submitBlockReason = getFeedbackSubmitBlockReason({
		bodyTrimmed: bodyForSubmit.trim(),
		overLimit,
		kindQuotaBlocked,
		kind,
		pending: sendMutation.isPending,
	});
	const submitAllowed = canSubmitFeedback(submitBlockReason);
	const sendButtonAriaLabel = t(feedbackSendAriaI18nKey(submitBlockReason));

	const formKeyDown = React.useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey)) return;
			e.preventDefault();
			if (!submitAllowed) return;
			sendMutation.mutate();
		},
		[submitAllowed, sendMutation]
	);

	React.useEffect(() => {
		if (initialQuickMode === 'text') {
			window.setTimeout(() => mainMessageRef.current?.focus(), 0);
		}
	}, [initialQuickMode]);

	React.useEffect(() => {
		const draft = (initialDraftBody ?? '').trim();
		if (!draft) return;
		setMainMessage(draft);
		setStructuredOpen(false);
		setKind('wish');
		window.setTimeout(() => mainMessageRef.current?.focus(), 0);
	}, [initialDraftBody]);

	return (
		<DesktopAppSurface
			variant="panelStrong"
			padding="lg"
			className="relative"
			aria-labelledby="feedback-new-ticket-heading"
		>
			<div
				className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(120%_60%_at_100%_0%,rgb(var(--desktop-accent-rgb)/0.07),transparent_55%)]"
				aria-hidden
			/>
			<form
				className="relative space-y-6"
				onSubmit={(e) => e.preventDefault()}
				onKeyDown={formKeyDown}
			>
				<div>
					<h3
						id="feedback-new-ticket-heading"
						className={cn(
							DESKTOP_TYPOGRAPHY.subtitle,
							'flex items-center gap-2 border-b border-(--desktop-border-subtle) pb-3'
						)}
					>
						<PencilIcon
							className="h-5 w-5 shrink-0 text-[rgb(var(--desktop-accent-rgb)/0.9)]"
							aria-hidden
							strokeWidth={DESKTOP_LUCIDE.stroke}
						/>
						{t('newTicket')}
					</h3>
				</div>

				<section
					className={cn(
						'rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle)',
						'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_95%,transparent)] p-4 sm:p-5',
						'shadow-(--desktop-shadow-soft)'
					)}
					aria-labelledby="feedback-kind-heading"
					data-feedback-hub-guide="compose-kind"
				>
					<h4
						id="feedback-kind-heading"
						className={cn('mb-4', FEEDBACK_HUB_SECTION_HEADING_CLASS)}
					>
						{t('legendKindFieldset')}
					</h4>
					<fieldset className={kindToggleClusterClass}>
						<legend className="sr-only">{t('legendKindFieldset')}</legend>
						<button
							type="button"
							onClick={() => handleSubmitKindChange('wish')}
							aria-pressed={kind === 'wish'}
							className={cn(
								FEEDBACK_HUB_KIND_TOGGLE_BUTTON_CLASS,
								kind === 'wish'
									? 'bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb))_42%,var(--desktop-surface-panel))] text-(--desktop-text-primary) shadow-(--desktop-shadow-soft) ring-1 ring-[rgb(var(--desktop-accent-rgb)/0.35)] font-semibold'
									: 'text-(--desktop-text-muted) hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-primary)'
							)}
						>
							<LightBulbIcon
								className="h-4 w-4 shrink-0 opacity-90"
								aria-hidden
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
							{t('wish')}
						</button>
						<button
							type="button"
							onClick={() => handleSubmitKindChange('bug')}
							aria-pressed={kind === 'bug'}
							className={cn(
								FEEDBACK_HUB_KIND_TOGGLE_BUTTON_CLASS,
								kind === 'bug'
									? 'bg-[color-mix(in_srgb,rgb(244_63_94)_35%,var(--desktop-surface-panel))] text-(--desktop-text-primary) shadow-(--desktop-shadow-soft) ring-1 ring-rose-400/35 font-semibold'
									: 'text-(--desktop-text-muted) hover:bg-(--desktop-surface-soft-hover) hover:text-(--desktop-text-primary)'
							)}
						>
							<BugAntIcon
								className="h-4 w-4 shrink-0 opacity-90"
								aria-hidden
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
							{t('bug')}
						</button>
					</fieldset>
				</section>

				<section
					className={cn(
						'rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle)',
						'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_95%,transparent)] p-4 sm:p-5',
						'shadow-(--desktop-shadow-soft)'
					)}
					aria-labelledby="feedback-main-heading"
					data-feedback-hub-guide="compose-form"
				>
					<h4
						id="feedback-main-heading"
						className={cn('mb-2', FEEDBACK_HUB_SECTION_HEADING_CLASS)}
					>
						{t('mainMessageLabel')}
					</h4>
					<p
						id={FEEDBACK_HUB_MAIN_MESSAGE_HINT_ID}
						className={`mb-3 ${DESKTOP_TYPOGRAPHY.bodyMuted} leading-relaxed`}
					>
						{t('mainMessageHint')}
					</p>
					<textarea
						id={FEEDBACK_HUB_MAIN_MESSAGE_FIELD_ID}
						ref={mainMessageRef}
						value={mainMessage}
						onChange={(e) => setMainMessage(e.target.value)}
						rows={8}
						placeholder={
							kind === 'wish'
								? t('mainWishPlaceholder')
								: t('mainBugPlaceholder')
						}
						aria-label={t('mainMessageLabel')}
						aria-describedby={FEEDBACK_HUB_MAIN_MESSAGE_HINT_ID}
						className={cn(
							FEEDBACK_HUB_FORM_TEXTAREA_CLASS,
							'rounded-(--desktop-radius-lg) px-3 py-3 min-h-[140px]'
						)}
					/>
					<div className="mt-4">
						<DesktopAppButton
							type="button"
							size="sm"
							variant="neutral"
							className="gap-2 border border-(--desktop-border-subtle)"
							aria-expanded={structuredOpen}
							aria-controls={FEEDBACK_HUB_STRUCTURE_SECTION_ID}
							onClick={() => setStructuredOpen((v) => !v)}
						>
							<BookOpenIcon
								className="h-4 w-4 shrink-0 text-[rgb(var(--desktop-accent-rgb)/0.9)]"
								aria-hidden
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
							<ChevronDownIcon
								className={cn(
									'h-4 w-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none',
									structuredOpen && 'rotate-180'
								)}
								aria-hidden
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
							{structuredOpen ? t('structuredCollapse') : t('structuredExpand')}
						</DesktopAppButton>
					</div>
				</section>

				{structuredOpen && (
					<section
						id={FEEDBACK_HUB_STRUCTURE_SECTION_ID}
						className={cn(
							'rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle)',
							'bg-[color-mix(in_srgb,var(--desktop-surface-soft)_95%,transparent)] p-4 sm:p-5',
							'shadow-(--desktop-shadow-soft)'
						)}
						aria-labelledby="feedback-structure-heading"
					>
						<div className="mb-5 flex gap-4 sm:items-start">
							<div
								className="flex h-11 w-11 shrink-0 items-center justify-center rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft)"
								aria-hidden
							>
								<BookOpenIcon
									className="h-5 w-5 text-[rgb(var(--desktop-accent-rgb)/0.9)]"
									strokeWidth={DESKTOP_LUCIDE.stroke}
								/>
							</div>
							<div className="min-w-0 flex-1 space-y-1.5">
								<h4
									id="feedback-structure-heading"
									className={cn(
										FEEDBACK_HUB_SECTION_HEADING_CLASS,
										DESKTOP_TYPOGRAPHY.subtitle
									)}
								>
									{t('structureTemplateTitle')}
								</h4>
								<p
									className={`${DESKTOP_TYPOGRAPHY.bodyMuted} leading-relaxed`}
								>
									{t('structureTemplateHint')}
								</p>
							</div>
						</div>

						{kind === 'wish' ? (
							<div className="space-y-4">
								{WISH_FORM_KEYS.map((wk, idx) => {
									const titleKey = `cheatSheetWishP${idx + 1}` as
										| 'cheatSheetWishP1'
										| 'cheatSheetWishP2'
										| 'cheatSheetWishP3'
										| 'cheatSheetWishP4'
										| 'cheatSheetWishP5';
									const hintKey = `cheatSheetWishP${idx + 1}Hint` as
										| 'cheatSheetWishP1Hint'
										| 'cheatSheetWishP2Hint'
										| 'cheatSheetWishP3Hint'
										| 'cheatSheetWishP4Hint'
										| 'cheatSheetWishP5Hint';
									const row = wishForm[wk];
									return (
										<div
											key={wk}
											className="rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel)/80 p-4"
										>
											<div className="flex gap-3 sm:gap-4">
												<input
													type="checkbox"
													checked={row.include}
													onChange={(e) =>
														setWishForm((prev) => ({
															...prev,
															[wk]: {
																...prev[wk],
																include: e.target.checked,
															},
														}))
													}
													className={cn(
														'mt-1 h-5 w-5 shrink-0 rounded border border-(--desktop-border-subtle)',
														'bg-(--desktop-surface-soft) accent-[rgb(var(--desktop-accent-rgb))]'
													)}
													aria-label={t('includeBlockAria', {
														label: t(titleKey),
													})}
												/>
												<div className="min-w-0 flex-1 space-y-2">
													<label
														className={cn(
															'block cursor-pointer leading-snug',
															FEEDBACK_HUB_SECTION_HEADING_CLASS
														)}
														htmlFor={feedbackHubWishFieldId(wk)}
													>
														{t(titleKey)}
													</label>
													<p
														className={`${DESKTOP_TYPOGRAPHY.meta} leading-relaxed`}
													>
														{t(hintKey)}
													</p>
													<textarea
														id={feedbackHubWishFieldId(wk)}
														rows={wk === 'p3' || wk === 'p5' ? 3 : 2}
														disabled={!row.include}
														value={row.text}
														onChange={(e) =>
															setWishForm((prev) => ({
																...prev,
																[wk]: {
																	...prev[wk],
																	text: e.target.value,
																},
															}))
														}
														className={cn(
															FEEDBACK_HUB_FORM_TEXTAREA_CLASS,
															'mt-1 rounded-(--desktop-radius) px-3 py-2.5',
															!row.include && 'cursor-not-allowed opacity-50'
														)}
													/>
												</div>
											</div>
										</div>
									);
								})}
							</div>
						) : (
							<div className="space-y-4">
								{(
									[
										{
											k: 'expected' as const,
											title: 'cheatSheetBugP1' as const,
											hint: 'cheatSheetBugP1Hint' as const,
											ref: bugExpectedRef,
											rows: 2,
										},
										{
											k: 'actual' as const,
											title: 'cheatSheetBugP2' as const,
											hint: 'cheatSheetBugP2Hint' as const,
											ref: undefined,
											rows: 2,
										},
										{
											k: 'steps' as const,
											title: 'cheatSheetBugP3' as const,
											hint: 'cheatSheetBugP3Hint' as const,
											ref: undefined,
											rows: 4,
										},
										{
											k: 'context' as const,
											title: 'cheatSheetBugP5' as const,
											hint: 'cheatSheetBugP5Hint' as const,
											ref: undefined,
											rows: 2,
										},
									] as const
								).map(({ k, title, hint, ref: fieldRef, rows }) => {
									const row = bugForm[k];
									const fieldId = feedbackHubBugFieldId(k);
									return (
										<div
											key={k}
											className="rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel)/80 p-4"
										>
											<div className="flex gap-3 sm:gap-4">
												<input
													type="checkbox"
													checked={row.include}
													onChange={(e) =>
														setBugForm((prev) => ({
															...prev,
															[k]: {
																...prev[k],
																include: e.target.checked,
															},
														}))
													}
													className={cn(
														'mt-1 h-5 w-5 shrink-0 rounded border border-(--desktop-border-subtle)',
														'bg-(--desktop-surface-soft) accent-[rgb(var(--desktop-accent-rgb))]'
													)}
													aria-label={t('includeBlockAria', {
														label: t(title),
													})}
												/>
												<div className="min-w-0 flex-1 space-y-2">
													<label
														className={cn(
															'block cursor-pointer leading-snug',
															FEEDBACK_HUB_SECTION_HEADING_CLASS
														)}
														htmlFor={fieldId}
													>
														{t(title)}
													</label>
													<p
														className={`${DESKTOP_TYPOGRAPHY.meta} leading-relaxed`}
													>
														{t(hint)}
													</p>
													<textarea
														id={fieldId}
														ref={fieldRef}
														rows={rows}
														disabled={!row.include}
														value={row.text}
														onChange={(e) =>
															setBugForm((prev) => ({
																...prev,
																[k]: {
																	...prev[k],
																	text: e.target.value,
																},
															}))
														}
														className={cn(
															FEEDBACK_HUB_FORM_TEXTAREA_CLASS,
															'mt-1 rounded-(--desktop-radius) px-3 py-2.5',
															!row.include && 'cursor-not-allowed opacity-50'
														)}
													/>
												</div>
											</div>
										</div>
									);
								})}

								<section
									className="rounded-(--desktop-radius-lg) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel)/80 p-4"
									aria-labelledby="feedback-bug-frequency-heading"
								>
									<h4
										id="feedback-bug-frequency-heading"
										className={FEEDBACK_HUB_SECTION_HEADING_CLASS}
									>
										{t('cheatSheetBugP4')}
									</h4>
									<p
										className={`mt-2 ${DESKTOP_TYPOGRAPHY.meta} leading-relaxed`}
									>
										{t('cheatSheetBugP4Hint')}
									</p>
									<div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
										{(['always', 'sometimes', 'once'] as const).map((f) => (
											<label
												key={f}
												className={cn(
													'flex cursor-pointer items-center gap-2.5',
													DESKTOP_TYPOGRAPHY.body,
													'text-(--desktop-text-primary)'
												)}
											>
												<input
													type="checkbox"
													checked={bugForm.freq === f}
													onChange={() =>
														setBugForm((prev) => ({
															...prev,
															freq: prev.freq === f ? null : f,
														}))
													}
													className={cn(
														'h-5 w-5 shrink-0 rounded border border-(--desktop-border-subtle)',
														'bg-(--desktop-surface-soft) accent-[rgb(var(--desktop-accent-rgb))]'
													)}
												/>
												{t(BUG_FREQ_LABEL_KEYS[f])}
											</label>
										))}
									</div>
								</section>
							</div>
						)}
					</section>
				)}

				{kindQuotaNear && (
					<div
						className={cn(
							'mb-3 rounded-(--desktop-radius) border border-amber-500/25 bg-amber-500/8 px-3 py-2',
							DESKTOP_TYPOGRAPHY.small,
							'text-amber-100/90'
						)}
						role="status"
					>
						{kind === 'wish' ? t('quotaNearWish') : t('quotaNearBug')}
					</div>
				)}

				{kindQuotaBlocked && (
					<div
						className={cn(
							'mb-3 rounded-(--desktop-radius) border border-amber-500/30 bg-amber-500/10 px-3 py-2',
							DESKTOP_TYPOGRAPHY.small,
							'text-amber-100/95'
						)}
						role="status"
					>
						{kind === 'wish' ? t('quotaFullWish') : t('quotaFullBug')}
					</div>
				)}

				<FeedbackHubComposePreview
					bodyForSubmit={bodyForSubmit}
					textLen={textLen}
					overLimit={overLimit}
					charNearLimit={charNearLimit}
					t={t}
				/>

				<div
					className={cn(
						sendActionBarClass,
						embeddedMobileLayout &&
							'sticky bottom-0 z-10 -mx-5 border-t border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-panel)_96%,transparent)] backdrop-blur-sm pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]'
					)}
					data-feedback-hub-guide="send-bar"
				>
					<DesktopAppButton
						type="button"
						size="sm"
						variant="accent"
						disabled={!submitAllowed}
						aria-label={sendButtonAriaLabel}
						aria-describedby={FEEDBACK_HUB_SEND_SHORTCUT_HINT_ID}
						onClick={() => sendMutation.mutate()}
						className="gap-2 min-h-11 px-4"
					>
						{sendMutation.isPending ? (
							<ArrowPathIcon
								className="h-4 w-4 animate-spin"
								aria-hidden
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						) : (
							<PaperAirplaneIcon
								className="h-4 w-4"
								aria-hidden
								strokeWidth={DESKTOP_LUCIDE.stroke}
							/>
						)}
						{t('send')}
					</DesktopAppButton>
				</div>
			</form>
		</DesktopAppSurface>
	);
});
