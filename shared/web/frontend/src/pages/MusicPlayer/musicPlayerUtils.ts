/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared utility helpers for Music Player filtering, formatting and lightweight row memo comparisons.
 *
 * Invariants:
 * - Metadata extraction for row rendering stays tolerant to partial/legacy payloads.
 * - Row memo compare checks only fields that influence visual output.
 *
 * Related:
 * - src/pages/MusicPlayer/MusicPlayerTrackList.tsx
 * - src/pages/MusicPlayer/MusicPlayerPage.tsx
 */

import type { Content } from '../../components/UnifiedContent/types';
import { resolveIntlDateLocale } from '../../components/UnifiedContent/utils/contentUtils';
import { formatDuration } from '../../utils/formatDuration';

export function trackDurationSeconds(
	metadata: Content['metadata']
): number | null {
	if (!metadata || typeof metadata !== 'object') return null;
	const d = metadata.duration;
	return typeof d === 'number' ? d : null;
}

export function formatTrackDurationLabel(
	durationSeconds: number | null
): string | null {
	if (durationSeconds == null || !Number.isFinite(durationSeconds)) return null;
	return formatDuration(durationSeconds);
}

export function shuffleArray<T>(arr: T[]): T[] {
	const out = [...arr];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/** Для memo строки трека: без JSON.stringify по всему metadata. */
export function trackRowMetadataEqual(
	a: Content['metadata'],
	b: Content['metadata']
): boolean {
	return (
		trackDurationSeconds(a) === trackDurationSeconds(b) &&
		readTrackGeneratedStyle(a) === readTrackGeneratedStyle(b) &&
		readTrackBpm(a) === readTrackBpm(b) &&
		readTrackSourceApp(a) === readTrackSourceApp(b)
	);
}

function readTrackGeneratedStyle(metadata: Content['metadata']): string | null {
	if (!metadata || typeof metadata !== 'object') return null;
	const value =
		metadata.generated_style ??
		metadata.style ??
		metadata.music_style ??
		metadata.genre;
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readTrackBpm(metadata: Content['metadata']): number | null {
	if (!metadata || typeof metadata !== 'object') return null;
	const raw = metadata.bpm ?? metadata.tempo;
	if (typeof raw === 'number' && Number.isFinite(raw)) {
		return Math.max(0, Math.round(raw));
	}
	if (typeof raw === 'string') {
		const parsed = Number(raw);
		if (Number.isFinite(parsed)) {
			return Math.max(0, Math.round(parsed));
		}
	}
	return null;
}

function readTrackSourceApp(metadata: Content['metadata']): string | null {
	if (!metadata || typeof metadata !== 'object') return null;
	const value =
		metadata.source_app ??
		metadata.source ??
		metadata.generator ??
		metadata.origin_app;
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function readTrackSecondaryMetadata(
	item: Content,
	locale?: string
): {
	style: string | null;
	bpm: number | null;
	sourceApp: string | null;
	createdDateLabel: string | null;
} {
	const style = readTrackGeneratedStyle(item.metadata);
	const bpm = readTrackBpm(item.metadata);
	const sourceApp = readTrackSourceApp(item.metadata);
	const createdDate = new Date(item.created_at);
	const dateLocale = resolveIntlDateLocale(locale);
	const createdDateLabel = Number.isNaN(createdDate.getTime())
		? null
		: createdDate.toLocaleDateString(dateLocale, {
				day: '2-digit',
				month: '2-digit',
				year: 'numeric',
			});
	return { style, bpm, sourceApp, createdDateLabel };
}

export type TrackMetadataChipLabels = {
	formatStyle: (style: string) => string;
	formatBpm: (bpm: number) => string;
	formatSource: (source: string) => string;
	formatCreated: (date: string) => string;
};

export function buildTrackMetadataChips(
	secondary: ReturnType<typeof readTrackSecondaryMetadata>,
	labels: TrackMetadataChipLabels
): string[] {
	const chips: string[] = [];
	if (secondary.style) {
		chips.push(labels.formatStyle(secondary.style));
	}
	if (secondary.bpm != null) {
		chips.push(labels.formatBpm(secondary.bpm));
	}
	if (secondary.sourceApp) {
		chips.push(
			labels.formatSource(secondary.sourceApp.replaceAll('_', ' ').trim())
		);
	}
	if (secondary.createdDateLabel) {
		chips.push(labels.formatCreated(secondary.createdDateLabel));
	}
	return chips;
}

function normalizeGeneratedTrackToken(value: string): string {
	return value.trim().toLowerCase();
}

export function isGeneratedMusicTrack(item: Content): boolean {
	const tags = Array.isArray(item.tags)
		? item.tags.map((tag) => normalizeGeneratedTrackToken(tag))
		: [];
	if (
		tags.some((tag) =>
			[
				'generated',
				'music-generator',
				'music_generator',
				'suno',
				'ai-music',
			].includes(tag)
		)
	) {
		return true;
	}
	const metadata = item.metadata;
	if (!metadata || typeof metadata !== 'object') return false;
	const sourceRaw =
		metadata.source_app ??
		metadata.source ??
		metadata.generator ??
		metadata.origin_app ??
		metadata.workflow;
	if (typeof sourceRaw !== 'string') return false;
	const source = normalizeGeneratedTrackToken(sourceRaw);
	return (
		source.includes('music_generator') ||
		source.includes('music-generator') ||
		source.includes('suno') ||
		source.includes('ugs') ||
		source.includes('ewa')
	);
}

export function summarizeTrackPresentationGaps(items: Content[]): {
	missingThumbnailCount: number;
	missingDurationCount: number;
} {
	let missingThumbnailCount = 0;
	let missingDurationCount = 0;
	for (const item of items) {
		if (!item.thumbnail_url) {
			missingThumbnailCount += 1;
		}
		if (trackDurationSeconds(item.metadata) == null) {
			missingDurationCount += 1;
		}
	}
	return { missingThumbnailCount, missingDurationCount };
}

export function summarizeDurationSortGaps(items: Content[]): {
	missingDurationCount: number;
	totalCount: number;
} {
	let missingDurationCount = 0;
	for (const item of items) {
		if (trackDurationSeconds(item.metadata) == null) {
			missingDurationCount += 1;
		}
	}
	return { missingDurationCount, totalCount: items.length };
}

export function filterTracksByOrigin(
	items: Content[],
	originFilter: 'all' | 'generated' | 'uploaded'
): Content[] {
	if (originFilter === 'all') return items;
	if (originFilter === 'generated') {
		return items.filter((item) => isGeneratedMusicTrack(item));
	}
	return items.filter((item) => !isGeneratedMusicTrack(item));
}

export const MUSIC_PLAYER_VISIBLE_TAG_LIMIT = 8;

export function sliceVisibleTags(
	tags: readonly string[],
	options: {
		limit: number;
		expanded: boolean;
		activeTag: string | null;
	}
): { visibleTags: string[]; hiddenCount: number } {
	if (options.expanded || tags.length <= options.limit) {
		return { visibleTags: [...tags], hiddenCount: 0 };
	}
	const prioritized = [...tags];
	if (options.activeTag && !prioritized.includes(options.activeTag)) {
		prioritized.unshift(options.activeTag);
	}
	const visibleTags = prioritized.slice(0, options.limit);
	const hiddenCount = Math.max(0, prioritized.length - visibleTags.length);
	return { visibleTags, hiddenCount };
}

export function shallowStringArrayEqual(
	a: readonly string[],
	b: readonly string[]
): boolean {
	if (a === b) return true;
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}

/** Отмена запроса / AbortController (axios/fetch). */
export function isAbortOrCancelError(e: unknown): boolean {
	if (e == null || typeof e !== 'object') return false;
	const o = e as { code?: string; name?: string };
	return (
		o.code === 'ERR_CANCELED' ||
		o.name === 'CanceledError' ||
		o.name === 'AbortError'
	);
}
