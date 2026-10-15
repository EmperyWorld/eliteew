/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for CompanionTransformVideoPortal (U8.3 slice 11).
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionTransformVideoPortal } from '@/features/ewa/companionUx/CompanionTransformVideoPortal';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (_key: string, fallback?: string) => fallback ?? _key,
		i18n: { language: 'en' },
	}),
}));

describe('CompanionTransformVideoPortal', () => {
	it('renders dialog when open', () => {
		render(
			<CompanionTransformVideoPortal
				open={true}
				failed={false}
				loading={false}
				src="/videos/test.mp4"
				retry={0}
				needsControls={false}
				videoRef={{ current: null }}
				onClose={vi.fn()}
				onReady={vi.fn()}
				onError={vi.fn()}
			/>
		);
		expect(screen.getByRole('dialog')).toBeInTheDocument();
	});

	it('returns null when closed', () => {
		const { container } = render(
			<CompanionTransformVideoPortal
				open={false}
				failed={false}
				loading={false}
				src=""
				retry={0}
				needsControls={false}
				videoRef={{ current: null }}
				onClose={vi.fn()}
				onReady={vi.fn()}
				onError={vi.fn()}
			/>
		);
		expect(container).toBeEmptyDOMElement();
	});
});
