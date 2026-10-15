/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T <keysray70@gmail.com>
 * ---
 *
 * Purpose:
 * Regression coverage for EWA opening preloader visual-only contract.
 *
 * Invariants:
 * - EWA opening preloader must not embed the shared EliteEW progress/quote panel.
 * - The window should render only the companion visual canvas while profile content loads.
 *
 * Related:
 * - ../EwaOpeningPreloader.tsx
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EwaOpeningPreloader } from '../EwaOpeningPreloader';

vi.mock('framer-motion', () => ({
	useReducedMotion: () => true,
}));

vi.mock('@/utils/appPreloader', () => ({
	getConfiguredPreloaderMinMs: () => 0,
	getRemainingPreloaderMinMs: () => 0,
}));

describe('EwaOpeningPreloader', () => {
	it('renders companion visuals without EliteEW progress or quote panel', () => {
		const { container } = render(
			<EwaOpeningPreloader contentReady={false} onDismiss={vi.fn()} />
		);

		expect(
			container.querySelector('.ewa-opening-preloader__canvas')
		).not.toBeNull();
		expect(screen.queryByText('EliteEW')).not.toBeInTheDocument();
		expect(container.querySelector('[role="progressbar"]')).toBeNull();
		expect(container.querySelector('blockquote')).toBeNull();
	});
});
