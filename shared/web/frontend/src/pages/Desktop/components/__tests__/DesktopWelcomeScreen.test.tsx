/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Smoke test for DesktopWelcomeScreen spotlight wrapper and dismiss contract.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DesktopWelcomeScreen } from '../DesktopWelcomeScreen';

vi.mock('@/components/guided-tour/SpotlightGuideModal', () => ({
	SpotlightGuideModal: ({
		onClose,
		rootId,
		dialogTitleId,
	}: {
		onClose: () => void;
		rootId: string;
		dialogTitleId: string;
	}) => (
		<div
			data-testid="spotlight-guide-modal"
			data-root-id={rootId}
			id={dialogTitleId}
		>
			<button type="button" onClick={onClose}>
				Close tour
			</button>
		</div>
	),
}));

vi.mock('../useDesktopWelcomeGuideSteps', () => ({
	useDesktopWelcomeGuideStepResolver: () => ({
		resolveKey: 0,
		onPrepareStep: vi.fn(),
	}),
	useDesktopWelcomeGuideSteps: () => [
		{ id: 'intro', title: 'Intro', body: 'Body' },
	],
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}));

describe('DesktopWelcomeScreen', () => {
	it('mounts with desktop-main root and persists dismiss on close', () => {
		const onComplete = vi.fn();
		render(<DesktopWelcomeScreen onComplete={onComplete} />);
		const modal = screen.getByTestId('spotlight-guide-modal');
		expect(modal).toHaveAttribute('data-root-id', 'desktop-main');
		expect(modal).toHaveAttribute('id', 'desktop-welcome-guide-title');
		fireEvent.click(screen.getByRole('button', { name: 'Close tour' }));
		expect(onComplete).toHaveBeenCalledWith({ dismissPermanently: true });
	});
});
