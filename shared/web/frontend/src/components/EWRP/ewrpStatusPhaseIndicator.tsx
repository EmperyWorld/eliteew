/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EWRP job phase labels, chip accents, and history/status indicator payloads (icon + label + class).
 *
 * Invariants:
 * - Stale in-progress rows use the same threshold as history list (`EWRP_HISTORY_STALE_AFTER_MS`).
 *
 * Related:
 * - `EwrpStatusPhaseChip.tsx`, `EwrpGeneratorChunks.tsx`, `EWRPGeneratorMain.tsx`
 */

import i18n from 'i18next';
import {
	ArrowDownTrayIcon,
	ArrowPathIcon,
	ClockIcon,
	ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import type React from 'react';

const sw = 1.75;

/** No `updated_at` from server longer than this → history shows «stale», not a live spinner. */
export const EWRP_HISTORY_STALE_AFTER_MS = 2 * 60 * 60 * 1000;

export function isEwrpHistoryRowStale(
	status: string,
	updatedAt: string | null | undefined,
	nowMs: number = Date.now()
): boolean {
	const s = (status || '').toLowerCase();
	if (s === 'completed' || s === 'failed') {
		return false;
	}
	if (!updatedAt) {
		return false;
	}
	const t = new Date(updatedAt).getTime();
	if (Number.isNaN(t)) {
		return false;
	}
	return nowMs - t > EWRP_HISTORY_STALE_AFTER_MS;
}

export function ewrpStatusLabel(status: string): string {
	const s = (status || '').toLowerCase();
	switch (s) {
		case 'queued':
			return i18n.t('ewrp:status.queued');
		case 'generating_content':
			return i18n.t('ewrp:status.generating_content');
		case 'generating_images':
			return i18n.t('ewrp:status.generating_images');
		case 'building_pdf':
			return i18n.t('ewrp:status.building_pdf');
		case 'completed':
			return i18n.t('ewrp:status.completed');
		case 'failed':
			return i18n.t('ewrp:status.failed');
		default:
			return status || i18n.t('ewrp:common.dash');
	}
}

/** Visual accent for the job status chip (right column). */
export function ewrpStatusChipClass(status: string): string {
	const s = (status || '').toLowerCase();
	if (s === 'completed') {
		return 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100';
	}
	if (s === 'failed') {
		return 'border-red-400/35 bg-red-500/12 text-red-200';
	}
	if (
		s === 'queued' ||
		s === 'generating_content' ||
		s === 'generating_images' ||
		s === 'building_pdf'
	) {
		return 'border-[rgb(var(--desktop-accent-rgb)/0.4)] bg-[rgb(var(--desktop-accent-rgb)/0.14)] text-(--desktop-text-primary)';
	}
	return 'border-(--desktop-border-subtle) bg-(--desktop-surface-accent) text-(--desktop-text-primary)';
}

export function ewrpHistoryStatusIndicator(
	status: string,
	updatedAt?: string | null,
	nowMs: number = Date.now()
): {
	icon: React.ReactNode;
	label: string;
	className: string;
} {
	const s = (status || '').toLowerCase();
	const accentChip =
		'border-[rgb(var(--desktop-accent-rgb)/0.35)] bg-[rgb(var(--desktop-accent-rgb)/0.1)] text-(--desktop-text-secondary)';

	if (s === 'completed') {
		return {
			icon: (
				<ArrowDownTrayIcon className="h-3 w-3" strokeWidth={sw} aria-hidden />
			),
			label: i18n.t('ewrp:historyIndicator.pdfReady'),
			className: 'border-emerald-500/35 bg-emerald-500/12 text-emerald-200/95',
		};
	}
	if (s === 'failed') {
		return {
			icon: (
				<ExclamationCircleIcon
					className="h-3 w-3"
					strokeWidth={sw}
					aria-hidden
				/>
			),
			label: i18n.t('ewrp:historyIndicator.error'),
			className: 'border-red-500/35 bg-red-500/10 text-red-200/90',
		};
	}
	if (isEwrpHistoryRowStale(status, updatedAt, nowMs)) {
		return {
			icon: (
				<ExclamationCircleIcon
					className="h-3 w-3"
					strokeWidth={sw}
					aria-hidden
				/>
			),
			label: i18n.t('ewrp:historyIndicator.staleIncomplete'),
			className:
				'border-amber-500/40 bg-amber-500/12 text-amber-100/95 dark:text-amber-100/90',
		};
	}
	if (s === 'queued') {
		return {
			icon: <ClockIcon className="h-3 w-3" strokeWidth={sw} aria-hidden />,
			label: i18n.t('ewrp:status.queued'),
			className: accentChip,
		};
	}
	if (
		s === 'generating_content' ||
		s === 'generating_images' ||
		s === 'building_pdf'
	) {
		return {
			icon: (
				<ArrowPathIcon
					className="h-3 w-3 animate-spin"
					strokeWidth={sw}
					aria-hidden
				/>
			),
			label: ewrpStatusLabel(status),
			className: accentChip,
		};
	}
	return {
		icon: (
			<ArrowPathIcon
				className="h-3 w-3 animate-spin"
				strokeWidth={sw}
				aria-hidden
			/>
		),
		label: ewrpStatusLabel(status),
		className: accentChip,
	};
}
