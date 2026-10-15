/**
 * Regression: legacy pending UGS must call `storeUgsDesktopDeepLink` before
 * `consumeUgsDesktopDeepLink` in the synchronous effect chain (session path).
 * (Event `UGS_DESKTOP_DEEPLINK_EVENT` can mask wrong order; this test locks store→consume order.)
 */

import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const callOrder = vi.hoisted(() => [] as string[]);

vi.mock('../../utils/ugsDesktopDeepLink', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('../../utils/ugsDesktopDeepLink')>();
	return {
		...actual,
		storeUgsDesktopDeepLink: (
			...args: Parameters<typeof actual.storeUgsDesktopDeepLink>
		) => {
			callOrder.push('store');
			return actual.storeUgsDesktopDeepLink(...args);
		},
		consumeUgsDesktopDeepLink: () => {
			callOrder.push('consume');
			return actual.consumeUgsDesktopDeepLink();
		},
	};
});

import { PENDING_DESKTOP_OPEN_KEY } from '../../utils/pendingDesktopOpen';
import { useDesktopUgsDeepLinkEffects } from '../useDesktopUgsDeepLinkEffects';
import { useLegacyPendingDesktopOpenEffect } from '../useLegacyPendingDesktopOpenEffect';

function CorrectOrderHarness(props: {
	openUgsDesktopApp: (args: { view: string }) => void;
	setCurrentPage: (p: string) => void;
}) {
	const { openUgsDesktopApp, setCurrentPage } = props;
	useLegacyPendingDesktopOpenEffect({
		items: [],
		installedApps: [],
		installedAppIds: new Set(),
		handleOpenWindow: vi.fn(),
	});
	useDesktopUgsDeepLinkEffects({
		openUgsDesktopApp,
		currentPage: 'desktop',
		setCurrentPage,
	});
	return null;
}

function WrongOrderHarness(props: {
	openUgsDesktopApp: (args: { view: string }) => void;
	setCurrentPage: (p: string) => void;
}) {
	const { openUgsDesktopApp, setCurrentPage } = props;
	useDesktopUgsDeepLinkEffects({
		openUgsDesktopApp,
		currentPage: 'desktop',
		setCurrentPage,
	});
	useLegacyPendingDesktopOpenEffect({
		items: [],
		installedApps: [],
		installedAppIds: new Set(),
		handleOpenWindow: vi.fn(),
	});
	return null;
}

describe('desktop shell UGS launch order', () => {
	beforeEach(() => {
		sessionStorage.clear();
		callOrder.length = 0;
		vi.clearAllMocks();
	});

	it('runs store before consume when legacy pending runs first', () => {
		sessionStorage.setItem(
			PENDING_DESKTOP_OPEN_KEY,
			JSON.stringify({ kind: 'ugs', rawTarget: 'ugs' })
		);

		render(
			<CorrectOrderHarness
				openUgsDesktopApp={vi.fn()}
				setCurrentPage={vi.fn()}
			/>
		);

		const firstStore = callOrder.indexOf('store');
		const firstConsume = callOrder.indexOf('consume');
		expect(firstStore).not.toBe(-1);
		expect(firstConsume).not.toBe(-1);
		expect(firstStore).toBeLessThan(firstConsume);
	});

	it('runs consume before store when deep-link effects are registered first (bad for session path)', () => {
		sessionStorage.setItem(
			PENDING_DESKTOP_OPEN_KEY,
			JSON.stringify({ kind: 'ugs', rawTarget: 'ugs' })
		);

		render(
			<WrongOrderHarness openUgsDesktopApp={vi.fn()} setCurrentPage={vi.fn()} />
		);

		const firstStore = callOrder.indexOf('store');
		const firstConsume = callOrder.indexOf('consume');
		expect(firstStore).not.toBe(-1);
		expect(firstConsume).not.toBe(-1);
		expect(firstConsume).toBeLessThan(firstStore);
	});
});
