/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for CompanionComposerShell (U8.3 slice 17).
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionComposerShell } from '@/features/ewa/companionUx/CompanionComposerShell';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'en' },
	}),
}));

describe('CompanionComposerShell', () => {
	it('renders composer card with children', () => {
		render(
			<CompanionComposerShell
				composerRef={{ current: null }}
				imageInputRef={{ current: null }}
				mobileEmbeddedLayout={false}
				mobileEmbeddedLandscape={false}
				pendingImage={null}
				pending={false}
				onClearPendingImage={vi.fn()}
				onImageFileChange={vi.fn()}
			>
				<span data-testid="composer-child">body</span>
			</CompanionComposerShell>
		);
		expect(screen.getByTestId('ewa-companion-composer')).toBeInTheDocument();
		expect(screen.getByTestId('composer-child')).toBeInTheDocument();
	});
});
