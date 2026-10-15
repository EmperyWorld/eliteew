import type { EwrpSlide, EwrpStatusResponse } from '@/services/ewrpApi';

export type EwrpMergedSaveStatus =
	| {
			kind: 'generating_images';
			merged: EwrpStatusResponse;
	  }
	| {
			kind: 'building_pdf';
			merged: EwrpStatusResponse;
	  }
	| { kind: 'fallback' };

/**
 * Maps PUT /slides response into local status when saving the slide editor.
 * Pure helper — covered by Vitest.
 */
export function mergeEwrpSaveSlidesStatus(
	updated: EwrpStatusResponse | null | undefined,
	cleaned: EwrpSlide[]
): EwrpMergedSaveStatus {
	if (updated) {
		if (updated.status === 'generating_images') {
			return {
				kind: 'generating_images',
				merged: {
					...updated,
					pdf_url: null,
					slides: updated.slides ?? cleaned,
				},
			};
		}
		return {
			kind: 'building_pdf',
			merged: {
				...updated,
				status: 'building_pdf',
				progress: Math.max(updated.progress ?? 60, 60),
				pdf_url: null,
				slides: cleaned,
			},
		};
	}
	return { kind: 'fallback' };
}
