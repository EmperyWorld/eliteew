/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for useCompanionToolsCatalog apply/try/insert handlers (U8.1 extract).
 */

import { act, renderHook } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { COMPANION_IMAGE_OCR_TOOL_CHIP_ID } from '@/features/ewa/companionTools/companionImageOcrToolId';
import { useCompanionToolsCatalog } from '@/features/ewa/companionTools/useCompanionToolsCatalog';

describe('useCompanionToolsCatalog', () => {
	it('submits built-in preset through submitLineRef on try', () => {
		const submitLine = vi.fn();
		const submitLineRef = { current: submitLine };
		const updateDraft = vi.fn();
		const inputRef = createRef<HTMLTextAreaElement>();
		const onOpenOcrSource = vi.fn();

		const { result } = renderHook(() =>
			useCompanionToolsCatalog({
				principalId: 'p1',
				learnedPreferences: {},
				pending: false,
				ocrBusy: false,
				updateDraft,
				inputRef,
				submitLineRef,
				onOpenOcrSource,
			})
		);

		act(() =>
			result.current.handleTryTool({
				id: 'builtin.music',
				label: 'Music',
				promptText: 'play music',
				builtin: true,
				sortOrder: 0,
			})
		);

		expect(submitLine).toHaveBeenCalledWith('play music');
		expect(updateDraft).not.toHaveBeenCalled();
	});

	it('inserts preset text into composer without submit', () => {
		const submitLine = vi.fn();
		const updateDraft = vi.fn();
		const inputRef = createRef<HTMLTextAreaElement>();

		const { result } = renderHook(() =>
			useCompanionToolsCatalog({
				principalId: 'p1',
				learnedPreferences: {},
				pending: false,
				ocrBusy: false,
				updateDraft,
				inputRef,
				submitLineRef: { current: submitLine },
				onOpenOcrSource: vi.fn(),
			})
		);

		act(() =>
			result.current.handleInsertTool({
				id: 'builtin.music',
				label: 'Music',
				promptText: 'play music',
				builtin: true,
				sortOrder: 0,
			})
		);

		expect(updateDraft).toHaveBeenCalledWith('play music');
		expect(submitLine).not.toHaveBeenCalled();
	});

	it('opens OCR source for OCR tool chip on try', () => {
		const onOpenOcrSource = vi.fn();
		const { result } = renderHook(() =>
			useCompanionToolsCatalog({
				principalId: 'p1',
				learnedPreferences: {},
				pending: false,
				ocrBusy: false,
				updateDraft: vi.fn(),
				inputRef: createRef(),
				submitLineRef: { current: vi.fn() },
				onOpenOcrSource,
			})
		);

		act(() =>
			result.current.handleTryTool({
				id: COMPANION_IMAGE_OCR_TOOL_CHIP_ID,
				label: 'OCR',
				promptText: '',
				builtin: true,
				sortOrder: 0,
			})
		);

		expect(onOpenOcrSource).toHaveBeenCalledTimes(1);
	});
});
