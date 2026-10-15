/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for CompanionToolsCatalogPanel availability badges and access chips.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionToolsCatalogPanel } from '@/features/ewa/companionTools/CompanionToolsCatalogPanel';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'en' },
	}),
}));

describe('CompanionToolsCatalogPanel', () => {
	it('renders availability badges and access channel chips', () => {
		render(
			<CompanionToolsCatalogPanel
				open={true}
				onClose={vi.fn()}
				principalId="parent-1"
				pinnedToolIds={[]}
				recentToolIds={[]}
				onPinnedChange={vi.fn()}
				onTryTool={vi.fn()}
				onInsertTool={vi.fn()}
				embeddedMobile={false}
				variant="sheet"
				portalHost="inline"
			/>
		);

		expect(
			screen.getByTestId('ewa-companion-tool-availability-musicStudioOpen')
		).toHaveTextContent('ewaCompanion.toolsCatalog.badgeDesktopOnly');
		expect(
			screen.getByTestId('ewa-companion-tool-availability-documentRewrite')
		).toHaveTextContent('ewaCompanion.toolsCatalog.badgeNeedsEditor');
		expect(
			screen.getByTestId('ewa-companion-tool-availability-musicGenerate')
		).toHaveTextContent('ewaCompanion.toolsCatalog.badgeAvailable');
	});
});
