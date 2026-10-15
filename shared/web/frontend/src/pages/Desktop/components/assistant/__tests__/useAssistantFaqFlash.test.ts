/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * FAQ flash hook signal helpers and auto-clear wiring.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAssistantFaqFlash } from '../useAssistantFaqFlash';

describe('useAssistantFaqFlash', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('starts with all flash state cleared', () => {
		const { result } = renderHook(() => useAssistantFaqFlash());
		expect(result.current.faqRefreshFlash).toBe(false);
		expect(result.current.faqSearchFocusFlash).toBe(false);
		expect(result.current.clearLocalFaqFlash).toBe(false);
		expect(result.current.faqInsertFlashId).toBeNull();
		expect(result.current.faqShowFlashId).toBeNull();
		expect(result.current.faqAskFlashId).toBeNull();
		expect(result.current.faqBulkActionFlash).toBeNull();
	});

	it('signal helpers set flash state', () => {
		const { result } = renderHook(() => useAssistantFaqFlash());
		act(() => {
			result.current.signalFaqRefreshFlash();
			result.current.signalFaqSearchFocusFlash();
			result.current.signalClearLocalFaqFlash();
			result.current.signalFaqInsertFlash('faq-i-1');
			result.current.signalFaqShowFlash('faq-s-1');
			result.current.signalFaqAskFlash('faq-a-1');
		});
		expect(result.current.faqRefreshFlash).toBe(true);
		expect(result.current.faqSearchFocusFlash).toBe(true);
		expect(result.current.clearLocalFaqFlash).toBe(true);
		expect(result.current.faqInsertFlashId).toBe('faq-i-1');
		expect(result.current.faqShowFlashId).toBe('faq-s-1');
		expect(result.current.faqAskFlashId).toBe('faq-a-1');
	});

	it('auto-clears flash ids after timeout', () => {
		vi.useFakeTimers();
		const { result } = renderHook(() => useAssistantFaqFlash());
		act(() => {
			result.current.signalFaqShowFlash('faq-s-2');
		});
		expect(result.current.faqShowFlashId).toBe('faq-s-2');
		act(() => {
			vi.advanceTimersByTime(2000);
		});
		expect(result.current.faqShowFlashId).toBeNull();
	});
});
