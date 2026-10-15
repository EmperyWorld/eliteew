/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for license mode IA (#011).
 *
 * Invariants:
 * - — (нет)
 *
 * Related:
 * - src/lib/launcher/licenseModes.ts
 */

import { describe, expect, it } from 'vitest';
import {
	DEFAULT_SEAT_MODE,
	flagsForMode,
	modeLabelRu,
	normalizeSeatMode,
	resolveSeatModeLabelRu,
	seatModeFromEdition,
} from './licenseModes';

describe('licenseModes', () => {
	it('defaults to offline', () => {
		expect(DEFAULT_SEAT_MODE).toBe('offline');
		expect(normalizeSeatMode(undefined)).toBe('offline');
		expect(normalizeSeatMode('client-offline-ai')).toBe('offline');
		expect(normalizeSeatMode('connected')).toBe('cloud');
		expect(normalizeSeatMode('both')).toBe('both');
	});

	it('maps edition/profile without exposing raw ids in labels', () => {
		expect(seatModeFromEdition('client', 'client-offline-ai')).toBe('offline');
		expect(seatModeFromEdition('connected')).toBe('cloud');
		expect(
			seatModeFromEdition('client', 'client-offline-ai', {
				allowOffline: true,
				allowOnline: true,
			})
		).toBe('both');
		expect(flagsForMode('both')).toEqual({
			allowOffline: true,
			allowOnline: true,
		});
		expect(modeLabelRu('offline')).toBe('Офлайн-режим');
		expect(modeLabelRu('cloud')).toBe('Облачный режим');
		expect(modeLabelRu('both')).toBe('Офлайн и облако');
		expect(modeLabelRu('offline')).not.toContain('client-offline');
	});

	it('prefers packaged mode_label_ru', () => {
		expect(
			resolveSeatModeLabelRu({
				mode: 'cloud',
				modeLabelRu: 'Облачный режим',
			})
		).toBe('Облачный режим');
		expect(
			resolveSeatModeLabelRu({
				edition: 'client',
				profileId: 'client-offline-ai',
			})
		).toBe('Офлайн-режим');
	});
});
