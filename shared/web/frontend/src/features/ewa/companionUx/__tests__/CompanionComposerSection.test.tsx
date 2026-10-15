/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for CompanionComposerSection (U8.3 slice 18).
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionComposerSection } from '@/features/ewa/companionUx/CompanionComposerSection';

vi.mock('@/features/ewa/companionUx/CompanionActionsTray', () => ({
	CompanionActionsTray: () => <div data-testid="actions-tray" />,
}));

vi.mock('@/features/ewa/companionUx/CompanionComposerShell', () => ({
	CompanionComposerShell: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="ewa-companion-composer">{children}</div>
	),
}));

vi.mock('@/features/ewa/companionUx/CompanionMobileComposerBody', () => ({
	CompanionMobileComposerBody: () => <div data-testid="mobile-composer-body" />,
}));

vi.mock('@/features/ewa/companionUx/CompanionDesktopComposerBody', () => ({
	CompanionDesktopComposerBody: () => (
		<div data-testid="desktop-composer-body" />
	),
}));

const baseShellProps = {
	composerRef: { current: null },
	imageInputRef: { current: null },
	mobileEmbeddedLayout: false,
	mobileEmbeddedLandscape: false,
	pendingImage: null,
	pending: false,
	onClearPendingImage: vi.fn(),
	onImageFileChange: vi.fn(),
};

describe('CompanionComposerSection', () => {
	it('renders desktop body when composer is visible', () => {
		render(
			<CompanionComposerSection
				composerVisible={true}
				mobileEmbeddedLandscape={false}
				mobileEmbeddedComposerLayout={false}
				actionsTrayProps={{
					records: [],
					expanded: false,
					onToggleExpanded: vi.fn(),
					onUndo: vi.fn(),
					onFocusRun: vi.fn(),
				}}
				shellProps={baseShellProps}
				mobileBodyProps={{
					toolbarProps: {} as never,
					draftStackProps: {} as never,
					quickPresetsStripProps: {} as never,
				}}
				desktopBodyProps={{
					draftStackProps: {} as never,
					footerProps: {} as never,
				}}
			/>
		);
		expect(screen.getByTestId('actions-tray')).toBeInTheDocument();
		expect(screen.getByTestId('desktop-composer-body')).toBeInTheDocument();
	});

	it('renders nothing inside when composer is hidden', () => {
		render(
			<CompanionComposerSection
				composerVisible={false}
				mobileEmbeddedLandscape={false}
				mobileEmbeddedComposerLayout={false}
				actionsTrayProps={{
					records: [],
					expanded: false,
					onToggleExpanded: vi.fn(),
					onUndo: vi.fn(),
					onFocusRun: vi.fn(),
				}}
				shellProps={baseShellProps}
				mobileBodyProps={{
					toolbarProps: {} as never,
					draftStackProps: {} as never,
					quickPresetsStripProps: {} as never,
				}}
				desktopBodyProps={{
					draftStackProps: {} as never,
					footerProps: {} as never,
				}}
			/>
		);
		expect(screen.queryByTestId('actions-tray')).not.toBeInTheDocument();
		expect(
			screen.queryByTestId('ewa-companion-composer')
		).not.toBeInTheDocument();
	});
});
