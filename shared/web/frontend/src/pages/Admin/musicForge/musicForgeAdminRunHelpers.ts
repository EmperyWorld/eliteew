/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Admin MusicForge run list / inspector helpers (status tones, formatting, payload reads).
 *
 * Related:
 * - MusicForgeAdminRunsPanel.tsx, MusicForgeRunInspector.tsx
 */

import { adminUiBannerTone } from '../ui/adminTokens';

export type MusicForgeAdminRunStatus =
	| 'queued'
	| 'running'
	| 'completed'
	| 'failed'
	| 'cancelled';

export const MUSIC_FORGE_ADMIN_RUN_STATUSES: MusicForgeAdminRunStatus[] = [
	'queued',
	'running',
	'completed',
	'failed',
	'cancelled',
];

export function musicForgeAdminRunStatusTone(status: string): {
	border: string;
	bg: string;
	fg: string;
} {
	switch (status) {
		case 'completed':
			return adminUiBannerTone.success;
		case 'failed':
			return adminUiBannerTone.danger;
		case 'cancelled':
			return adminUiBannerTone.warning;
		case 'queued':
		case 'running':
			return adminUiBannerTone.info;
		default:
			return adminUiBannerTone.info;
	}
}

export function formatMusicForgeAdminDateTime(
	value: string | null | undefined,
	locale: string
): string {
	if (!value) return '—';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return new Intl.DateTimeFormat(locale, {
		dateStyle: 'short',
		timeStyle: 'short',
	}).format(date);
}

export function formatMusicForgeAdminDuration(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds <= 0) return '—';
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${m}:${String(s).padStart(2, '0')}`;
}

export function stringField(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

export function lyricsFromPayload(payload: unknown): string {
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
		return '';
	}
	return stringField((payload as Record<string, unknown>).lyrics);
}

export function resultTrackName(payload: unknown): string {
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
		return '';
	}
	const record = payload as Record<string, unknown>;
	return stringField(record.name) || stringField(record.title);
}

export function resultDownloadUrl(payload: unknown): string {
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
		return '';
	}
	return stringField((payload as Record<string, unknown>).download_url);
}

export function formatMusicForgeAdminLanguageLabel(
	language: string | null | undefined,
	translate: (key: string) => string
): string {
	const code = stringField(language);
	if (!code) return '—';
	const key = `musicForge.languages.${code}`;
	const translated = translate(key);
	return translated === key ? code : translated;
}

export function truncateTableCell(
	value: string | null | undefined,
	max = 32
): string {
	const text = stringField(value);
	if (!text) return '—';
	if (text.length <= max) return text;
	return `${text.slice(0, max - 1)}…`;
}
