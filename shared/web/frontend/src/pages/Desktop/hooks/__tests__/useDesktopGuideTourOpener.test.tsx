/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression tests for desktop guide-tour opener registration (React #185 guard).
 *
 * Invariants:
 * - Unstable `open` callback identity must not re-register on every child render.
 *
 * Related:
 * - hooks/useDesktopGuideTourOpener.ts, context/DesktopGuideTourOpenerContext.tsx
 */

import { render } from '@testing-library/react';
import { useEffect, useState, type JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { DesktopGuideTourOpenerProvider } from '../../context/DesktopGuideTourOpenerContext';
import { useDesktopGuideTourOpener } from '../useDesktopGuideTourOpener';

function UnstableOpenerChild(): JSX.Element {
	const [, bump] = useState(0);
	const open = () => bump((n) => n + 1);
	useDesktopGuideTourOpener(open);
	useEffect(() => {
		bump(1);
	}, []);
	return <div data-testid="child" />;
}

describe('useDesktopGuideTourOpener', () => {
	it('registers once even when open callback identity changes between renders', () => {
		const setOpener = vi.fn();
		render(
			<DesktopGuideTourOpenerProvider setOpener={setOpener}>
				<UnstableOpenerChild />
			</DesktopGuideTourOpenerProvider>
		);
		expect(setOpener).toHaveBeenCalledTimes(1);
		expect(typeof setOpener.mock.calls[0]?.[0]).toBe('function');
	});
});
