/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * EWRP history/doc-picker date formatters, list filters, outline markdown export, and text file download.
 *
 * Invariants:
 * - Locale-aware date formatting via i18n.language; filters are case-insensitive substring matches.
 *
 * Related:
 * - `EwrpGeneratorChunks.tsx` barrel, `documentation/product/EWRP-REVOLUTIONARY-PRESENTATIONS.md`
 */

import i18n from 'i18next';
import type { EwrpJobListItem, EwrpSlide } from '../../../services/ewrpApi';
import { ewrpStatusLabel } from '../ewrpStatusPhaseIndicator';
import {
	type ContentItem,
	contentTypeBadgeShort,
} from './ewrpGeneratorConstants';

export function formatEwrpJobListDate(iso: string | null): string {
	if (!iso) return '';
	try {
		const loc = i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
		return new Date(iso).toLocaleString(loc, {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	} catch {
		return '';
	}
}

export function formatEwrpDocPickerDate(iso: string): string {
	try {
		const loc = i18n.language?.startsWith('en') ? 'en-US' : 'ru-RU';
		return new Date(iso).toLocaleDateString(loc, {
			day: '2-digit',
			month: '2-digit',
			year: '2-digit',
		});
	} catch {
		return '';
	}
}

export function filterEwrpHistoryJobs(
	jobs: EwrpJobListItem[],
	query: string
): EwrpJobListItem[] {
	const q = query.trim().toLowerCase();
	if (!q) return jobs;
	return jobs.filter((j) => {
		const statusRaw = (j.status || '').toLowerCase();
		return (
			(j.title || '').toLowerCase().includes(q) ||
			(j.topic || '').toLowerCase().includes(q) ||
			(j.id || '').toLowerCase().includes(q) ||
			(j.error_message || '').toLowerCase().includes(q) ||
			statusRaw.includes(q) ||
			ewrpStatusLabel(j.status).toLowerCase().includes(q)
		);
	});
}

export function filterEwrpDocItems(
	items: ContentItem[],
	query: string
): ContentItem[] {
	const q = query.trim().toLowerCase();
	if (!q) return items;
	return items.filter(
		(i) =>
			(i.name || '').toLowerCase().includes(q) ||
			contentTypeBadgeShort(i.content_type).toLowerCase().includes(q)
	);
}

export function buildOutlineMarkdown(
	presentationTitle: string,
	slides: EwrpSlide[]
): string {
	const defaultTitle = i18n.t('ewrp:outline.defaultTitle');
	const lines: string[] = [`# ${presentationTitle || defaultTitle}`, ''];
	for (let i = 0; i < slides.length; i++) {
		const s = slides[i];
		const t =
			s.title?.trim() || i18n.t('ewrp:outline.slideTitle', { n: i + 1 });
		lines.push(`## ${i + 1}. ${t}`);
		for (const b of s.bullets || []) {
			const line = String(b).trim();
			if (line) lines.push(`- ${line}`);
		}
		lines.push('');
	}
	return lines.join('\n').trimEnd();
}

export function downloadTextFile(
	filename: string,
	text: string,
	mime: string
): void {
	const blob = new Blob([text], { type: mime });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.rel = 'noopener noreferrer';
	a.click();
	URL.revokeObjectURL(url);
}
