/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for CompanionToolsInstrumentsOverlay (U8.3 slice 19).
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionToolsInstrumentsOverlay } from '@/features/ewa/companionUx/CompanionToolsInstrumentsOverlay';

vi.mock('@/features/ewa/companionTools/CompanionToolsCatalogPanel', () => ({
	CompanionToolsCatalogBackdropLayer: () => (
		<div data-testid="tools-catalog-backdrop" />
	),
	CompanionToolsCatalogBackdrop: ({ open }: { open: boolean }) =>
		open ? <div data-testid="tools-catalog-backdrop" /> : null,
	CompanionToolsCatalogPanel: ({ variant }: { variant: string }) => (
		<div data-testid={`tools-catalog-${variant}`} />
	),
}));

vi.mock('@/features/ewa/companionTools/CompanionToolsCatalogPortal', () => ({
	CompanionToolsCatalogPortal: ({
		open,
		children,
	}: {
		open: boolean;
		children: React.ReactNode;
	}) =>
		open ? (
			<div data-testid="ewa-companion-tools-portal-root">{children}</div>
		) : null,
}));

vi.mock('@/features/ewa/companionTools/CompanionOcrSourceDialog', () => ({
	CompanionOcrSourceDialog: () => <div data-testid="ocr-source-dialog" />,
}));

const baseCatalogProps = {
	open: true,
	onClose: vi.fn(),
	principalId: 'parent',
	pinnedToolIds: [],
	recentToolIds: [],
	onPinnedChange: vi.fn(),
	onTryTool: vi.fn(),
	onInsertTool: vi.fn(),
};

describe('CompanionToolsInstrumentsOverlay', () => {
	it('renders anchored catalog on desktop layout', () => {
		render(
			<CompanionToolsInstrumentsOverlay
				mobileEmbeddedComposerLayout={false}
				showDesktopCatalogBackdrop={true}
				catalogProps={baseCatalogProps}
				composerRef={{ current: null }}
				ocrDialogProps={{
					open: false,
					busy: false,
					fileInputRef: { current: null },
					contentPickerOpen: false,
					onClose: vi.fn(),
					onPickLocal: vi.fn(),
					onPickContentManager: vi.fn(),
					onLocalFileSelected: vi.fn(),
					onContentPicked: vi.fn(),
					onContentPickerClose: vi.fn(),
				}}
			/>
		);
		expect(screen.getByTestId('tools-catalog-backdrop')).toBeInTheDocument();
		expect(screen.getByTestId('tools-catalog-anchored')).toBeInTheDocument();
		expect(screen.getByTestId('ocr-source-dialog')).toBeInTheDocument();
	});

	it('renders sheet catalog on mobile embedded layout', () => {
		render(
			<CompanionToolsInstrumentsOverlay
				mobileEmbeddedComposerLayout={true}
				showDesktopCatalogBackdrop={false}
				catalogProps={baseCatalogProps}
				composerRef={{ current: null }}
				ocrDialogProps={{
					open: false,
					busy: false,
					fileInputRef: { current: null },
					contentPickerOpen: false,
					onClose: vi.fn(),
					onPickLocal: vi.fn(),
					onPickContentManager: vi.fn(),
					onLocalFileSelected: vi.fn(),
					onContentPicked: vi.fn(),
					onContentPickerClose: vi.fn(),
				}}
			/>
		);
		expect(
			screen.queryByTestId('tools-catalog-backdrop')
		).not.toBeInTheDocument();
		expect(screen.getByTestId('tools-catalog-sheet')).toBeInTheDocument();
	});
});
