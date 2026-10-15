/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract tests for the EWRP slide preview fetch readiness guard.
 *
 * Invariants:
 * - Slides marked not ready by status must not trigger authenticated image downloads.
 *
 * Related:
 * - src/components/EWRP/ewrpSlideImageReadiness.ts
 */

import { describe, expect, it } from 'vitest';

import { ewrpShouldFetchSlideImage } from './ewrpSlideImageReadiness';

describe('ewrpShouldFetchSlideImage', () => {
	it('allows fetching when a job id and ready filename are present', () => {
		expect(
			ewrpShouldFetchSlideImage('job-1', {
				image_filename: 'slide_1.png',
				image_ready: true,
			})
		).toBe(true);
	});

	it('blocks fetching when status says the slide image is not ready', () => {
		expect(
			ewrpShouldFetchSlideImage('job-1', {
				image_filename: 'slide_1.png',
				image_ready: false,
			})
		).toBe(false);
	});

	it('blocks fetching without a concrete image filename', () => {
		expect(
			ewrpShouldFetchSlideImage('job-1', {
				image_filename: null,
				image_ready: true,
			})
		).toBe(false);
	});
});
