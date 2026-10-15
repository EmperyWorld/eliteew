/**
 * Tests Content Manager saved views hook and presets.
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
	CONTENT_MANAGER_SAVED_VIEW_PRESETS,
	getContentManagerSavedViewPreset,
	isContentManagerSavedViewId,
	LARGE_FILES_MIN_BYTES,
	useContentManagerSavedViews,
} from './useContentManagerSavedViews';

describe('useContentManagerSavedViews', () => {
	it('starts with no active view', () => {
		const { result } = renderHook(() => useContentManagerSavedViews());
		expect(result.current.activeViewId).toBeNull();
		expect(result.current.activeFilters).toBeNull();
	});

	it('applyView sets active id and returns filters', () => {
		const { result } = renderHook(() => useContentManagerSavedViews());
		let filters: ReturnType<typeof result.current.applyView> | undefined;
		act(() => {
			filters = result.current.applyView('pdf');
		});
		expect(result.current.activeViewId).toBe('pdf');
		expect(filters).toEqual({
			filterType: 'pdf',
			sortField: 'name',
			sortOrder: 'asc',
		});
	});

	it('clearView resets active view', () => {
		const { result } = renderHook(() => useContentManagerSavedViews());
		act(() => {
			result.current.applyView('unfiled');
		});
		act(() => {
			result.current.clearView();
		});
		expect(result.current.activeViewId).toBeNull();
	});

	it('exposes all presets', () => {
		const { result } = renderHook(() => useContentManagerSavedViews());
		expect(result.current.presets).toBe(CONTENT_MANAGER_SAVED_VIEW_PRESETS);
		expect(result.current.presets).toHaveLength(5);
	});
});

describe('saved view presets', () => {
	it('largeFiles preset uses min size threshold', () => {
		const preset = getContentManagerSavedViewPreset('largeFiles');
		expect(preset.filters.minFileSize).toBe(LARGE_FILES_MIN_BYTES);
		expect(preset.filters.sortField).toBe('file_size');
	});

	it('processingErrors preset filters failed status', () => {
		const preset = getContentManagerSavedViewPreset('processingErrors');
		expect(preset.filters.processingStatus).toBe('failed');
	});

	it('isContentManagerSavedViewId guards unknown ids', () => {
		expect(isContentManagerSavedViewId('pdf')).toBe(true);
		expect(isContentManagerSavedViewId('unknown')).toBe(false);
	});
});
