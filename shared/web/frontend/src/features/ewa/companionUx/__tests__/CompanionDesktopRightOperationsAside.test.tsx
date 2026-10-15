/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for CompanionDesktopRightOperationsAside (U8.3 slice 22).
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CompanionDesktopRightOperationsAside } from '@/features/ewa/companionUx/CompanionDesktopRightOperationsAside';

vi.mock('@/features/ewa/companionUx/CompanionChatOperationsRail', () => ({
	CompanionChatOperationsRail: () => <div data-testid="operations-rail" />,
}));

const baseOperationsRailProps = {
	principalId: 'parent',
	companionDisplayName: 'EWA',
	ru: false,
	reducedMotion: false,
	operationRuns: [],
	operationsExpanded: false,
	onToggleOperationsExpanded: vi.fn(),
	operationsRefreshing: false,
	onRefreshOperations: vi.fn(),
	confirmBusyRunId: null,
	cancelBusyRunId: null,
	onConfirmRun: vi.fn(),
	onCancelRun: vi.fn(),
	onDispatchActions: vi.fn(),
	updateDraft: vi.fn(),
	inputRef: { current: null },
	onDownloadImage: vi.fn(),
	onShareImageToGaf: vi.fn(),
	onSendImageToCompanion: vi.fn(),
	highlightedRunId: null,
	onRetryPrompt: vi.fn(),
	liveActiveRunIds: new Set<string>(),
	onFocusRun: vi.fn(),
	operationsDisplayLimit: 8,
	canLoadMoreHistory: false,
	onLoadMoreHistory: vi.fn(),
	loadMoreHistoryBusy: false,
};

describe('CompanionDesktopRightOperationsAside', () => {
	it('renders operations rail and doc-editor host when enabled', () => {
		render(
			<CompanionDesktopRightOperationsAside
				operationsRailProps={baseOperationsRailProps}
				showDocumentEditorActions={true}
				attachDocumentSurfaceActionsHost={vi.fn()}
			/>
		);
		expect(screen.getByTestId('operations-rail')).toBeInTheDocument();
		expect(
			screen.getByTestId('ewa-companion-doc-editor-actions-rail')
		).toBeInTheDocument();
	});

	it('omits doc-editor host when disabled', () => {
		render(
			<CompanionDesktopRightOperationsAside
				operationsRailProps={baseOperationsRailProps}
				showDocumentEditorActions={false}
				attachDocumentSurfaceActionsHost={vi.fn()}
			/>
		);
		expect(screen.getByTestId('operations-rail')).toBeInTheDocument();
		expect(
			screen.queryByTestId('ewa-companion-doc-editor-actions-rail')
		).not.toBeInTheDocument();
	});
});
