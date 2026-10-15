/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * RTL smoke render for EwaCompanionChatPanel with mocked orchestration bundles (plan 15 R14).
 *
 * Invariants:
 * - Does not mount full bundle hooks or network clients.
 *
 * Related:
 * - src/features/ewa/EwaCompanionChatPanel.tsx
 * - src/features/ewa/companionUx/useEwaCompanionChatPanelOrchestration.tsx
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EwaCompanionChatPanel } from '@/features/ewa/EwaCompanionChatPanel';
import type { EwaCompanionProfileOut } from '@/services/ewa/ewaCompanionProfileApi';

const { useEwaCompanionChatPanelOrchestration } = vi.hoisted(() => ({
	useEwaCompanionChatPanelOrchestration: vi.fn(),
}));

vi.mock(
	'@/features/ewa/companionUx/useEwaCompanionChatPanelOrchestration',
	() => ({
		useEwaCompanionChatPanelOrchestration,
	})
);

vi.mock('@/features/ewa/companionUx/CompanionChatMainRow', () => ({
	CompanionChatMainRow: () => <div data-testid="companion-main-row" />,
}));

vi.mock('@/features/ewa/companionUx/CompanionChatPanelStack', () => ({
	CompanionChatPanelStack: () => <div data-testid="companion-panel-stack" />,
}));

vi.mock('react-i18next', async (importOriginal) => {
	const actual = await importOriginal<typeof import('react-i18next')>();
	return {
		...actual,
		useTranslation: () => ({
			t: (key: string) => key,
			i18n: { language: 'en' },
		}),
	};
});

function profileFixture(): EwaCompanionProfileOut {
	return {
		principal_id: 'principal-render',
		schema_version: '1',
		seed_persona_id: 'ewa',
		baseline: {},
		learned_preferences: {},
		style_parameters: {},
		memory_display: [],
		character_state: {
			seed_persona_id: 'ewa',
			mood: { valence: 0, energy: 0, tension: 0, confidence: 0 },
			bond: { trust: 0, familiarity: 0, repair_need: 0 },
			interaction_style: {
				answer_length: 0,
				initiative: 0,
				reassurance: 0,
			},
		},
		companion_revision: 1,
		updated_at: null,
		voice_enabled: false,
		reactive_chrome_enabled: true,
	};
}

describe('EwaCompanionChatPanel render smoke', () => {
	it('renders panel root and mocked main row from orchestration glue', () => {
		useEwaCompanionChatPanelOrchestration.mockReturnValue({
			mobileEmbeddedLayout: false,
			mobileEmbeddedLandscape: false,
			arlikaPresence: false,
			isDesktopWindowActive: true,
			paletteStyle: undefined,
			presenceHeaderProps: {},
			compactPresenceProps: {},
			leftRailClusterProps: {},
			hideMobileEmbeddedMetaRail: false,
			hideMemoryStrip: false,
			operationsRailProps: {},
			transcriptColumnProps: {},
			outputSurfaceProps: {},
			composerSectionProps: {},
			documentEditorSurfaceActive: false,
			desktopRightRailVisible: true,
			attachDocumentSurfaceActionsHost: vi.fn(),
			chatPanelStackProps: {},
			composerVisible: true,
			mobileActiveOperationCount: 0,
			awaitingConfirmationCount: 0,
			setMobileOperationsOpen: vi.fn(),
		});

		render(
			<EwaCompanionChatPanel
				profile={profileFixture()}
				reloadProfile={vi.fn()}
				onProfileResetRequired={vi.fn()}
				onCompanionRevision={vi.fn()}
				refreshDesktopConfigFromServer={vi.fn()}
			/>
		);

		expect(screen.getByTestId('ewa-companion-chat-root')).toBeInTheDocument();
		expect(screen.getByTestId('companion-main-row')).toBeInTheDocument();
		expect(screen.getByTestId('companion-panel-stack')).toBeInTheDocument();
		expect(useEwaCompanionChatPanelOrchestration).toHaveBeenCalledWith(
			expect.objectContaining({
				profile: expect.objectContaining({
					principal_id: 'principal-render',
				}),
			})
		);
	});

	it('wires embeddedMobile into orchestration when composer hidden', () => {
		useEwaCompanionChatPanelOrchestration.mockReturnValue({
			mobileEmbeddedLayout: true,
			mobileEmbeddedLandscape: false,
			arlikaPresence: false,
			isDesktopWindowActive: true,
			paletteStyle: undefined,
			presenceHeaderProps: {},
			compactPresenceProps: {},
			leftRailClusterProps: {},
			hideMobileEmbeddedMetaRail: true,
			hideMemoryStrip: false,
			operationsRailProps: {},
			transcriptColumnProps: {},
			outputSurfaceProps: { mode: 'my_phrases' },
			composerSectionProps: {},
			documentEditorSurfaceActive: false,
			desktopRightRailVisible: false,
			attachDocumentSurfaceActionsHost: vi.fn(),
			chatPanelStackProps: {},
			composerVisible: false,
			mobileActiveOperationCount: 2,
			awaitingConfirmationCount: 1,
			setMobileOperationsOpen: vi.fn(),
		});

		render(
			<EwaCompanionChatPanel
				profile={profileFixture()}
				reloadProfile={vi.fn()}
				onProfileResetRequired={vi.fn()}
				onCompanionRevision={vi.fn()}
				refreshDesktopConfigFromServer={vi.fn()}
				embeddedMobile
			/>
		);

		expect(useEwaCompanionChatPanelOrchestration).toHaveBeenCalledWith(
			expect.objectContaining({ embeddedMobile: true })
		);
	});
});
