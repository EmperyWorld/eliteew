import { describe, expect, it } from 'vitest';

import { mergeEwrpSaveSlidesStatus } from './ewrpMergeSaveSlidesStatus';
import type { EwrpSlide, EwrpStatusResponse } from '@/services/ewrpApi';

const sampleSlide = (n: number): EwrpSlide => ({
	title: `T${n}`,
	bullets: [],
	image_filename: 'a.png',
});

describe('mergeEwrpSaveSlidesStatus', () => {
	it('returns generating_images with null pdf and slides from response or cleaned', () => {
		const cleaned: EwrpSlide[] = [sampleSlide(1)];
		const updated: EwrpStatusResponse = {
			id: '00000000-0000-0000-0000-000000000001',
			status: 'generating_images',
			progress: 20,
			error_message: null,
			pdf_url: null,
			slides: cleaned,
		};
		const r = mergeEwrpSaveSlidesStatus(updated, cleaned);
		expect(r.kind).toBe('generating_images');
		if (r.kind === 'generating_images') {
			expect(r.merged.pdf_url).toBeNull();
			expect(r.merged.status).toBe('generating_images');
			expect(r.merged.slides).toEqual(cleaned);
		}
	});

	it('forces building_pdf when server returns other success shape', () => {
		const cleaned: EwrpSlide[] = [sampleSlide(1)];
		const updated: EwrpStatusResponse = {
			id: '00000000-0000-0000-0000-000000000001',
			status: 'completed',
			progress: 100,
			error_message: null,
			pdf_url: null,
		};
		const r = mergeEwrpSaveSlidesStatus(updated, cleaned);
		expect(r.kind).toBe('building_pdf');
		if (r.kind === 'building_pdf') {
			expect(r.merged.status).toBe('building_pdf');
			expect(r.merged.progress).toBeGreaterThanOrEqual(60);
			expect(r.merged.pdf_url).toBeNull();
			expect(r.merged.slides).toEqual(cleaned);
		}
	});

	it('returns fallback when updated is missing', () => {
		const cleaned: EwrpSlide[] = [sampleSlide(1)];
		expect(mergeEwrpSaveSlidesStatus(undefined, cleaned).kind).toBe('fallback');
	});
});
