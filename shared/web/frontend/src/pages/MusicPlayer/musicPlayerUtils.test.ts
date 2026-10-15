/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit coverage for Music Player metadata extraction and row metadata comparisons.
 *
 * Invariants:
 * - Secondary metadata extraction is tolerant to optional/legacy metadata fields.
 * - Row metadata compare reacts to style/bpm/source changes.
 *
 * Related:
 * - src/pages/MusicPlayer/musicPlayerUtils.ts
 */

import { describe, expect, it } from 'vitest';

import {
	buildTrackMetadataChips,
	filterTracksByOrigin,
	isGeneratedMusicTrack,
	readTrackSecondaryMetadata,
	sliceVisibleTags,
	summarizeDurationSortGaps,
	summarizeTrackPresentationGaps,
	trackRowMetadataEqual,
} from './musicPlayerUtils';

describe('musicPlayerUtils secondary metadata', () => {
	it('extracts style, bpm and source app from metadata aliases', () => {
		const result = readTrackSecondaryMetadata({
			id: 'track-1',
			name: 'Track',
			content_type: 'audio',
			file_size: null,
			mime_type: 'audio/mpeg',
			created_at: '2026-05-31T00:00:00Z',
			updated_at: '2026-05-31T00:00:00Z',
			user_id: 'u1',
			visibility: 'private',
			tags: [],
			metadata: {
				generated_style: 'Cinematic',
				bpm: '124',
				source_app: 'music_generator',
			},
		});
		expect(result.style).toBe('Cinematic');
		expect(result.bpm).toBe(124);
		expect(result.sourceApp).toBe('music_generator');
		expect(result.createdDateLabel).toBeTruthy();
	});

	it('formats created date with resolved locale', () => {
		const en = readTrackSecondaryMetadata(
			{
				id: 'track-1',
				name: 'Track',
				content_type: 'audio',
				file_size: null,
				mime_type: 'audio/mpeg',
				created_at: '2026-05-31T00:00:00Z',
				updated_at: '2026-05-31T00:00:00Z',
				user_id: 'u1',
				visibility: 'private',
				tags: [],
				metadata: {},
			},
			'en'
		);
		expect(en.createdDateLabel).toMatch(/\d{2}\/\d{2}\/\d{4}/);
	});

	it('builds metadata chips via injected label formatters', () => {
		const secondary = readTrackSecondaryMetadata({
			id: 'track-1',
			name: 'Track',
			content_type: 'audio',
			file_size: null,
			mime_type: 'audio/mpeg',
			created_at: '2026-05-31T00:00:00Z',
			updated_at: '2026-05-31T00:00:00Z',
			user_id: 'u1',
			visibility: 'private',
			tags: [],
			metadata: {
				generated_style: 'Cinematic',
				bpm: 124,
				source_app: 'music_generator',
			},
		});
		const chips = buildTrackMetadataChips(secondary, {
			formatStyle: (style) => `Style: ${style}`,
			formatBpm: (bpm) => `${bpm} BPM`,
			formatSource: (source) => `Source: ${source}`,
			formatCreated: (date) => `Created: ${date}`,
		});
		expect(chips).toEqual([
			'Style: Cinematic',
			'124 BPM',
			'Source: music generator',
			expect.stringMatching(/^Created: /),
		]);
	});

	it('treats style/bpm/source as row metadata compare keys', () => {
		const base = {
			duration: 60,
			generated_style: 'Ambient',
			bpm: 120,
			source_app: 'ewa',
		};
		expect(trackRowMetadataEqual(base, base)).toBe(true);
		expect(
			trackRowMetadataEqual(base, { ...base, generated_style: 'House' })
		).toBe(false);
		expect(trackRowMetadataEqual(base, { ...base, bpm: 128 })).toBe(false);
		expect(trackRowMetadataEqual(base, { ...base, source_app: 'ugs' })).toBe(
			false
		);
	});

	it('detects generated tracks by tags or source metadata', () => {
		expect(
			isGeneratedMusicTrack({
				id: 'track-tag',
				name: 'Track',
				content_type: 'audio',
				file_size: null,
				mime_type: 'audio/mpeg',
				created_at: '2026-05-31T00:00:00Z',
				updated_at: '2026-05-31T00:00:00Z',
				user_id: 'u1',
				visibility: 'private',
				tags: ['generated'],
				metadata: {},
			})
		).toBe(true);
		expect(
			isGeneratedMusicTrack({
				id: 'track-source',
				name: 'Track',
				content_type: 'audio',
				file_size: null,
				mime_type: 'audio/mpeg',
				created_at: '2026-05-31T00:00:00Z',
				updated_at: '2026-05-31T00:00:00Z',
				user_id: 'u1',
				visibility: 'private',
				tags: [],
				metadata: { source_app: 'music_generator' },
			})
		).toBe(true);
	});

	it('matches generated tags case-insensitively', () => {
		expect(
			isGeneratedMusicTrack({
				id: 'track-tag-upper',
				name: 'Track',
				content_type: 'audio',
				file_size: null,
				mime_type: 'audio/mpeg',
				created_at: '2026-05-31T00:00:00Z',
				updated_at: '2026-05-31T00:00:00Z',
				user_id: 'u1',
				visibility: 'private',
				tags: ['GENERATED'],
				metadata: {},
			})
		).toBe(true);
	});

	it('summarizes missing thumbnails and durations', () => {
		const gaps = summarizeTrackPresentationGaps([
			{
				id: 'track-ok',
				name: 'Track OK',
				content_type: 'audio',
				file_size: null,
				mime_type: 'audio/mpeg',
				created_at: '2026-05-31T00:00:00Z',
				updated_at: '2026-05-31T00:00:00Z',
				user_id: 'u1',
				visibility: 'private',
				tags: [],
				thumbnail_url: '/thumb-ok.png',
				metadata: { duration: 45 },
			},
			{
				id: 'track-missing',
				name: 'Track Missing',
				content_type: 'audio',
				file_size: null,
				mime_type: 'audio/mpeg',
				created_at: '2026-05-31T00:00:00Z',
				updated_at: '2026-05-31T00:00:00Z',
				user_id: 'u1',
				visibility: 'private',
				tags: [],
				thumbnail_url: null,
				metadata: {},
			},
		]);
		expect(gaps.missingThumbnailCount).toBe(1);
		expect(gaps.missingDurationCount).toBe(1);
	});

	it('filters generated vs uploaded tracks by origin', () => {
		const generated = {
			id: 'gen',
			name: 'Gen',
			content_type: 'audio',
			file_size: null,
			mime_type: 'audio/mpeg',
			created_at: '2026-05-31T00:00:00Z',
			updated_at: '2026-05-31T00:00:00Z',
			user_id: 'u1',
			visibility: 'private',
			tags: ['generated'],
			metadata: {},
		};
		const uploaded = {
			...generated,
			id: 'up',
			name: 'Up',
			tags: [],
			metadata: { source_app: 'content_manager' },
		};
		expect(filterTracksByOrigin([generated, uploaded], 'generated')).toEqual([
			generated,
		]);
		expect(filterTracksByOrigin([generated, uploaded], 'uploaded')).toEqual([
			uploaded,
		]);
	});

	it('summarizes duration sort gaps', () => {
		const gaps = summarizeDurationSortGaps([
			{
				id: 'a',
				name: 'A',
				content_type: 'audio',
				file_size: null,
				mime_type: 'audio/mpeg',
				created_at: '2026-05-31T00:00:00Z',
				updated_at: '2026-05-31T00:00:00Z',
				user_id: 'u1',
				visibility: 'private',
				tags: [],
				metadata: { duration: 10 },
			},
			{
				id: 'b',
				name: 'B',
				content_type: 'audio',
				file_size: null,
				mime_type: 'audio/mpeg',
				created_at: '2026-05-31T00:00:00Z',
				updated_at: '2026-05-31T00:00:00Z',
				user_id: 'u1',
				visibility: 'private',
				tags: [],
				metadata: {},
			},
		]);
		expect(gaps.totalCount).toBe(2);
		expect(gaps.missingDurationCount).toBe(1);
	});

	it('slices visible tags with overflow count', () => {
		const tags = Array.from({ length: 12 }, (_, index) => `tag-${index + 1}`);
		const collapsed = sliceVisibleTags(tags, {
			limit: 8,
			expanded: false,
			activeTag: 'tag-99',
		});
		expect(collapsed.visibleTags).toHaveLength(8);
		expect(collapsed.hiddenCount).toBe(5);
	});
});
