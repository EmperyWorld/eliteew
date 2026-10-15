/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Presents ensemble blueprint answers as business documents with plan, evidence,
 * quality checks, and (Wave F2) optional Совещание from `council_transcript`.
 *
 * Invariants:
 * - The markdown body is still rendered by the safe Desktop AI markdown renderer; metadata only controls chrome.
 * - TOC navigation resolves headings inside the rendered markdown container (id, then exact title).
 * - Sources are shown once in their dedicated tab and may arrive from live state or persisted metadata.
 * - Совещание tab appears only when normalized council_transcript has turns or roster.
 *
 * Related:
 * - api/services/desktop_chat_ensemble/blueprint/stream_turn.py
 * - src/features/desktop-ai-chat/DesktopAiCollapsibleAssistantMarkdown.tsx
 * - src/features/desktop-ai-chat/components/DesktopAiCouncilProcessPanel.tsx
 */
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import {
	DESKTOP_INTERACTIVE,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';

import type { DesktopAiMessage } from './api/desktopChatClient';
import { DesktopAiCollapsibleAssistantMarkdown } from './DesktopAiCollapsibleAssistantMarkdown';
import { DesktopAiChatIconTooltip } from './components/desktopAiChatIconTooltip';
import { DesktopAiCouncilProcessPanel } from './components/DesktopAiCouncilProcessPanel';
import { DesktopAiEvidenceLedger } from './components/DesktopAiEvidenceLedger';
import {
	resolveDesktopAiArtifactQuality,
	resolveDesktopAiMessageEvidenceSources,
	formatDesktopAiQualityViolation,
	formatDesktopAiRequiredContextLabel,
} from './desktopAiEvidence';
import { normalizeDesktopCouncilTranscript } from './desktopChatDocumentReplacement';
import { type DesktopAiWebSearchSource } from './desktopWebSearchSources';
import { DesktopChromeTooltip } from '@/pages/Desktop/components/DesktopChromeTooltip';
import { getDesktopAiHero } from './desktopAiHeroes';
import {
	desktopAiDocumentScrollBehavior,
	extractDesktopAiMarkdownHeadings,
	resolveDesktopAiMarkdownHeadingElement,
	slugifyDesktopAiMarkdownHeading,
	type DesktopAiMarkdownHeading,
} from './utils/desktopAiExpertDocument';
import { DesktopAiInterviewHandoffStartButton } from './discussion/DesktopAiInterviewHandoffStartButton';
import { canShowInterviewHandoffCta } from './discussion/interviewHandoff';
import {
	ArrowPathIcon,
	ArrowDownTrayIcon,
	FolderPlusIcon,
} from '@heroicons/react/24/outline';

export type BlueprintHeading = DesktopAiMarkdownHeading;
export const extractBlueprintMarkdownHeadings =
	extractDesktopAiMarkdownHeadings;
export const resolveBlueprintHeadingElement =
	resolveDesktopAiMarkdownHeadingElement;

type BlueprintTab = 'document' | 'council' | 'plan' | 'evidence' | 'checks';

export function blueprintQualityTone(
	status: string | undefined
): 'good' | 'warn' | 'muted' {
	if (status === 'verified' || status === 'repaired' || status === 'grounded')
		return 'good';
	if (
		status === 'needs_review' ||
		status === 'hypothesis_only' ||
		status === 'derived_context'
	)
		return 'warn';
	return 'muted';
}

function headingsFromMetadata(
	message: DesktopAiMessage,
	markdown: string
): BlueprintHeading[] {
	const outline = message.metadata?.document_outline;
	if (Array.isArray(outline) && outline.length > 0) {
		const out: BlueprintHeading[] = [];
		for (const [index, sec] of outline.entries()) {
			const title = typeof sec.heading === 'string' ? sec.heading.trim() : '';
			if (!title) continue;
			out.push({
				id: slugifyDesktopAiMarkdownHeading(title) || `section-${index + 1}`,
				title,
				level: 2,
			});
		}
		return out;
	}
	return extractBlueprintMarkdownHeadings(markdown).filter(
		(h) => h.level === 2
	);
}

function qualityClass(tone: ReturnType<typeof blueprintQualityTone>): string {
	if (tone === 'good') {
		return 'border-emerald-400/35 bg-emerald-400/10 text-emerald-100';
	}
	if (tone === 'warn') {
		return 'border-amber-300/40 bg-amber-300/10 text-amber-100';
	}
	return 'border-[rgb(var(--desktop-accent-rgb)/0.28)] bg-[rgb(var(--desktop-accent-rgb)/0.09)] text-(--desktop-text-secondary)';
}

export function BlueprintQualityChip({
	status,
	label,
	violations = [],
}: {
	status?: string;
	label: string;
	violations?: string[];
}) {
	const { t } = useTranslation('desktopAiChat');
	const tone = blueprintQualityTone(status);
	const violationLines = violations
		.map((v) => String(v || '').trim())
		.filter(Boolean)
		.slice(0, 8);
	const hypothesisTooltip =
		status === 'hypothesis_only'
			? t('blueprintQualityHypothesisTooltip')
			: undefined;
	const reviewTooltip =
		status === 'needs_review' && violationLines.length > 0
			? t('blueprintQualityViolationsTooltip', {
					list: violationLines
						.map((v) => formatDesktopAiQualityViolation(v))
						.join(' · '),
				})
			: status === 'needs_review'
				? t('blueprintQualityNeedsReviewTooltip')
				: undefined;
	const tooltip = reviewTooltip || hypothesisTooltip;
	const chip = (
		<span
			className={cn(
				'rounded-full border px-2 py-1 text-[0.68rem] font-semibold uppercase tracking-wide',
				qualityClass(tone)
			)}
		>
			{label}
		</span>
	);
	return tooltip ? (
		<DesktopChromeTooltip content={tooltip} placement="top" offsetExtra={4}>
			{chip}
		</DesktopChromeTooltip>
	) : (
		chip
	);
}

function initialBlueprintTab(message: DesktopAiMessage): BlueprintTab {
	const quality = message.metadata?.quality_status;
	const resolved = resolveDesktopAiArtifactQuality(quality);
	const violations = Array.isArray(quality?.violations)
		? quality.violations
		: [];
	if (
		resolved.finalization === 'needs_review' &&
		violations.some((item) => String(item || '').trim())
	) {
		return 'checks';
	}
	if (resolved.grounding === 'hypothesis_only') {
		const required = Array.isArray(quality?.required_context)
			? quality.required_context
			: [];
		if (required.length > 0) {
			return 'checks';
		}
	}
	return 'document';
}

export function DesktopAiBlueprintArtifactBubble({
	message,
	markdown,
	maxCollapsedPx,
	ensembleBodyTint,
	sources = [],
	showSaveToProject = false,
	saveToProjectBusy = false,
	onSaveToProject,
	onExportMarkdown,
	onStartInterview,
	interviewStartBusy = false,
}: {
	message: DesktopAiMessage;
	markdown: string;
	maxCollapsedPx: number;
	ensembleBodyTint?: string;
	sources?: DesktopAiWebSearchSource[];
	showSaveToProject?: boolean;
	saveToProjectBusy?: boolean;
	onSaveToProject?: () => void;
	onExportMarkdown?: () => void;
	onStartInterview?: (message: DesktopAiMessage) => void;
	interviewStartBusy?: boolean;
}) {
	const { t } = useTranslation('desktopAiChat');
	const [tab, setTab] = React.useState<BlueprintTab>(() =>
		initialBlueprintTab(message)
	);
	const meta = message.metadata;
	const quality = meta?.quality_status;
	const resolvedQuality = resolveDesktopAiArtifactQuality(quality);
	const qualityStatus =
		resolvedQuality.finalization !== 'unknown'
			? resolvedQuality.finalization
			: resolvedQuality.grounding;
	const qualityLabel =
		resolvedQuality.finalization !== 'unknown'
			? t(`qualityFinalization.${resolvedQuality.finalization}.title`)
			: resolvedQuality.grounding !== 'unknown'
				? t(`qualityGrounding.${resolvedQuality.grounding}.title`)
				: t('qualityFinalization.unknown.title');
	const headings = headingsFromMetadata(message, markdown);
	const canTakeInterview = canShowInterviewHandoffCta(message, {
		hasStartHandler: Boolean(onStartInterview),
		markdown,
	});
	const steps = Array.isArray(meta?.steps_preview) ? meta.steps_preview : [];
	const contributors = Array.isArray(meta?.desktop_ensemble_contributors)
		? meta.desktop_ensemble_contributors
		: [];
	const requiredContext = Array.isArray(quality?.required_context)
		? quality.required_context
		: Array.isArray(meta?.quality_status?.required_context)
			? meta.quality_status.required_context
			: [];
	const qualityViolations = Array.isArray(quality?.violations)
		? quality.violations
				.map((item) => String(item || '').trim())
				.filter(Boolean)
		: [];
	const deferredTemplates = Array.isArray(meta?.deferred_plan_templates)
		? meta.deferred_plan_templates
		: [];
	const evidenceSources = resolveDesktopAiMessageEvidenceSources(meta, sources);
	const councilTranscript = normalizeDesktopCouncilTranscript(
		meta?.council_transcript
	);
	const showCouncilTab = Boolean(councilTranscript);
	const isHypothesisOnly =
		resolvedQuality.grounding === 'hypothesis_only' ||
		(resolvedQuality.grounding === 'unknown' && evidenceSources.length === 0);
	const documentBodyRef = React.useRef<HTMLDivElement>(null);
	const [documentExpanded, setDocumentExpanded] = React.useState(false);

	const scrollToHeading = React.useCallback((heading: BlueprintHeading) => {
		setTab('document');
		setDocumentExpanded(true);
		window.requestAnimationFrame(() => {
			const root = documentBodyRef.current;
			if (!root) {
				return;
			}
			const target = resolveBlueprintHeadingElement(root, heading);
			target?.scrollIntoView({
				behavior: desktopAiDocumentScrollBehavior(),
				block: 'start',
			});
		});
	}, []);
	const tabClass = (id: BlueprintTab) =>
		cn(
			'rounded-md border px-2 py-1 text-[0.68rem] font-semibold uppercase tracking-wide transition-colors',
			tab === id
				? 'border-[rgb(var(--desktop-accent-rgb)/0.45)] bg-[rgb(var(--desktop-accent-rgb)/0.16)] text-(--desktop-text-primary)'
				: 'border-(--desktop-border-subtle) bg-transparent text-(--desktop-text-muted) hover:text-(--desktop-text-primary)'
		);

	return (
		<section className="space-y-2.5">
			<header className="rounded-xl border border-[rgb(var(--desktop-accent-rgb)/0.24)] bg-[color-mix(in_srgb,rgb(var(--desktop-accent-rgb)/0.10)_100%,transparent)] px-3 py-2.5">
				<div className="flex flex-wrap items-start justify-between gap-2">
					<div className="min-w-0">
						<p
							className={cn(
								'font-semibold text-(--desktop-text-primary)',
								DESKTOP_TYPOGRAPHY.body
							)}
						>
							{meta?.plan_template_title || t('structuredPlanFallback')}
						</p>
						<p
							className={cn(
								'mt-0.5 text-(--desktop-text-muted)',
								DESKTOP_TYPOGRAPHY.captionInherit
							)}
						>
							{t('blueprintArtifactSubtitle')}
						</p>
					</div>
					<div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
						{canTakeInterview ? (
							<DesktopAiInterviewHandoffStartButton
								busy={interviewStartBusy}
								onClick={() => onStartInterview?.(message)}
								t={t}
							/>
						) : null}
						{onExportMarkdown ? (
							<DesktopAiChatIconTooltip content={t('blueprintExportMdTitle')}>
								<button
									type="button"
									className={cn(
										'inline-flex items-center gap-1 rounded-md border border-(--desktop-border-subtle) px-2 py-1 text-[0.68rem] font-semibold text-(--desktop-text-primary) transition-colors',
										'hover:bg-[color-mix(in_srgb,rgb(var(--desktop-fg-primary-rgb)/0.08)_100%,transparent)]',
										DESKTOP_INTERACTIVE
									)}
									onClick={onExportMarkdown}
									aria-label={t('blueprintExportMdAria')}
								>
									<ArrowDownTrayIcon className="h-3.5 w-3.5" aria-hidden />
									<span>{t('blueprintExportMdShort')}</span>
								</button>
							</DesktopAiChatIconTooltip>
						) : null}
						{showSaveToProject && onSaveToProject ? (
							<DesktopAiChatIconTooltip
								content={t('saveBlueprintToProjectTitle')}
							>
								<button
									type="button"
									className={cn(
										'inline-flex items-center gap-1 rounded-md border border-[rgb(var(--desktop-accent-rgb)/0.35)] px-2 py-1 text-[0.68rem] font-semibold text-(--desktop-text-primary) transition-colors',
										'hover:bg-[rgb(var(--desktop-accent-rgb)/0.12)] disabled:opacity-60',
										DESKTOP_INTERACTIVE
									)}
									disabled={saveToProjectBusy}
									onClick={onSaveToProject}
									aria-label={t('saveBlueprintToProjectAria')}
								>
									{saveToProjectBusy ? (
										<ArrowPathIcon
											className="h-3.5 w-3.5 animate-spin"
											aria-hidden
										/>
									) : (
										<FolderPlusIcon className="h-3.5 w-3.5" aria-hidden />
									)}
									<span>{t('saveBlueprintToProjectShort')}</span>
								</button>
							</DesktopAiChatIconTooltip>
						) : null}
						<BlueprintQualityChip
							status={qualityStatus}
							label={qualityLabel}
							violations={qualityViolations}
						/>
					</div>
				</div>
				{isHypothesisOnly ? (
					<p
						role="note"
						className={cn(
							'mt-2 rounded-md border border-amber-300/35 bg-amber-300/10 px-2.5 py-2 text-xs leading-snug text-amber-50/95',
							DESKTOP_TYPOGRAPHY.captionInherit
						)}
					>
						{t('blueprintHypothesisCallout')}
					</p>
				) : null}
				{qualityStatus === 'needs_review' && qualityViolations.length > 0 ? (
					<p
						role="note"
						className={cn(
							'mt-2 rounded-md border border-amber-300/35 bg-amber-300/10 px-2.5 py-2 text-xs leading-snug text-amber-50/95',
							DESKTOP_TYPOGRAPHY.captionInherit
						)}
					>
						{t('blueprintQualityViolationsCallout', {
							count: qualityViolations.length,
						})}
					</p>
				) : null}
				{deferredTemplates.length > 0 ? (
					<p
						role="note"
						className={cn(
							'mt-2 rounded-md border border-[rgb(var(--desktop-accent-rgb)/0.28)] bg-[rgb(var(--desktop-accent-rgb)/0.08)] px-2.5 py-2 text-xs leading-snug text-(--desktop-text-secondary)',
							DESKTOP_TYPOGRAPHY.captionInherit
						)}
					>
						{t('blueprintDeferredTemplatesCallout', {
							list: deferredTemplates
								.map((row) => {
									if (!row || typeof row !== 'object') return '';
									const title =
										typeof row.title === 'string' && row.title.trim()
											? row.title.trim()
											: typeof row.plan_template_id === 'string'
												? row.plan_template_id
												: '';
									return title;
								})
								.filter(Boolean)
								.join(', '),
						})}
					</p>
				) : null}
				{contributors.length > 0 ? (
					<div className="mt-2 flex flex-wrap gap-1">
						{contributors.map((hid) => (
							<span
								key={hid}
								className="rounded-md border border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_58%,transparent)] px-1.5 py-0.5 text-[0.68rem] text-(--desktop-text-secondary)"
							>
								{getDesktopAiHero(hid)?.shortLabel ?? hid}
							</span>
						))}
					</div>
				) : null}
			</header>

			<nav
				className="flex flex-wrap gap-1.5"
				aria-label={t('blueprintTabsAria')}
			>
				<button
					type="button"
					className={tabClass('document')}
					onClick={() => setTab('document')}
				>
					{t('blueprintTabDocument')}
				</button>
				{showCouncilTab ? (
					<button
						type="button"
						className={tabClass('council')}
						onClick={() => setTab('council')}
					>
						{t('councilTabProcess')}
					</button>
				) : null}
				<button
					type="button"
					className={tabClass('plan')}
					onClick={() => setTab('plan')}
				>
					{t('blueprintTabPlan')}
				</button>
				<button
					type="button"
					className={tabClass('evidence')}
					onClick={() => setTab('evidence')}
				>
					{t('blueprintTabEvidence')}
				</button>
				<button
					type="button"
					className={tabClass('checks')}
					onClick={() => setTab('checks')}
				>
					{t('blueprintTabChecks')}
				</button>
			</nav>

			{tab === 'council' && councilTranscript ? (
				<DesktopAiCouncilProcessPanel transcript={councilTranscript} />
			) : null}

			{tab === 'document' ? (
				<div className="space-y-2.5">
					{headings.length > 1 ? (
						<div className="rounded-lg border border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_50%,transparent)] px-3 py-2">
							<p className="text-[0.68rem] font-semibold uppercase tracking-wide text-(--desktop-text-muted)">
								{t('blueprintTocTitle')}
							</p>
							<ol className="mt-1.5 list-decimal space-y-1 pl-4 text-xs text-(--desktop-text-secondary)">
								{headings.map((h) => (
									<li key={h.id}>
										<button
											type="button"
											className={cn(
												'text-left underline-offset-2 hover:text-(--desktop-text-primary) hover:underline',
												DESKTOP_INTERACTIVE
											)}
											onClick={() => scrollToHeading(h)}
											aria-label={t('blueprintTocJump', { title: h.title })}
										>
											{h.title}
										</button>
									</li>
								))}
							</ol>
						</div>
					) : null}
					<div className="rounded-lg border border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_32%,transparent)] px-2 py-1.5">
						<DesktopAiCollapsibleAssistantMarkdown
							markdown={markdown}
							maxCollapsedPx={maxCollapsedPx}
							ensembleBodyTint={ensembleBodyTint}
							presentation="document"
							citationSources={evidenceSources}
							expanded={documentExpanded}
							onExpandedChange={setDocumentExpanded}
							contentRef={documentBodyRef}
						/>
					</div>
				</div>
			) : null}

			{tab === 'plan' ? (
				<div className="rounded-lg border border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_42%,transparent)] px-3 py-2">
					{steps.length > 0 ? (
						<ol className="list-decimal space-y-1.5 pl-4 text-xs text-(--desktop-text-secondary)">
							{steps.map((step, stepIndex) => {
								const hid =
									typeof step.hero_id === 'string' ? step.hero_id : '';
								const stepKey =
									(typeof step.step_id === 'string' && step.step_id.trim()) ||
									(typeof step.title === 'string' && step.title.trim()) ||
									hid ||
									'blueprint-step';
								return (
									<li key={stepKey}>
										<span className="font-medium text-(--desktop-text-primary)">
											{step.title ||
												t('ensembleStepFallback', { n: stepIndex + 1 })}
										</span>
										{hid ? (
											<span className="text-(--desktop-text-muted)">
												{' '}
												— {getDesktopAiHero(hid)?.shortLabel ?? hid}
											</span>
										) : null}
										{step.fallback ? (
											<span className="text-(--desktop-text-muted)">
												{' '}
												{t('ensembleReplacement')}
											</span>
										) : null}
									</li>
								);
							})}
						</ol>
					) : (
						<p className="text-xs text-(--desktop-text-muted)">
							{t('blueprintNoPlan')}
						</p>
					)}
				</div>
			) : null}

			{tab === 'evidence' ? (
				<div className="rounded-lg border border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_42%,transparent)] px-3 py-2">
					<DesktopAiEvidenceLedger
						sources={evidenceSources}
						qualityStatus={quality}
					/>
				</div>
			) : null}

			{tab === 'checks' ? (
				<div className="rounded-lg border border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_42%,transparent)] px-3 py-2 text-xs text-(--desktop-text-secondary)">
					<p className="font-semibold text-(--desktop-text-primary)">
						{t('blueprintChecksTitle')}
					</p>
					{qualityViolations.length > 0 ? (
						<div className="mt-2">
							<p className="font-medium text-amber-100">
								{t('blueprintChecksViolationsTitle')}
							</p>
							<ul className="mt-1.5 list-disc space-y-1 pl-4">
								{qualityViolations.map((item) => (
									<li key={item}>{formatDesktopAiQualityViolation(item)}</li>
								))}
							</ul>
						</div>
					) : null}
					{requiredContext.length > 0 ? (
						<ul className="mt-1.5 list-disc space-y-1 pl-4">
							{requiredContext.map((item) => (
								<li key={item}>
									{formatDesktopAiRequiredContextLabel(String(item))}
								</li>
							))}
						</ul>
					) : qualityViolations.length === 0 ? (
						<p className="mt-1">{t('blueprintChecksEmpty')}</p>
					) : null}
				</div>
			) : null}
		</section>
	);
}
