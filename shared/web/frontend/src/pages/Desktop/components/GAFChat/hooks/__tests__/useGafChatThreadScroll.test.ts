/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Behavioral tests for GAF Chat thread scroll hook (FAB visibility contract).
 *
 * Invariants:
 * - showScrollDown stays false at bottom; true when scrolled up with messages present.
 *
 * Related:
 * - src/pages/Desktop/components/GAFChat/hooks/useGafChatThreadScroll.ts
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useGafChatThreadScroll } from '../useGafChatThreadScroll';

function mockScrollEl({
	scrollHeight,
	clientHeight,
	scrollTop,
}: {
	scrollHeight: number;
	clientHeight: number;
	scrollTop: number;
}) {
	const el = document.createElement('div');
	Object.defineProperty(el, 'scrollHeight', {
		value: scrollHeight,
		configurable: true,
	});
	Object.defineProperty(el, 'clientHeight', {
		value: clientHeight,
		configurable: true,
	});
	Object.defineProperty(el, 'scrollTop', {
		value: scrollTop,
		writable: true,
		configurable: true,
	});
	el.scrollTo = () => {};
	return el;
}

describe('useGafChatThreadScroll', () => {
	it('sets showScrollDown when user is not at bottom and messages exist', () => {
		const { result } = renderHook(() =>
			useGafChatThreadScroll({
				selectedChatId: 'chat-1',
				messagesLength: 3,
				messagesLoading: false,
				hasNextPage: false,
				isFetchingNextPage: false,
				fetchNextPage: async () => {},
			})
		);

		const el = mockScrollEl({
			scrollHeight: 1000,
			clientHeight: 400,
			scrollTop: 0,
		});
		act(() => {
			(
				result.current.messageListRef as { current: HTMLDivElement | null }
			).current = el;
			result.current.updateMessageListScrollUi();
		});

		expect(result.current.showScrollDown).toBe(true);
	});

	it('hides showScrollDown when scrolled to bottom threshold', () => {
		const { result } = renderHook(() =>
			useGafChatThreadScroll({
				selectedChatId: 'chat-1',
				messagesLength: 3,
				messagesLoading: false,
				hasNextPage: false,
				isFetchingNextPage: false,
				fetchNextPage: async () => {},
			})
		);

		const el = mockScrollEl({
			scrollHeight: 1000,
			clientHeight: 400,
			scrollTop: 600,
		});
		act(() => {
			(
				result.current.messageListRef as { current: HTMLDivElement | null }
			).current = el;
			result.current.updateMessageListScrollUi();
		});

		expect(result.current.showScrollDown).toBe(false);
	});
});
