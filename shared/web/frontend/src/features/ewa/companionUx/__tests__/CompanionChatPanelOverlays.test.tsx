/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for CompanionChatPanelOverlays (U8.3 slice 20).
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionChatPanelOverlays } from '@/features/ewa/companionUx/CompanionChatPanelOverlays';

vi.mock('@/features/ewa/companionUx/CompanionChatDialogCluster', () => ({
	CompanionChatDialogCluster: () => <div data-testid="chat-dialog-cluster" />,
}));

vi.mock('@/features/ewa/companionUx/CompanionTransformVideoPortal', () => ({
	CompanionTransformVideoPortal: ({ open }: { open: boolean }) =>
		open ? <div data-testid="transform-video-portal" /> : null,
}));

vi.mock('@/features/ewa/EwaDesktopGuideModal', () => ({
	EwaDesktopGuideModal: ({ open }: { open: boolean }) =>
		open ? <div data-testid="ewa-guide-modal" /> : null,
}));

const baseDialogClusterProps = {
	quickPresetLabelDialog: null,
	quickPresetLabelInputRef: { current: null },
	onQuickPresetLabelValueChange: vi.fn(),
	onCloseQuickPresetLabelDialog: vi.fn(),
	onQuickPresetLabelConfirm: vi.fn(),
	quickPresetDeleteTarget: null,
	onCancelQuickPresetDelete: vi.fn(),
	onConfirmQuickPresetDelete: vi.fn(),
	memoryForgetTarget: null,
	onCancelMemoryForget: vi.fn(),
	onConfirmMemoryForget: vi.fn(),
};

const baseTransformVideoProps = {
	open: false,
	failed: false,
	loading: false,
	src: '',
	retry: 0,
	needsControls: false,
	videoRef: { current: null },
	onClose: vi.fn(),
	onReady: vi.fn(),
	onError: vi.fn(),
};

const baseGuideModalProps = {
	open: false,
	onClose: vi.fn(),
};

describe('CompanionChatPanelOverlays', () => {
	it('always mounts dialog cluster; portals when open', () => {
		render(
			<CompanionChatPanelOverlays
				dialogClusterProps={baseDialogClusterProps}
				transformVideoProps={{ ...baseTransformVideoProps, open: true }}
				guideModalProps={{ ...baseGuideModalProps, open: true }}
			/>
		);
		expect(screen.getByTestId('chat-dialog-cluster')).toBeInTheDocument();
		expect(screen.getByTestId('transform-video-portal')).toBeInTheDocument();
		expect(screen.getByTestId('ewa-guide-modal')).toBeInTheDocument();
	});

	it('hides transform video and guide when closed', () => {
		render(
			<CompanionChatPanelOverlays
				dialogClusterProps={baseDialogClusterProps}
				transformVideoProps={baseTransformVideoProps}
				guideModalProps={baseGuideModalProps}
			/>
		);
		expect(screen.getByTestId('chat-dialog-cluster')).toBeInTheDocument();
		expect(
			screen.queryByTestId('transform-video-portal')
		).not.toBeInTheDocument();
		expect(screen.queryByTestId('ewa-guide-modal')).not.toBeInTheDocument();
	});
});
