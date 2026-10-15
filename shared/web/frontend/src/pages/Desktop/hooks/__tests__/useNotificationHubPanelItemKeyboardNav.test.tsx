/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Tests for notification panel list keyboard navigation hook.
 *
 * Related:
 * - hooks/useNotificationHubPanelItemKeyboardNav.ts
 */

import { act, renderHook } from '@testing-library/react';
import type { RefObject } from 'react';
import { describe, expect, it } from 'vitest';
import { useNotificationHubItemKeyboardNav } from '../useNotificationHubPanelItemKeyboardNav';

function mountFeed(): {
	feedRef: RefObject<HTMLDivElement>;
	first: HTMLButtonElement;
	second: HTMLButtonElement;
} {
	const feed = document.createElement('div');
	const first = document.createElement('button');
	first.type = 'button';
	first.dataset.notificationHubItem = 'true';
	first.textContent = 'One';
	const second = document.createElement('button');
	second.type = 'button';
	second.dataset.notificationHubItem = 'true';
	second.textContent = 'Two';
	feed.append(first, second);
	document.body.appendChild(feed);
	const feedRef: RefObject<HTMLDivElement> = { current: feed };
	return { feedRef, first, second };
}

describe('useNotificationHubItemKeyboardNav', () => {
	it('moves focus with ArrowDown and Home', () => {
		const { feedRef, first, second } = mountFeed();
		first.focus();

		renderHook(() => useNotificationHubItemKeyboardNav(feedRef, true, 2));

		act(() => {
			window.dispatchEvent(
				new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
			);
		});
		expect(second).toHaveFocus();

		act(() => {
			window.dispatchEvent(
				new KeyboardEvent('keydown', { key: 'Home', bubbles: true })
			);
		});
		expect(first).toHaveFocus();

		feedRef.current?.remove();
	});

	it('ignores navigation while typing in search', () => {
		const { feedRef, first } = mountFeed();
		const input = document.createElement('input');
		document.body.appendChild(input);
		input.focus();

		renderHook(() => useNotificationHubItemKeyboardNav(feedRef, true, 2));

		act(() => {
			window.dispatchEvent(
				new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
			);
		});

		expect(input).toHaveFocus();
		expect(first).not.toHaveFocus();

		feedRef.current?.remove();
		input.remove();
	});
});
