/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Presentational panel for `AmkaCoreAlignmentResponse` (marketing run or UGS facade): status, traces, pulse, projection.
 *
 * Invariants:
 * - No fetches here; parents own React Query / loading / errors.
 * - Coercion of pulse/projection matches `AmkaCoreAlignmentSection` history for stable UI.
 *
 * Related:
 * - src/features/amka/AmkaCoreAlignmentSection.tsx
 */
import { useTranslation } from 'react-i18next';

import { AmkaPulsePanel } from '@/features/amka/AmkaPulsePanel';
import type {
	AmkaCoreAlignmentResponse,
	AmkaPulseArtifact,
	AmkaStandaloneProjection,
} from '@/features/amka/amkaTypes';
import { DesktopAppButton } from '@/pages/Desktop/components/DesktopAppChrome';

function coercePulse(raw: Record<string, unknown>): AmkaPulseArtifact | null {
	const summary = typeof raw.summary === 'string' ? raw.summary : '';
	const noChange =
		typeof raw.no_change_reason === 'string' ? raw.no_change_reason : '';
	if (!summary.trim() && !noChange.trim()) {
		return null;
	}
	const asStrings = (v: unknown): string[] =>
		Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
	return {
		summary: summary || '—',
		changed: asStrings(raw.changed),
		preserved: asStrings(raw.preserved),
		doubts: asStrings(raw.doubts),
		agreements: asStrings(raw.agreements),
		no_change_reason:
			typeof raw.no_change_reason === 'string'
				? raw.no_change_reason
				: undefined,
		next_safe_step:
			typeof raw.next_safe_step === 'string' ? raw.next_safe_step : undefined,
	};
}

function coerceProjection(
	raw: Record<string, unknown>
): AmkaStandaloneProjection | null {
	if (
		typeof raw.driver_key !== 'string' ||
		typeof raw.domain_profile !== 'string'
	) {
		return null;
	}
	return raw as unknown as AmkaStandaloneProjection;
}

export type AmkaCoreAlignmentPanelProps = {
	title: string;
	subtitle: string;
	ariaLabel: string;
	data: AmkaCoreAlignmentResponse | undefined;
	isLoading: boolean;
	isError: boolean;
	refetch: () => void;
};

export function AmkaCoreAlignmentPanel({
	title,
	subtitle,
	ariaLabel,
	data,
	isLoading,
	isError,
	refetch,
}: AmkaCoreAlignmentPanelProps) {
	const { t } = useTranslation('marketing');

	if (isLoading) {
		return (
			<p className="text-xs text-(--desktop-text-muted) wrap-pretty">
				{t('amkaView.coreAlignmentLoading')}
			</p>
		);
	}

	if (isError) {
		return (
			<div className="flex flex-wrap items-center gap-2 rounded-(--desktop-radius) border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-50/95">
				<span className="wrap-pretty">{t('amkaView.coreAlignmentError')}</span>
				<DesktopAppButton
					type="button"
					size="sm"
					variant="neutral"
					className="shrink-0"
					onClick={refetch}
				>
					{t('amkaView.coreAlignmentRetry')}
				</DesktopAppButton>
			</div>
		);
	}

	if (!data) {
		return null;
	}

	const pulseRaw =
		data.pulse && typeof data.pulse === 'object'
			? (data.pulse as Record<string, unknown>)
			: null;
	const projRaw =
		data.projection && typeof data.projection === 'object'
			? (data.projection as Record<string, unknown>)
			: null;
	const pulse = pulseRaw ? coercePulse(pulseRaw) : null;
	const projection = projRaw ? coerceProjection(projRaw) : null;
	const denied = Array.isArray(data.policy?.denied_operation_keys)
		? (data.policy.denied_operation_keys as unknown[]).filter(
				(x): x is string => typeof x === 'string'
			)
		: [];

	return (
		<section
			className="space-y-2 rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) px-3 py-2"
			aria-label={ariaLabel}
		>
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<div className="text-xs font-semibold text-(--desktop-text-primary)">
					{title}
				</div>
				<DesktopAppButton
					type="button"
					size="sm"
					variant="neutral"
					className="h-7 gap-1 px-2 text-[11px]"
					onClick={refetch}
				>
					{t('amkaView.coreAlignmentRetry')}
				</DesktopAppButton>
			</div>
			<p className="text-[11px] leading-relaxed text-(--desktop-text-muted) wrap-pretty">
				{subtitle}
			</p>
			<div className="flex flex-wrap gap-2 text-[11px] text-(--desktop-text-secondary)">
				<span className="rounded-md bg-[rgb(var(--desktop-accent-rgb)/0.12)] px-1.5 py-0.5 font-medium text-(--desktop-text-primary)">
					{t('amkaView.coreAlignmentStatusLabel')}: {data.status}
				</span>
				<span>
					{t('amkaView.coreAlignmentTaskCount', { count: data.task_count })}
				</span>
				{denied.length > 0 ? (
					<span className="text-amber-100">
						{t('amkaView.coreAlignmentPolicyBlocked', {
							count: denied.length,
						})}
					</span>
				) : null}
			</div>
			{Array.isArray(data.traces) && data.traces.length > 0 ? (
				<details className="text-[11px] text-(--desktop-text-secondary)">
					<summary className="cursor-pointer font-medium text-(--desktop-text-primary)">
						{t('amkaView.coreAlignmentTraceTitle', {
							count: data.traces.length,
						})}
					</summary>
					<ol className="mt-1 list-decimal space-y-0.5 pl-4">
						{data.traces.slice(0, 32).map((ev) => (
							<li
								key={`${ev.stage}:${ev.event}:${JSON.stringify(ev.payload ?? {})}`}
								className="wrap-pretty"
							>
								<span className="font-mono text-(--desktop-text-muted)">
									{ev.stage}
								</span>
								{' · '}
								<span>{ev.event}</span>
								{ev.message?.trim() ? (
									<span className="text-(--desktop-text-muted)">
										{' '}
										— {ev.message}
									</span>
								) : null}
							</li>
						))}
					</ol>
				</details>
			) : null}
			<AmkaPulsePanel pulse={pulse} projection={projection} />
		</section>
	);
}
