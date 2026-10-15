/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Phase derivation for companion voice session UI states.
 *
 * Invariants:
 * - —
 *
 * Related:
 * - src/features/ewa/useEwaCompanionVoiceSession.ts
 */

import { describe, expect, it } from 'vitest';
import { deriveEwaCompanionVoiceSessionPhase } from '@/features/ewa/useEwaCompanionVoiceSession';

describe('deriveEwaCompanionVoiceSessionPhase', () => {
	it('returns null when session inactive', () => {
		expect(
			deriveEwaCompanionVoiceSessionPhase(false, 'recording', true, 'playing')
		).toBeNull();
	});

	it('prioritizes recording over pending', () => {
		expect(
			deriveEwaCompanionVoiceSessionPhase(true, 'recording', true, 'idle')
		).toBe('listening');
	});

	it('maps transcribing to recognizing', () => {
		expect(
			deriveEwaCompanionVoiceSessionPhase(true, 'transcribing', false, 'idle')
		).toBe('recognizing');
	});

	it('maps TTS busy to speaking', () => {
		expect(
			deriveEwaCompanionVoiceSessionPhase(true, 'idle', false, 'synthesizing')
		).toBe('speaking');
	});

	it('maps pending to thinking when idle mic and TTS', () => {
		expect(
			deriveEwaCompanionVoiceSessionPhase(true, 'idle', true, 'idle')
		).toBe('thinking');
	});

	it('defaults to ready', () => {
		expect(
			deriveEwaCompanionVoiceSessionPhase(true, 'idle', false, 'idle')
		).toBe('ready');
	});
});
