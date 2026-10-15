/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest for CompanionLeftRailCluster (U8.3 slice 21).
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
	CompanionDesktopLeftRailAside,
	CompanionMobileMetaRail,
} from '@/features/ewa/companionUx/CompanionLeftRailCluster';

vi.mock('@/features/ewa/companionUx/CompanionAnticipationHintSection', () => ({
	CompanionAnticipationHintSection: () => (
		<div data-testid="anticipation-section" />
	),
}));

vi.mock(
	'@/features/ewa/companionUx/CompanionLeftRailServerActionsSection',
	() => ({
		CompanionLeftRailServerActionsSection: () => (
			<div data-testid="server-actions-section" />
		),
	})
);

vi.mock('@/features/ewa/companionUx/CompanionProtocolStrips', () => ({
	CompanionProtocolStrips: () => <div data-testid="protocol-strips" />,
}));

vi.mock('@/features/ewa/companionUx/CompanionTurnPlanStrip', () => ({
	CompanionTurnPlanStrip: () => <div data-testid="turn-plan-strip" />,
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, fallback?: string) =>
			typeof fallback === 'string' ? fallback : key,
		i18n: { language: 'en' },
	}),
}));

vi.mock('@/features/ewa/companionUx/CompanionLeftRailMemorySection', () => ({
	CompanionLeftRailMemorySection: () => <div data-testid="memory-section" />,
}));

vi.mock('@/features/ewa/companionUx/CompanionLeftRailPlanSection', () => ({
	CompanionLeftRailPlanSection: () => <div data-testid="plan-section" />,
}));

vi.mock('@/features/ewa/companionUx/CompanionChatOperationsRail', () => ({
	CompanionChatOperationsRail: ({
		secondaryRailMode,
	}: {
		secondaryRailMode?: boolean;
	}) => (
		<div
			data-testid="operations-rail"
			data-secondary-rail-mode={secondaryRailMode ? 'yes' : 'no'}
		/>
	),
}));

vi.mock('@/features/ewa/companionUx/CompanionPresenceCompactBar', () => ({
	CompanionPresenceCompactBar: () => <div data-testid="presence-compact-bar" />,
}));

vi.mock(
	'@/features/ewa/companionUx/CompanionLeftRailComposerToolsSection',
	() => ({
		CompanionLeftRailComposerToolsSection: () => (
			<div data-testid="composer-tools-section" />
		),
	})
);

const baseCompactPresenceProps = {
	personaId: 'parent',
	presence: 'online' as const,
	bond: 0,
	streamPhase: 'idle' as const,
	displayName: 'EWA',
	presenceChipLabel: 'Online',
	roleLine: 'companion',
	canToggleArlikaV2Sigil: false,
	arlikaV2SigilLabel: '',
	arlikaV2ModeSwitching: false,
	pending: false,
	onArlikaV2SigilToggle: vi.fn(),
};

const baseClusterProps = {
	anticipationProps: {
		hint: null,
		onSuggestedPrompt: vi.fn(),
		onDismiss: vi.fn(),
	},
	serverActionsProps: {
		actions: [],
		labels: {
			musicStudioOpen: '',
			appOpen: '',
			themeSet: '',
			docCreate: '',
			docInsert: '',
			fileRename: '',
			fileDelete: '',
			planCreate: '',
			planTaskComplete: '',
			operationsStatus: '',
			operationCancel: '',
			generic: (tool: string) => tool,
			statusOk: '',
			statusNeedsConfirm: '',
		},
		leftRailExpanded: null,
		onToggleSection: vi.fn(),
		reducedMotion: false,
	},
	protocolStripsProps: {
		toolTrace: [],
		protocolReports: [],
		orchestrationOutcome: null,
		proactiveSuggestion: null,
		principalId: 'parent',
		onQuickReply: vi.fn(),
		onDismissProactive: vi.fn(),
	},
	turnPlanProps: {
		turnPlanVisual: null,
		pending: false,
		onContinue: vi.fn(),
	},
	planSectionProps: {
		visible: false,
		activePlanBundle: null,
		leftRailExpanded: null,
		onToggleSection: vi.fn(),
		planFsmStatus: 'wait' as const,
		planDisplayProgress: 0,
		planRefreshing: false,
		onRefreshPlan: vi.fn(),
		planGoalsSorted: [],
		planTaskPartition: { open: [], done: [] },
		completingPlanTaskId: null,
		pending: false,
		onCompleteTask: vi.fn(),
		archivingPlan: false,
		onArchivePlan: vi.fn(),
		reducedMotion: false,
	},
	memorySectionProps: {
		hideMemoryStrip: false,
		memoryStripCount: 0,
		memoryStripRows: [],
		memoryRevision: 0,
		leftRailExpanded: null,
		onToggleSection: vi.fn(),
	},
};

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

const baseComposerToolsProps = {
	pending: false,
	useWebSearch: false,
	webSearchLabel: 'Web',
	webSearchTitle: 'Web search',
	onWebSearchChange: vi.fn(),
	onAttachImage: vi.fn(),
	onOpenToolsCatalog: vi.fn(),
	toolsCatalogCount: 3,
	onOpenMyPhrases: vi.fn(),
	onOpenWorkflowChains: vi.fn(),
	onCreateWorkflowChain: vi.fn(),
};

describe('CompanionLeftRailCluster', () => {
	it('renders desktop aside with compact presence and composer tools; activity collapsed by default', () => {
		render(
			<CompanionDesktopLeftRailAside
				{...baseClusterProps}
				compactPresenceProps={baseCompactPresenceProps}
				composerToolsProps={baseComposerToolsProps}
			/>
		);
		expect(screen.getByTestId('presence-compact-bar')).toBeInTheDocument();
		expect(
			screen.getByTestId('ewa-companion-left-rail-activity')
		).toBeInTheDocument();
		expect(screen.queryByTestId('protocol-strips')).not.toBeInTheDocument();
		expect(screen.queryByTestId('turn-plan-strip')).not.toBeInTheDocument();
		expect(screen.getByTestId('memory-section')).toBeInTheDocument();
		expect(screen.getByTestId('composer-tools-section')).toBeInTheDocument();
		expect(screen.queryByTestId('operations-rail')).not.toBeInTheDocument();
		expect(screen.getByTestId('ewa-companion-left-rail-stack')).toHaveClass(
			'*:shrink-0'
		);
	});

	it('expands activity disclosure to show protocol strips and turn plan', async () => {
		const { default: userEvent } = await import('@testing-library/user-event');
		const user = userEvent.setup();
		render(
			<CompanionDesktopLeftRailAside
				{...baseClusterProps}
				compactPresenceProps={baseCompactPresenceProps}
				composerToolsProps={baseComposerToolsProps}
			/>
		);
		await user.click(
			screen.getByTestId('ewa-companion-left-rail-activity-toggle')
		);
		expect(screen.getByTestId('protocol-strips')).toBeInTheDocument();
		expect(screen.getByTestId('turn-plan-strip')).toBeInTheDocument();
	});

	it('renders mobile meta rail with operations rail', () => {
		render(
			<CompanionMobileMetaRail
				{...baseClusterProps}
				hideMemoryStrip={false}
				operationsRailProps={baseOperationsRailProps}
			/>
		);
		expect(screen.queryByTestId('protocol-strips')).not.toBeInTheDocument();
		expect(screen.getByTestId('turn-plan-strip')).toBeInTheDocument();
		expect(screen.getByTestId('operations-rail')).toBeInTheDocument();
		expect(screen.getByTestId('operations-rail')).toHaveAttribute(
			'data-secondary-rail-mode',
			'yes'
		);
	});
});
