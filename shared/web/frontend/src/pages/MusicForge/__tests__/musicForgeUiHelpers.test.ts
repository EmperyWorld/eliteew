/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for MusicForge pages-layer helpers.
 *
 * Invariants:
 * - Covers user-safe error sanitization and form validation helpers.
 *
 * Related:
 * - src/pages/MusicForge/musicForgeUiHelpers.ts
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
	claimMusicForgeAutoPlay,
	ideaNeedsMinLengthHint,
	musicForgeConstraintsForVocal,
	musicForgeExtraConstraintsFromPayload,
	parseMusicForgeVocalFromConstraints,
	resolveMusicForgeContentId,
	resolveMusicForgeErrorMessage,
} from '../musicForgeUiHelpers';

describe('musicForgeUiHelpers', () => {
	beforeEach(() => {
		sessionStorage.clear();
	});

	it('resolves backend error_payload.message when safe', () => {
		expect(
			resolveMusicForgeErrorMessage(
				{ message: 'Сервис генерации временно недоступен' },
				'fallback'
			)
		).toBe('Сервис генерации временно недоступен');
	});

	it('falls back on stack-trace shaped payloads', () => {
		expect(
			resolveMusicForgeErrorMessage(
				{ message: 'Traceback (most recent call last):\n  File "pipeline.py"' },
				'fallback'
			)
		).toBe('fallback');
	});

	it('flags idea min-length helper for 1-2 trimmed chars', () => {
		expect(ideaNeedsMinLengthHint('')).toBe(false);
		expect(ideaNeedsMinLengthHint('ab')).toBe(true);
		expect(ideaNeedsMinLengthHint('abc')).toBe(false);
	});

	it('resolves content_id from run top-level or result_payload', () => {
		expect(
			resolveMusicForgeContentId({
				content_id: 'top-id',
				result_payload: { content_id: 'payload-id' },
			})
		).toBe('top-id');
		expect(
			resolveMusicForgeContentId({
				content_id: null,
				result_payload: { content_id: 'payload-id' },
			})
		).toBe('payload-id');
		expect(resolveMusicForgeContentId({ result_payload: {} })).toBe('');
	});

	it('claims auto-play only once per run id', () => {
		expect(claimMusicForgeAutoPlay('run-a')).toBe(true);
		expect(claimMusicForgeAutoPlay('run-a')).toBe(false);
		expect(claimMusicForgeAutoPlay('run-b')).toBe(true);
	});

	it('builds vocal constraints and parses them back', () => {
		const full = musicForgeConstraintsForVocal('male', 'ru', 'без пафоса');
		expect(full).toContain('Lead vocal: male.');
		expect(musicForgeExtraConstraintsFromPayload(full)).toBe('без пафоса');
		expect(parseMusicForgeVocalFromConstraints(full)).toBe('male');
	});

	it('adds preferred sung language for es/fr', () => {
		expect(musicForgeConstraintsForVocal('female', 'es', '')).toContain(
			'Preferred sung language: Spanish'
		);
		expect(parseMusicForgeVocalFromConstraints(null)).toBe('female');
	});
});
