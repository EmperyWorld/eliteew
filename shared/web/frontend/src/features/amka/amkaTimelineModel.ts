/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure helpers for the Marketing Cabinet AMKA pipeline timeline (stage order, active index, connector styles).
 * Lives in the AMKA feature boundary so cabinet views stay thin wrappers.
 *
 * Invariants:
 * - Inputs are run status strings from the marketing AMKA API; no network calls.
 * - Timeline stage ids are stable for i18n keys under `amkaView.timeline.*`.
 *
 * Related:
 * - src/features/amka/AmkaPipelineTimeline.tsx
 * - src/pages/MarketingCabinet/views/AmkaView.tsx
 */
import { cn } from '@/utils/cn';

export type AmkaTimelineStageId =
	| 'audit_plan'
	| 'approval'
	| 'execute'
	| 'wrap_up';

/** Индекс активной ступени (0..3) и завершённые ступени для UI timeline. */
export function computeAmkaTimelineState(params: {
	status: string;
	current_stage?: string | null;
}): { activeIndex: number; stages: AmkaTimelineStageId[] } {
	const stages: AmkaTimelineStageId[] = [
		'audit_plan',
		'approval',
		'execute',
		'wrap_up',
	];
	const { status, current_stage } = params;
	const cs = (current_stage || '').trim();

	if (status === 'completed') {
		return { activeIndex: 3, stages };
	}
	if (status === 'failed' || status === 'cancelled') {
		return { activeIndex: 2, stages };
	}
	if (status === 'awaiting_approval') {
		return { activeIndex: 1, stages };
	}
	if (status === 'awaiting_step_approval' || cs === 'step_approval') {
		return { activeIndex: 2, stages };
	}
	if (status === 'planning' || status === 'queued') {
		return { activeIndex: 0, stages };
	}
	if (status === 'running') {
		if (cs === 'approval') return { activeIndex: 1, stages };
		if (cs === 'audit' || cs === '') return { activeIndex: 0, stages };
		if (cs === 'execute' || cs === 'step_approval')
			return { activeIndex: 2, stages };
		if (cs === 'done') return { activeIndex: 3, stages };
		return { activeIndex: 2, stages };
	}
	return { activeIndex: 0, stages };
}

export function timelineConnectorClass(filled: boolean): string {
	return cn(
		filled
			? 'bg-[rgb(var(--desktop-accent-rgb)/0.55)]'
			: 'bg-(--desktop-border-subtle)'
	);
}
