/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock one-shot web-search arm UX: chip visible while armed; disarm clears arm.
 *
 * Invariants:
 * - No animation classes on the chip root.
 *
 * Related:
 * - components/DesktopAiWebSearchArmChip.tsx
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { TFunction } from 'i18next';
import { describe, expect, it, vi } from 'vitest';

import { DesktopAiWebSearchArmChip } from '../components/DesktopAiWebSearchArmChip';
import { resolveUseWebSearchFlag } from '../hooks/desktopAiChatStream/helpers';

const t = ((key: string) => key) as TFunction<'desktopAiChat'>;

describe('DesktopAiWebSearchArmChip', () => {
	it('shows arm label and disarms on one click without animation class', () => {
		const onDisarm = vi.fn();
		const { container } = render(
			<DesktopAiWebSearchArmChip onDisarm={onDisarm} lucideStroke={1.5} t={t} />
		);
		const chip = screen.getByTestId('desktop-ai-web-search-arm');
		expect(chip.className).not.toMatch(/animate-/);
		expect(screen.getByText('webSearchArmChip')).toBeInTheDocument();
		fireEvent.click(
			screen.getByRole('button', { name: 'webSearchArmDisarmAria' })
		);
		expect(onDisarm).toHaveBeenCalledTimes(1);
		expect(
			container.querySelector('[data-testid="desktop-ai-web-search-arm"]')
		).toBeTruthy();
	});
});

describe('resolveUseWebSearchFlag one-shot contract', () => {
	it('ensemble can arm without tools; solo needs tools', () => {
		expect(
			resolveUseWebSearchFlag({
				useWebSearch: true,
				useTools: false,
				isEnsemble: true,
				adminEnabled: true,
			})
		).toBe(true);
		expect(
			resolveUseWebSearchFlag({
				useWebSearch: true,
				useTools: false,
				isEnsemble: false,
				adminEnabled: true,
			})
		).toBe(false);
		expect(
			resolveUseWebSearchFlag({
				useWebSearch: false,
				useTools: true,
				isEnsemble: false,
				adminEnabled: true,
			})
		).toBe(false);
	});
});
