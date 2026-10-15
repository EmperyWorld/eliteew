/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for CompanionDesktopComposerBody single-column layout.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionDesktopComposerBody } from '@/features/ewa/companionUx/CompanionDesktopComposerBody';

vi.mock('@/features/ewa/companionUx/CompanionComposerDraftStack', () => ({
	CompanionComposerDraftStack: () => <div data-testid="draft-stack" />,
}));

vi.mock('@/features/ewa/companionUx/CompanionDesktopComposerFooter', () => ({
	CompanionDesktopComposerFooter: () => <div data-testid="composer-footer" />,
}));

describe('CompanionDesktopComposerBody', () => {
	it('renders draft stack and footer without internal launcher rail', () => {
		render(
			<CompanionDesktopComposerBody
				draftStackProps={{} as never}
				footerProps={{} as never}
			/>
		);

		expect(screen.getByTestId('draft-stack')).toBeInTheDocument();
		expect(screen.getByTestId('composer-footer')).toBeInTheDocument();
		expect(
			screen.queryByTestId('ewa-companion-composer-launcher-rail')
		).not.toBeInTheDocument();
	});
});
