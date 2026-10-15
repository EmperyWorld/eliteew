import { describe, expect, it } from 'vitest';
import type { Content as ContentItem } from '../../../components/UnifiedContent/types';
import {
	canReprocessUnifiedContent,
	canReprocessUnifiedContentDisplay,
	isUnifiedContentProcessingFailed,
	reprocessMenuLabelKey,
} from './contentManagerReprocess';

function baseItem(overrides: Partial<ContentItem>): ContentItem {
	return {
		id: 'x',
		name: 'n',
		content_type: 'document',
		can_edit: true,
		...overrides,
	} as ContentItem;
}

describe('canReprocessUnifiedContentDisplay', () => {
	it('returns true for document when can_edit is not false', () => {
		expect(canReprocessUnifiedContentDisplay(baseItem({}))).toBe(true);
		expect(
			canReprocessUnifiedContentDisplay(baseItem({ can_edit: undefined }))
		).toBe(true);
	});

	it('returns false when can_edit is false', () => {
		expect(
			canReprocessUnifiedContentDisplay(baseItem({ can_edit: false }))
		).toBe(false);
	});

	it('returns true for presentation and spreadsheet', () => {
		expect(
			canReprocessUnifiedContentDisplay(
				baseItem({ content_type: 'presentation' })
			)
		).toBe(true);
		expect(
			canReprocessUnifiedContentDisplay(
				baseItem({ content_type: 'spreadsheet' })
			)
		).toBe(true);
	});

	it('returns false for audio and image', () => {
		expect(
			canReprocessUnifiedContentDisplay(baseItem({ content_type: 'audio' }))
		).toBe(false);
		expect(
			canReprocessUnifiedContentDisplay(baseItem({ content_type: 'image' }))
		).toBe(false);
	});
});

describe('canReprocessUnifiedContent', () => {
	it('allows failed video even when display reprocess is false', () => {
		expect(
			canReprocessUnifiedContent(
				baseItem({ content_type: 'video', processing_status: 'failed' })
			)
		).toBe(true);
	});

	it('blocks failed items without edit permission', () => {
		expect(
			canReprocessUnifiedContent(
				baseItem({ processing_status: 'failed', can_edit: false })
			)
		).toBe(false);
	});

	it('falls back to display-only types when not failed', () => {
		expect(
			canReprocessUnifiedContent(baseItem({ content_type: 'audio' }))
		).toBe(false);
		expect(
			canReprocessUnifiedContent(baseItem({ content_type: 'document' }))
		).toBe(true);
	});
});

describe('isUnifiedContentProcessingFailed', () => {
	it('matches failed status case-insensitively', () => {
		expect(
			isUnifiedContentProcessingFailed(
				baseItem({ processing_status: 'FAILED' })
			)
		).toBe(true);
		expect(
			isUnifiedContentProcessingFailed(
				baseItem({ processing_status: 'completed' })
			)
		).toBe(false);
	});
});

describe('reprocessMenuLabelKey', () => {
	it('uses failed label when processing failed', () => {
		expect(
			reprocessMenuLabelKey(baseItem({ processing_status: 'failed' }))
		).toBe('pro.menu.reprocessFailed');
		expect(reprocessMenuLabelKey(baseItem({}))).toBe(
			'pro.menu.reprocessDisplay'
		);
	});
});
