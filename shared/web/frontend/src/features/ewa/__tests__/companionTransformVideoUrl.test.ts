/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for **`companionTransformVideoUrl`** (SSE transform kind → Vite public path).
 *
 * Invariants:
 * - Paths are rooted at `import.meta.env.BASE_URL` without double slashes after normalization.
 *
 * Related:
 * - src/features/ewa/companionTransformVideoUrl.ts
 */
import { describe, expect, it } from 'vitest';
import { companionTransformVideoUrl } from '@/features/ewa/companionTransformVideoUrl';

describe('companionTransformVideoUrl', () => {
	it('maps kinds to stable public/ewa mp4 suffixes', () => {
		expect(companionTransformVideoUrl('ewa_to_arly')).toMatch(
			/\/ewa\/ewa_to_arly\.mp4$/
		);
		expect(companionTransformVideoUrl('EWa_RESTORE')).toMatch(
			/\/ewa\/arly_to_ewa\.mp4$/
		);
		expect(companionTransformVideoUrl('arly_to_ewa')).toMatch(
			/\/ewa\/arly_to_ewa\.mp4$/
		);
		expect(companionTransformVideoUrl('arlika')).toMatch(
			/\/ewa\/arly_transform\.mp4$/
		);
		expect(companionTransformVideoUrl(null)).toMatch(
			/\/ewa\/arly_transform\.mp4$/
		);
	});
});
