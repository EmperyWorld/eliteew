/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for MusicForge header status tone helpers.
 */

import { describe, expect, it } from 'vitest';
import type { MusicForgeRun } from '@/services/musicForge/musicForgeApi';
import {
	musicForgeHeaderStatusTextTone,
	musicForgeHeaderStatusTone,
} from '../musicForgeStatusTone';

function runWithStatus(status: MusicForgeRun['status']): MusicForgeRun {
	return {
		id: 'run-1',
		status,
		idea: 'test',
		language: 'ru',
		duration_seconds: 120,
		progress_current: 0,
		progress_total: 0,
		normalized_input: {},
		song_blueprint: {},
		lyrics_payload: {},
		style_capsule: {},
		render_payload: {},
		result_payload: {},
		error_payload: {},
		created_at: '2026-06-30T00:00:00Z',
		updated_at: '2026-06-30T00:00:00Z',
		steps: [],
	};
}

describe('musicForgeStatusTone', () => {
	it('maps completed run to emerald tone', () => {
		expect(
			musicForgeHeaderStatusTone(runWithStatus('completed'), false)
		).toContain('emerald');
		expect(
			musicForgeHeaderStatusTextTone(runWithStatus('completed'), false)
		).toContain('emerald');
	});

	it('maps failed run to rose tone', () => {
		expect(
			musicForgeHeaderStatusTone(runWithStatus('failed'), false)
		).toContain('rose');
	});

	it('uses amber tone when cancel pending', () => {
		expect(
			musicForgeHeaderStatusTone(runWithStatus('running'), true)
		).toContain('amber');
	});
});
