/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for CompanionChatPanelRoot and CompanionChatPanelStack (U8.3 slice 25).
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EWA_DESKTOP_GUIDE_ROOT_ID } from '@/features/ewa/ewaDesktopGuideConstants';
import { CompanionChatPanelRoot } from '@/features/ewa/companionUx/CompanionChatPanelRoot';
import { CompanionChatPanelStack } from '@/features/ewa/companionUx/CompanionChatPanelStack';

vi.mock('@/features/ewa/companionUx/CompanionToolsInstrumentsOverlay', () => ({
	CompanionToolsInstrumentsOverlay: () => (
		<div data-testid="tools-instruments-overlay" />
	),
}));

vi.mock('@/features/ewa/companionUx/CompanionChatMobileSheets', () => ({
	CompanionChatMobileSheets: () => <div data-testid="mobile-sheets" />,
}));

vi.mock('@/features/ewa/companionUx/CompanionChatPanelOverlays', () => ({
	CompanionChatPanelOverlays: () => <div data-testid="panel-overlays" />,
}));

describe('CompanionChatPanelRoot', () => {
	it('renders guide root id and children', () => {
		render(
			<CompanionChatPanelRoot
				mobileEmbeddedLayout={false}
				mobileEmbeddedLandscape={false}
				arlikaPresence={false}
				isDesktopWindowActive={true}
				paletteStyle={undefined}
			>
				<div data-testid="panel-child" />
			</CompanionChatPanelRoot>
		);
		expect(document.getElementById(EWA_DESKTOP_GUIDE_ROOT_ID)).toBeTruthy();
		expect(screen.getByTestId('ewa-companion-chat-root')).toBeInTheDocument();
		expect(screen.getByTestId('panel-child')).toBeInTheDocument();
	});
});

describe('CompanionChatPanelStack', () => {
	it('renders overlay stack children', () => {
		render(
			<CompanionChatPanelStack
				toolsInstrumentsProps={{
					mobileEmbeddedComposerLayout: false,
					showDesktopCatalogBackdrop: false,
					catalogProps: {} as never,
					composerRef: { current: null },
					ocrDialogProps: {} as never,
				}}
				mobileSheetsProps={{
					showMemorySheet: false,
					operationsSheetProps: {} as never,
					memorySheetProps: { open: false, onClose: vi.fn(), rows: [] },
				}}
				panelOverlaysProps={{
					dialogClusterProps: {} as never,
					transformVideoProps: {} as never,
					guideModalProps: { open: false, onClose: vi.fn() },
				}}
			/>
		);
		expect(screen.getByTestId('tools-instruments-overlay')).toBeInTheDocument();
		expect(screen.getByTestId('mobile-sheets')).toBeInTheDocument();
		expect(screen.getByTestId('panel-overlays')).toBeInTheDocument();
	});
});
