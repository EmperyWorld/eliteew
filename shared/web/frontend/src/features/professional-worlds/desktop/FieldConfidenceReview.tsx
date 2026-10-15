/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Reusable runtime review panel for AI/import-extracted fields with per-field confidence.
 *
 * Invariants:
 * - Confidence is advisory UI state; callers decide whether a reviewed payload can be committed.
 * - Edited values remain strings in this component so object intake and future imports can coerce them in their domain layer.
 *
 * Related:
 * - types.ts
 * - ProfessionalWorldsApp.tsx
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	DesktopAppButton,
	DesktopAppEmptyState,
} from '@/pages/Desktop/components/DesktopAppChrome';
import { PROFESSIONAL_WORLDS_NS } from '@/i18n/namespaces';

import { ProfessionalWorldsWorkspacePanel } from './layout';
import { SupportDetailsPanel } from './components/SupportDetailsPanel';

export type FieldConfidenceLevel = 'high' | 'low' | 'medium';

export interface FieldConfidenceReviewItem {
	key: string;
	label: string;
	value: unknown;
	confidence: number;
	warnings?: string[];
}

export interface FieldConfidenceReviewChange {
	key: string;
	value: string;
}

function toPercent(confidence: number): number {
	if (!Number.isFinite(confidence)) {
		return 0;
	}
	return Math.max(0, Math.min(100, Math.round(confidence * 100)));
}

function confidenceLevel(percent: number): FieldConfidenceLevel {
	if (percent >= 85) {
		return 'high';
	}
	if (percent >= 60) {
		return 'medium';
	}
	return 'low';
}

function confidenceTone(level: FieldConfidenceLevel): string {
	if (level === 'high') {
		return 'bg-emerald-400';
	}
	if (level === 'medium') {
		return 'bg-amber-300';
	}
	return 'bg-red-300';
}

function valueToText(value: unknown): string {
	if (value == null) {
		return '';
	}
	if (typeof value === 'object') {
		return JSON.stringify(value, null, 2);
	}
	return String(value);
}

