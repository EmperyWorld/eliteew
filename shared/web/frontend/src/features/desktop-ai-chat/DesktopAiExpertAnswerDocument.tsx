/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Present substantial solo and freeform assistant replies as premium, navigable professional documents.
 *
 * Invariants:
 * - The safe Desktop AI Markdown renderer remains the sole renderer for model content.
 * - Document chrome exposes structure and supported formats without inventing facts or model reasoning.
 * - Chrome stays compact (dense header; TOC collapses when many ##) without removing export, badges, TOC, or evidence.
 *
 * Related:
 * - src/features/desktop-ai-chat/utils/desktopAiExpertDocument.ts
 * - src/features/desktop-ai-chat/DesktopAiCollapsibleAssistantMarkdown.tsx
 * - src/features/desktop-ai-chat/components/DesktopAiWebSearchSources.tsx
 */
import {
	ArrowDownTrayIcon,
	CheckBadgeIcon,
	CommandLineIcon,
	DocumentTextIcon,
	ListBulletIcon,
	MagnifyingGlassIcon,
	ScaleIcon,
} from '@heroicons/react/24/outline';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import {
	DESKTOP_INTERACTIVE,
	DESKTOP_TYPOGRAPHY,
} from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';

import type {
	DesktopAiArtifactQualityStatus,
	DesktopAiContextSource,
} from './api/desktopChatClient';
import {
	DESKTOP_AI_EXPERT_DOC_COLLAPSE_PX,
	DesktopAiCollapsibleAssistantMarkdown,
} from './DesktopAiCollapsibleAssistantMarkdown';
import { DesktopAiChatIconTooltip } from './components/desktopAiChatIconTooltip';
import { DesktopAiEvidenceLedger } from './components/DesktopAiEvidenceLedger';
import { mergeDesktopAiEvidenceSources } from './desktopAiEvidence';
import type { DesktopAiWebSearchSource } from './desktopWebSearchSources';
import {
	desktopAiDocumentScrollBehavior,
	resolveDesktopAiMarkdownHeadingElement,
	type DesktopAiAnswerArtifactKind,
	type DesktopAiExpertDocumentAnalysis,
} from './utils/desktopAiExpertDocument';

/** Above this count, TOC starts collapsed so the body owns the fold. */
export const DESKTOP_AI_EXPERT_TOC_COLLAPSE_AFTER = 4;

const ANSWER_ARTIFACT_ICON: Record<
	DesktopAiAnswerArtifactKind,
	React.ComponentType<React.SVGProps<SVGSVGElement>>
> = {
	analysis: DocumentTextIcon,
	decision: CheckBadgeIcon,
	comparison: ScaleIcon,
	action_plan: ListBulletIcon,
	technical: CommandLineIcon,
	research: MagnifyingGlassIcon,
};

function DocumentCapabilityBadge({ children }: { children: React.ReactNode }) {
	return (
		<li
			className={cn(
				'inline-flex items-center rounded-md border border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_74%,transparent)] px-1.5 py-0.5 text-(--desktop-text-secondary)',
				DESKTOP_TYPOGRAPHY.micro
			)}
		>
			{children}
		</li>
	);
}

function ExpertTocList({
	headings,
	onJump,
	t,
}: {
	headings: DesktopAiExpertDocumentAnalysis['headings'];
	onJump: (
		heading: DesktopAiExpertDocumentAnalysis['headings'][number]
	) => void;
	t: (key: string, options?: { title?: string }) => string;
}) {
	return (
		<ol className="flex flex-wrap gap-1">
			{headings.map((heading, index) => (
				<li key={heading.id}>
					<button
						type="button"
						onClick={() => onJump(heading)}
						aria-label={t('expertAnswerTocJump', {
							title: heading.title,
						})}
						className={cn(
							'inline-flex max-w-56 items-center gap-1 rounded-md border border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_70%,transparent)] px-1.5 py-0.5 text-left text-(--desktop-text-secondary) hover:border-[rgb(var(--desktop-accent-rgb)/0.35)] hover:text-(--desktop-text-primary)',
							DESKTOP_TYPOGRAPHY.micro,
							DESKTOP_INTERACTIVE.btnRounded
						)}
					>
						<span
							className="shrink-0 font-semibold tabular-nums text-[rgb(var(--desktop-accent-rgb))]"
							aria-hidden
						>
							{String(index + 1).padStart(2, '0')}
						</span>
						<span className="truncate">{heading.title}</span>
					</button>
				</li>
			))}
		</ol>
	);
}

export function DesktopAiExpertAnswerDocument({
	markdown,
	analysis,
	ensembleBodyTint,
	evidenceSources = [],
	qualityStatus,
	sources = [],
	onExportMarkdown,
}: {
	markdown: string;
	analysis: DesktopAiExpertDocumentAnalysis;
	ensembleBodyTint?: string;
	evidenceSources?: DesktopAiContextSource[];
	qualityStatus?: DesktopAiArtifactQualityStatus | null;
	/** Historical caller compatibility; web rows are merged into the shared ledger. */
	sources?: DesktopAiWebSearchSource[];
	onExportMarkdown?: () => void;
}) {
	const { t } = useTranslation('desktopAiChat');
	const contentRef = React.useRef<HTMLDivElement>(null);
	const [expanded, setExpanded] = React.useState(false);
	const navigableHeadings = analysis.headings.filter(
		(heading) => heading.level === 2
	);
	const tocCollapsedByDefault =
		navigableHeadings.length > DESKTOP_AI_EXPERT_TOC_COLLAPSE_AFTER;
	const artifactCopy = {
		analysis: {
			title: t('expertAnswerTitle'),
			subtitle: t('expertAnswerSubtitle'),
		},
		decision: {
			title: t('expertAnswerDecisionTitle'),
			subtitle: t('expertAnswerDecisionSubtitle'),
		},
		comparison: {
			title: t('expertAnswerComparisonTitle'),
			subtitle: t('expertAnswerComparisonSubtitle'),
		},
		action_plan: {
			title: t('expertAnswerActionPlanTitle'),
			subtitle: t('expertAnswerActionPlanSubtitle'),
		},
		technical: {
			title: t('expertAnswerTechnicalTitle'),
			subtitle: t('expertAnswerTechnicalSubtitle'),
		},
		research: {
			title: t('expertAnswerResearchTitle'),
			subtitle: t('expertAnswerResearchSubtitle'),
		},
	}[analysis.artifactKind];
	const ArtifactIcon = ANSWER_ARTIFACT_ICON[analysis.artifactKind];
	const safeEvidenceSources = React.useMemo(
		() => mergeDesktopAiEvidenceSources(evidenceSources, sources),
		[evidenceSources, sources]
	);
	const sourceCount = Math.max(
		safeEvidenceSources.length,
		analysis.sourceCount
	);

	const scrollToHeading = React.useCallback(
		(heading: DesktopAiExpertDocumentAnalysis['headings'][number]) => {
			setExpanded(true);
			window.requestAnimationFrame(() => {
				const root = contentRef.current;
				if (!root) return;
				resolveDesktopAiMarkdownHeadingElement(root, heading)?.scrollIntoView({
					behavior: desktopAiDocumentScrollBehavior(),
					block: 'start',
				});
			});
		},
		[]
	);

	const capabilityBadges = (
		<ul
			className="flex flex-wrap gap-1"
			aria-label={t('expertAnswerFormatsAria')}
		>
			{analysis.headings.length > 0 ? (
				<DocumentCapabilityBadge>
					{t('expertAnswerSectionsBadge', {
						count: analysis.headings.length,
					})}
				</DocumentCapabilityBadge>
			) : null}
			{analysis.tableCount > 0 ? (
				<DocumentCapabilityBadge>
					{t('expertAnswerTablesBadge', { count: analysis.tableCount })}
				</DocumentCapabilityBadge>
			) : null}
			{analysis.diagramCount > 0 ? (
				<DocumentCapabilityBadge>
					{t('expertAnswerDiagramsBadge', {
						count: analysis.diagramCount,
					})}
				</DocumentCapabilityBadge>
			) : null}
			{analysis.codeBlockCount > 0 ? (
				<DocumentCapabilityBadge>
					{t('expertAnswerCodeBadge', {
						count: analysis.codeBlockCount,
					})}
				</DocumentCapabilityBadge>
			) : null}
			{analysis.checklistCount > 0 ? (
				<DocumentCapabilityBadge>
					{t('expertAnswerChecklistBadge', {
						count: analysis.checklistCount,
					})}
				</DocumentCapabilityBadge>
			) : null}
			{sourceCount > 0 ? (
				<DocumentCapabilityBadge>
					{t('expertAnswerSourcesBadge', { count: sourceCount })}
				</DocumentCapabilityBadge>
			) : null}
		</ul>
	);

	return (
		<article
			data-testid="desktop-ai-expert-document"
			aria-label={t('expertAnswerAria')}
			className="min-w-0 space-y-1.5"
		>
			<header className="rounded-lg border border-[rgb(var(--desktop-accent-rgb)/0.28)] bg-[linear-gradient(135deg,rgb(var(--desktop-accent-rgb)/0.12),color-mix(in_srgb,var(--desktop-surface-soft)_82%,transparent)_62%,transparent)] px-2 py-1.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
				<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
					<span
						className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-[rgb(var(--desktop-accent-rgb)/0.32)] bg-[rgb(var(--desktop-accent-rgb)/0.12)] text-[rgb(var(--desktop-accent-rgb))]"
						aria-hidden
					>
						<ArtifactIcon className="size-3.5" />
					</span>
					<p
						className={cn(
							'min-w-0 flex-1 truncate font-semibold tracking-wide text-[rgb(var(--desktop-accent-rgb))]',
							DESKTOP_TYPOGRAPHY.shellMeta10
						)}
						title={artifactCopy.subtitle}
					>
						<span className="uppercase tracking-widest">
							{t('expertAnswerKicker')}
						</span>
						<span className="mx-1 font-normal text-(--desktop-text-dim)">
							·
						</span>
						<span className="font-semibold normal-case tracking-normal text-(--desktop-text-primary)">
							{artifactCopy.title}
						</span>
					</p>
					{onExportMarkdown ? (
						<DesktopAiChatIconTooltip content={t('expertAnswerExportTitle')}>
							<button
								type="button"
								onClick={onExportMarkdown}
								aria-label={t('expertAnswerExportAria')}
								className={cn(
									'inline-flex min-h-7 shrink-0 items-center gap-1 rounded-md border border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_72%,transparent)] px-1.5 py-0.5 font-medium text-(--desktop-text-secondary) hover:text-(--desktop-text-primary)',
									DESKTOP_TYPOGRAPHY.micro,
									DESKTOP_INTERACTIVE.btnRounded
								)}
							>
								<ArrowDownTrayIcon className="size-3.5" aria-hidden />
								{t('expertAnswerExportShort')}
							</button>
						</DesktopAiChatIconTooltip>
					) : null}
					<div className="basis-full sm:basis-auto sm:ml-auto">
						{capabilityBadges}
					</div>
				</div>
			</header>

			{navigableHeadings.length > 1 ? (
				<nav
					aria-label={t('expertAnswerTocAria')}
					data-testid="desktop-ai-expert-toc"
					className="rounded-md border border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_52%,transparent)] px-2 py-1"
				>
					{tocCollapsedByDefault ? (
						<details className="group/toc min-w-0">
							<summary
								className={cn(
									'cursor-pointer list-none marker:content-none [&::-webkit-details-marker]:hidden flex items-center justify-between gap-2 rounded-md px-0.5 py-0.5 text-(--desktop-text-muted) hover:text-(--desktop-text-secondary)',
									DESKTOP_TYPOGRAPHY.micro,
									DESKTOP_INTERACTIVE.btnRounded
								)}
							>
								<span className="font-semibold tracking-wide">
									{t('expertAnswerTocSummary', {
										count: navigableHeadings.length,
									})}
								</span>
								<span className="text-(--desktop-text-dim) group-open/toc:hidden">
									{t('expertAnswerTocExpand')}
								</span>
								<span className="hidden text-(--desktop-text-dim) group-open/toc:inline">
									{t('expertAnswerTocCollapse')}
								</span>
							</summary>
							<div className="mt-1">
								<ExpertTocList
									headings={navigableHeadings}
									onJump={scrollToHeading}
									t={t}
								/>
							</div>
						</details>
					) : (
						<ExpertTocList
							headings={navigableHeadings}
							onJump={scrollToHeading}
							t={t}
						/>
					)}
				</nav>
			) : null}

			<div className="rounded-lg border border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-panel)_84%,transparent)] px-2.5 py-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.035)]">
				<DesktopAiCollapsibleAssistantMarkdown
					markdown={markdown}
					ensembleBodyTint={ensembleBodyTint}
					presentation="document"
					citationSources={safeEvidenceSources}
					maxCollapsedPx={DESKTOP_AI_EXPERT_DOC_COLLAPSE_PX}
					expanded={expanded}
					onExpandedChange={setExpanded}
					contentRef={contentRef}
				/>
			</div>
			<div className="rounded-md border border-(--desktop-border-subtle) bg-[color-mix(in_srgb,var(--desktop-surface-soft)_42%,transparent)] px-2 py-1.5">
				<DesktopAiEvidenceLedger
					sources={safeEvidenceSources}
					qualityStatus={qualityStatus}
				/>
			</div>
		</article>
	);
}
