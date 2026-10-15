/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Sticky activity strip at the bottom of the companion transcript (above composer):
 * current tool/step + laconic previous-step result (AMKA-style live progress).
 *
 * Invariants:
 * - Read-only summary; click focuses run in operations panel.
 * - Desktop and mobile: shown whenever there is an active progress item.
 *
 * Related:
 * - src/features/ewa/companionOperations/companionOperationsUi.ts
 * - src/features/ewa/companionUx/CompanionTranscriptMessageList.tsx
 */

import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import { looksLikeAgenticResearchScaffold } from '@/features/ewa/agentic/agenticObservabilityUi';
import { musicPipelinePhaseFromProgress } from '@/features/ewa/companionOperations/companionMusicPhaseLabels';
import {
	type CompanionTranscriptProgressItem,
	isMusicBackgroundIntent,
} from '@/features/ewa/companionOperations/companionOperationsUi';
import {
	companionProgressBarA11y,
	companionProgressBarValueTextKey,
} from '@/features/ewa/companionUx/companionProgressA11y';
import { DESKTOP_CHROME_FOCUS_VISIBLE } from '@/pages/Desktop/components/DesktopAppChrome';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';

export type CompanionActivityCenterStripProps = {
	items: CompanionTranscriptProgressItem[];
	onFocusRun: (runId: string) => void;
	reducedMotion?: boolean;
};

function laconicStepLine(
	raw: string | undefined | null,
	fallback: string
): string {
	const text = (raw || '').trim();
	if (!text) return fallback;
	if (looksLikeAgenticResearchScaffold(text)) {
		return fallback;
	}
	const first =
		text
			.split(/\n+/)
			.map((line) => line.trim())
			.find((line) => line && !/^#{1,6}\s/.test(line)) ?? text;
	const plain = first.replace(/[*_`]+/g, '').trim() || text;
	return plain.length > 160 ? `${plain.slice(0, 159)}…` : plain;
}

function stepResultLine(step: {
	title?: string | null;
	output_payload?: Record<string, unknown> | null;
}): string {
	const fromOutput =
		typeof step.output_payload?.summary === 'string'
			? step.output_payload.summary
			: typeof step.output_payload?.result_summary === 'string'
				? step.output_payload.result_summary
				: '';
	return laconicStepLine(fromOutput || step.title, '');
}

function deriveNowAndLast(item: CompanionTranscriptProgressItem): {
	nowLine: string;
	lastLine: string;
} {
	const steps = item.steps ?? [];
	let nowLine = laconicStepLine(
		item.subtitle || item.title,
		item.title.trim() || '…'
	);
	let lastLine = '';
	for (const step of steps) {
		const st = (step.status || '').trim().toLowerCase();
		if (st === 'running' || st === 'in_progress' || st === 'pending') {
			const candidate = laconicStepLine(step.title, nowLine);
			if (candidate) nowLine = candidate;
		}
	}
	for (let i = steps.length - 1; i >= 0; i -= 1) {
		const step = steps[i];
		const st = (step.status || '').trim().toLowerCase();
		if (st === 'completed' || st === 'failed') {
			lastLine = stepResultLine(step);
			if (lastLine) break;
		}
	}
	return { nowLine, lastLine };
}

export function CompanionActivityCenterStrip({
	items,
	onFocusRun,
	reducedMotion = false,
}: CompanionActivityCenterStripProps) {
	const { t } = useTranslation('marketing');
	if (items.length === 0) return null;

	const primary = items[0];
	const isMusic =
		isMusicBackgroundIntent(primary.intentKind) ||
		primary.intentKind === 'action_workflow';
	const phaseLabel =
		isMusic && primary.total > 0
			? musicPipelinePhaseFromProgress(primary.current, primary.total, t)
			: '';
	const pct =
		primary.total > 0
			? Math.min(100, Math.round((primary.current / primary.total) * 100))
			: 0;
	const progressA11y = companionProgressBarA11y(
		primary.current,
		primary.total,
		{ percentScale: true }
	);
	const { nowLine, lastLine } = deriveNowAndLast(primary);
	const primaryTitle = nowLine;

	return (
		<div
			className={cn(
				'sticky bottom-0 z-20 -mx-1 mt-2 rounded-xl border border-(--companion-divider)/80',
				'bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.88))] px-3 py-2.5 shadow-lg',
				!reducedMotion && 'companion-activity-pulse'
			)}
			data-testid="ewa-companion-activity-center"
			role="status"
			aria-live="polite"
		>
			<button
				type="button"
				className={cn(
					'flex w-full items-center gap-2 text-left',
					DESKTOP_CHROME_FOCUS_VISIBLE
				)}
				onClick={() => onFocusRun(primary.runId)}
				aria-label={t('ewaCompanion.activityCenterFocusAria', {
					title: primaryTitle,
					percent: progressA11y.percent,
				})}
			>
				<div className="min-w-0 flex-1">
					<p
						className={cn(
							DESKTOP_TYPOGRAPHY.caption,
							'text-[10px] font-semibold uppercase tracking-wider text-(--companion-aura)'
						)}
					>
						{t('ewaCompanion.activityCenterNowLabel', 'Сейчас')}
					</p>
					<p className="truncate text-[12px] text-(--desktop-text-primary)">
						{primaryTitle}
					</p>
					{lastLine && lastLine !== primaryTitle ? (
						<p className="mt-0.5 truncate text-[10px] text-(--companion-text-soft)">
							{t('ewaCompanion.activityCenterLastLabel', 'Было')}: {lastLine}
						</p>
					) : phaseLabel ? (
						<p className="text-[10px] text-(--companion-text-soft)">
							{phaseLabel}
						</p>
					) : null}
					<div
						className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-(--companion-divider)/50"
						role="progressbar"
						aria-valuemin={progressA11y.valueMin}
						aria-valuemax={progressA11y.valueMax}
						aria-valuenow={progressA11y.valueNow}
						aria-valuetext={t(
							companionProgressBarValueTextKey(progressA11y.mode),
							{
								current: progressA11y.current,
								total: progressA11y.total,
								percent: progressA11y.percent,
							}
						)}
					>
						<div
							className="h-full rounded-full bg-(--companion-aura)/80 transition-[width] duration-500"
							style={{ width: `${pct}%` }}
						/>
					</div>
				</div>
				<ChevronRightIcon
					className="size-4 shrink-0 text-(--companion-text-soft)"
					aria-hidden
				/>
			</button>
		</div>
	);
}