function displayFieldLabel(key: string): string {
	return key.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function buildFieldConfidenceItems({
	values,
	confidence,
	labels = {},
	warnings = {},
}: {
	values: Record<string, unknown>;
	confidence: Record<string, number>;
	labels?: Record<string, string>;
	warnings?: Record<string, string[]>;
}): FieldConfidenceReviewItem[] {
	return Object.keys(values).map((key) => ({
		key,
		label: labels[key] ?? displayFieldLabel(key),
		value: values[key],
		confidence: confidence[key] ?? 0,
		warnings: warnings[key] ?? [],
	}));
}

export function FieldConfidenceReview({
	items,
	title,
	description,
	onChange,
	onConfirm,
	confirmLabel,
	disabled = false,
}: {
	items: FieldConfidenceReviewItem[];
	title?: string;
	description?: string;
	onChange?: (change: FieldConfidenceReviewChange) => void;
	onConfirm?: (values: Record<string, string>) => void | Promise<void>;
	confirmLabel?: string;
	disabled?: boolean;
}) {
	const { t } = useTranslation(PROFESSIONAL_WORLDS_NS);
	const panelTitle = title ?? t('runtimeComponents.fieldConfidence.title');
	const panelDescription =
		description ?? t('runtimeComponents.fieldConfidence.description');
	const actionLabel =
		confirmLabel ?? t('runtimeComponents.fieldConfidence.confirm');
	const [draft, setDraft] = useState<Record<string, string>>(() =>
		Object.fromEntries(items.map((item) => [item.key, valueToText(item.value)]))
	);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		setDraft(
			Object.fromEntries(
				items.map((item) => [item.key, valueToText(item.value)])
			)
		);
	}, [items]);
	const confidenceSummary = useMemo(() => {
		const total = items.length;
		const low = items.filter(
			(item) => confidenceLevel(toPercent(item.confidence)) === 'low'
		).length;
		const average = total
			? Math.round(
					items.reduce((sum, item) => sum + toPercent(item.confidence), 0) /
						total
				)
			: 0;
		return { average, low, total };
	}, [items]);

	if (items.length === 0) {
		return (
			<DesktopAppEmptyState
				title={t('runtimeComponents.fieldConfidence.emptyTitle')}
				description={t('runtimeComponents.fieldConfidence.emptyDescription')}
			/>
		);
	}

	function updateField(key: string, value: string) {
		setDraft((current) => ({ ...current, [key]: value }));
		onChange?.({ key, value });
	}

	async function handleConfirm() {
		if (!onConfirm) {
			return;
		}
		setBusy(true);
		try {
			await onConfirm(draft);
		} finally {
			setBusy(false);
		}
	}

	return (
		<ProfessionalWorldsWorkspacePanel
			title={panelTitle}
			className="grid gap-4 p-4"
			actions={
				<div className="rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) px-3 py-2 text-xs text-(--desktop-text-secondary)">
					<strong className="text-(--desktop-text-primary)">
						{confidenceSummary.average}%
					</strong>{' '}
					{t('runtimeComponents.fieldConfidence.summary', {
						low: confidenceSummary.low,
						total: confidenceSummary.total,
					})}
				</div>
			}
		>
			<p className="text-xs text-(--desktop-text-secondary)">
				{panelDescription}
			</p>
			<div className="grid gap-3">
				{items.map((item) => {
					const percent = toPercent(item.confidence);
					const level = confidenceLevel(percent);
					const fieldWarnings = item.warnings ?? [];
					const fieldLabel = item.label || displayFieldLabel(item.key);
					return (
						<div
							key={item.key}
							className="rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-soft) p-3"
						>
							<div className="flex flex-wrap items-center justify-between gap-2">
								<div>
									<strong className="text-sm text-(--desktop-text-primary)">
										{fieldLabel}
									</strong>
									<SupportDetailsPanel className="text-[11px] text-(--desktop-text-dim)">
										<span className="font-mono">
											{t('runtimeComponents.fieldConfidence.fieldKeyLabel', {
												key: item.key,
											})}
										</span>
									</SupportDetailsPanel>
								</div>
								<span className="text-xs text-(--desktop-text-secondary)">
									{t('runtimeComponents.fieldConfidence.confidence', {
										percent,
									})}
								</span>
							</div>
							<div
								className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/25"
								role="progressbar"
								aria-label={t(
									'runtimeComponents.fieldConfidence.confidenceAria',
									{
										field: fieldLabel,
									}
								)}
								aria-valuemin={0}
								aria-valuemax={100}
								aria-valuenow={percent}
							>
								<div
									className={`h-full rounded-full ${confidenceTone(level)} transition-[width] duration-500 motion-reduce:transition-none`}
									style={{ width: `${percent}%` }}
								/>
							</div>
							<textarea
								aria-label={t(
									'runtimeComponents.fieldConfidence.reviewedValueAria',
									{
										field: fieldLabel,
									}
								)}
								value={draft[item.key] ?? valueToText(item.value)}
								disabled={disabled || busy}
								onChange={(event) => updateField(item.key, event.target.value)}
								className="mt-3 min-h-20 w-full rounded-(--desktop-radius) border border-(--desktop-border-subtle) bg-(--desktop-surface-panel) px-3 py-2 text-sm text-(--desktop-text-primary) outline-none focus:border-(--desktop-border-strong)"
							/>
							{fieldWarnings.length > 0 && (
								<ul className="mt-2 grid gap-1 text-xs text-amber-100">
									{fieldWarnings.map((warning) => (
										<li key={warning}>{warning}</li>
									))}
								</ul>
							)}
						</div>
					);
				})}
			</div>
			{onConfirm && (
				<DesktopAppButton
					disabled={disabled || busy}
					onClick={() => void handleConfirm()}
				>
					{actionLabel}
				</DesktopAppButton>
			)}
		</ProfessionalWorldsWorkspacePanel>
	);
}
