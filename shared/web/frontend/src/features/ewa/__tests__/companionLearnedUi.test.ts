/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for companion learned UI helpers: visible memory strip lines and mood extraction from learned_preferences.
 *
 * Invariants:
 * - Pure helpers only; no React rendering, network, or browser storage.
 * - Catalogue preferences should be visible in the same short strip as durable memories.
 *
 * Related:
 * - src/features/ewa/companionLearnedUi.ts
 */
import { describe, expect, it } from 'vitest';
import {
	extractCompanionMoodFromLearned,
	extractContinuityTintFromLearned,
	extractCompanionTrustMeterScore,
	extractCompanionMemoryStripRows,
	extractTopCompanionMemoryLines,
	mergeCompanionDisplayMood,
} from '../companionLearnedUi';

describe('companionLearnedUi', () => {
	it('maps arlika_idle_amnesia source to provided label', () => {
		const lines = extractTopCompanionMemoryLines(
			{
				companion_memory_v1: [
					{
						type: 'fact',
						content: 'Вообще ничего не помню',
						importance: 0.9,
						source: 'arlika_idle_amnesia',
					},
				],
			},
			5,
			'I remember nothing'
		);
		expect(lines[0]).toBe('I remember nothing');
	});

	it('renders catalog preferences as visible memory lines', () => {
		const lines = extractTopCompanionMemoryLines(
			{
				ewa_runtime_catalog_preferences_v1: {
					exclude_content_types: ['audio'],
					exclude_mime_groups: [],
					extension_exclude: ['.mp3'],
				},
			},
			5
		);
		expect(lines.some((line) => line.includes('без аудио'))).toBe(true);
		expect(lines.some((line) => line.includes('.mp3'))).toBe(true);
	});

	it('extractCompanionMemoryStripRows maps content_hash for forgettable rows', () => {
		const rows = extractCompanionMemoryStripRows(
			{
				companion_memory_v1: [
					{
						type: 'fact',
						content: 'Prefers tea',
						importance: 0.9,
						content_hash: 'hash-tea-abc',
					},
				],
			},
			5,
			undefined,
			['Prefers tea']
		);
		const tea = rows.find((r) => r.label === 'Prefers tea');
		expect(tea?.contentHash).toBe('hash-tea-abc');
		expect(tea?.forgettable).toBe(true);
	});

	it('extractCompanionMemoryStripRows marks catalog synthesis as not forgettable', () => {
		const rows = extractCompanionMemoryStripRows(
			{
				ewa_runtime_catalog_preferences_v1: {
					exclude_content_types: ['audio'],
					exclude_mime_groups: [],
					extension_exclude: [],
				},
			},
			5
		);
		const catalog = rows.find((r) => r.label.includes('без аудио'));
		expect(catalog?.forgettable).toBe(false);
		expect(catalog?.contentHash).toBeNull();
	});

	it('extracts expanded mood fields for presence palette', () => {
		expect(
			extractCompanionMoodFromLearned({
				companion_character_v1: {
					mood: { valence: 0.2, energy: 0.7, tension: 0.3, confidence: 0.8 },
				},
			})
		).toEqual({ valence: 0.2, energy: 0.7, tension: 0.3, confidence: 0.8 });
	});

	it('extracts continuity mood_tint when non-neutral', () => {
		expect(
			extractContinuityTintFromLearned({
				companion_continuity_v1: { mood_tint: 'warm', valence: 0.4 },
			})
		).toBe('warm');
		expect(
			extractContinuityTintFromLearned({
				companion_continuity_v1: { mood_tint: 'neutral' },
			})
		).toBeNull();
		expect(extractContinuityTintFromLearned({})).toBeNull();
	});

	it('extracts trust meter score when baseline row exists', () => {
		expect(
			extractCompanionTrustMeterScore({
				ewa_companion_trust_v1: { score: 7 },
			})
		).toBe(7);
		expect(extractCompanionTrustMeterScore({})).toBeNull();
	});

	it('prefers learned mood scalars over character_state wire snapshot', () => {
		expect(
			mergeCompanionDisplayMood(
				{ valence: -0.5, tension: 0.2 },
				{
					mood: {
						valence: 0.9,
						tension: 0.3,
						energy: 0.5,
						confidence: 0.6,
					},
				}
			)
		).toEqual({
			valence: -0.5,
			tension: 0.2,
			energy: 0.5,
			confidence: 0.6,
		});
	});
});
