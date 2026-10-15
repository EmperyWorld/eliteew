import { describe, expect, it } from 'vitest';
import {
	EWRP_SLIDE_IMAGE_PROMPT_MIN_LEN,
	ewrpSlideEditorAiDisabled,
	ewrpSlideEditorDisabledTitle,
	isEwrpSlideImagePromptValid,
} from './ewrpSlideEditorHelpers';

describe('isEwrpSlideImagePromptValid', () => {
	it('requires trimmed length >= min', () => {
		expect(isEwrpSlideImagePromptValid('abc')).toBe(false);
		expect(isEwrpSlideImagePromptValid('  abcd  ')).toBe(true);
		expect(EWRP_SLIDE_IMAGE_PROMPT_MIN_LEN).toBe(4);
	});
});

describe('ewrpSlideEditorAiDisabled', () => {
	it('disabled without job id', () => {
		expect(
			ewrpSlideEditorAiDisabled({
				jobId: null,
				status: 'completed',
				busySlideIndex: null,
			})
		).toBe(true);
	});

	it('disabled while job is busy', () => {
		expect(
			ewrpSlideEditorAiDisabled({
				jobId: 'j1',
				status: 'generating_content',
				busySlideIndex: null,
			})
		).toBe(true);
	});

	it('disabled while a slide submit is in flight', () => {
		expect(
			ewrpSlideEditorAiDisabled({
				jobId: 'j1',
				status: 'completed',
				busySlideIndex: 2,
			})
		).toBe(true);
	});

	it('enabled for terminal job with no busy slide', () => {
		expect(
			ewrpSlideEditorAiDisabled({
				jobId: 'j1',
				status: 'completed',
				busySlideIndex: null,
			})
		).toBe(false);
	});
});

describe('ewrpSlideEditorDisabledTitle', () => {
	const t = (key: string) => key;

	it('returns menu title when enabled', () => {
		expect(
			ewrpSlideEditorDisabledTitle(
				{
					jobId: 'j1',
					status: 'completed',
					busySlideIndex: null,
					rowBusy: false,
				},
				t
			)
		).toBe('slideEditor.ugsMenuTitle');
	});

	it('returns rebuild hint when job is busy', () => {
		expect(
			ewrpSlideEditorDisabledTitle(
				{
					jobId: 'j1',
					status: 'generating_images',
					busySlideIndex: null,
					rowBusy: false,
				},
				t
			)
		).toBe('notify.waitForRebuildSub');
	});

	it('returns other-slide hint when another slide submits', () => {
		expect(
			ewrpSlideEditorDisabledTitle(
				{
					jobId: 'j1',
					status: 'completed',
					busySlideIndex: 2,
					rowBusy: false,
				},
				t
			)
		).toBe('slideEditor.disabledOtherSlideBusy');
	});
});
