/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unit tests for document visibility sync subscription helper.
 *
 * Related:
 * - src/pages/Desktop/utils/subscribeDocumentVisibleSync.ts
 */

import { describe, expect, it, vi } from 'vitest';

import {
	subscribeDocumentHiddenSync,
	subscribeDocumentVisibilityChange,
	subscribeDocumentVisibleSync,
} from '@/pages/Desktop/utils/subscribeDocumentVisibleSync';

describe('subscribeDocumentVisibleSync', () => {
	it('calls callback when tab becomes visible', () => {
		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			value: 'hidden',
		});

		const onVisible = vi.fn();
		const unsubscribe = subscribeDocumentVisibleSync(onVisible);
		expect(onVisible).not.toHaveBeenCalled();

		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			value: 'visible',
		});
		document.dispatchEvent(new Event('visibilitychange'));
		expect(onVisible).toHaveBeenCalledTimes(1);

		unsubscribe();
		document.dispatchEvent(new Event('visibilitychange'));
		expect(onVisible).toHaveBeenCalledTimes(1);
	});

	it('ignores hidden transitions', () => {
		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			value: 'visible',
		});

		const onVisible = vi.fn();
		const unsubscribe = subscribeDocumentVisibleSync(onVisible);

		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			value: 'hidden',
		});
		document.dispatchEvent(new Event('visibilitychange'));
		expect(onVisible).not.toHaveBeenCalled();

		unsubscribe();
	});
});

describe('subscribeDocumentHiddenSync', () => {
	it('calls callback when tab becomes hidden', () => {
		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			value: 'visible',
		});

		const onHidden = vi.fn();
		const unsubscribe = subscribeDocumentHiddenSync(onHidden);
		expect(onHidden).not.toHaveBeenCalled();

		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			value: 'hidden',
		});
		document.dispatchEvent(new Event('visibilitychange'));
		expect(onHidden).toHaveBeenCalledTimes(1);

		unsubscribe();
		document.dispatchEvent(new Event('visibilitychange'));
		expect(onHidden).toHaveBeenCalledTimes(1);
	});
});

describe('subscribeDocumentVisibilityChange', () => {
	it('fires on every visibility transition', () => {
		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			value: 'visible',
		});

		const onChange = vi.fn();
		const unsubscribe = subscribeDocumentVisibilityChange(onChange);

		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			value: 'hidden',
		});
		document.dispatchEvent(new Event('visibilitychange'));
		expect(onChange).toHaveBeenCalledTimes(1);

		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			value: 'visible',
		});
		document.dispatchEvent(new Event('visibilitychange'));
		expect(onChange).toHaveBeenCalledTimes(2);

		unsubscribe();
	});
});
