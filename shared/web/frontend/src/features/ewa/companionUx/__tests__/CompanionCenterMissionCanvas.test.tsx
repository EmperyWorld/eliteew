/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest coverage for center-owned companion mission surfaces.
 *
 * Invariants:
 * - Poll degradation stays in the center mission surface; it must not collapse to generic empty chat.
 * - Collapse chrome is SLM-controlled; tests use a harness that supplies required props.
 *
 * Related:
 * - src/features/ewa/companionUx/CompanionCenterMissionCanvas.tsx
 * - src/pages/Desktop/shell/shellLifecycleManager.ts
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { useState, type ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
	isAgenticMissionActiveState,
	isOperationTruthfullyLive,
	type AgenticMissionDisplayState,
	type MissionSurfaceBundle,
} from '@/features/ewa/companionOperations/companionOperationsUi';
import {
	CompanionCenterDecisionCard,
	CompanionCenterMissionCanvas,
	CompanionCenterMissionUnavailable,
} from '@/features/ewa/companionUx/CompanionCenterMissionCanvas';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'en' },
	}),
}));

vi.mock('@/features/ewa/agentic/agenticTraceApi', () => ({
	fetchAgenticSessionTree: vi.fn(async () => ({
		session_id: 'sess-1',
		nodes: [],
	})),
	fetchAgenticSessionTrace: vi.fn(async () => ({
		session_id: 'sess-1',
		checkpoints: [],
	})),
}));

type CanvasProps = ComponentProps<typeof CompanionCenterMissionCanvas>;

/** Supplies required SLM collapse props; mirrors default terminal→collapsed / live→expanded. */
function MissionCanvasUnderTest(
	props: Omit<
		CanvasProps,
		'missionChromeCollapsed' | 'onSetMissionChromeCollapsed'
	> & {
		missionChromeCollapsed?: boolean;
		onSetMissionChromeCollapsed?: (collapsed: boolean) => void;
	}
) {
	const active =
		isAgenticMissionActiveState(
			props.mission.displayState as AgenticMissionDisplayState
		) || isOperationTruthfullyLive(props.mission.displayState);
	const [collapsed, setCollapsed] = useState(
		props.missionChromeCollapsed ?? !active
	);
	return (
		<CompanionCenterMissionCanvas
			{...props}
			missionChromeCollapsed={collapsed}
			onSetMissionChromeCollapsed={(next) => {
				props.onSetMissionChromeCollapsed?.(next);
				setCollapsed(next);
			}}
		/>
	);
}

describe('CompanionCenterMissionCanvas', () => {
	function expandCompletedMission() {
		fireEvent.click(
			screen.getByRole('button', {
				name: 'ewaCompanion.centerMissionExpand',
			})
		);
	}

	it('starts collapsed for completed missions and expands on demand', () => {
		const mission: MissionSurfaceBundle = {
			runId: 'run-1',
			title: 'сделай миссию',
			subtitle: 'Completed',
			answerSummary: 'Полный ответ миссии для пользователя.',
			primaryResult: 'Главный результат миссии',
			recommendedNextAction: 'Откройте результат',
			responsibility: 'center',
			displayState: 'completed',
			documents: [],
			progress: null,
			workflowSummary: null,
			run: {
				id: 'run-1',
				principal_id: 'p1',
				status: 'completed',
				intent_kind: 'agentic_session',
				user_message: 'сделай миссию',
				plan_payload: {
					kind: 'agentic_session_v1',
					agentic_session_id: 'sess-1',
					session_status: 'completed',
					mission_display_state: 'completed',
					plan_summary: '1. Разведка; 2. План',
				},
				confirmation_state: {},
				result_payload: {},
				error_payload: {},
				execution_mode: 'async',
				run_revision: 1,
				created_at: null,
				updated_at: null,
				completed_at: null,
			},
		};
		const onDismiss = vi.fn();

		render(
			<MissionCanvasUnderTest
				mission={mission}
				onDispatchActions={vi.fn()}
				onPlayTrack={vi.fn()}
				onDraftPlayPrompt={vi.fn()}
				onOpenPresentationInEwrp={vi.fn()}
				onDismissMission={onDismiss}
			/>
		);

		expect(
			screen.getByTestId('ewa-center-mission-collapsed')
		).toBeInTheDocument();
		expect(
			screen.queryByText('ewaCompanion.centerMissionAnswerEyebrow')
		).not.toBeInTheDocument();

		expandCompletedMission();

		expect(
			screen.getByText('ewaCompanion.centerMissionAnswerEyebrow')
		).toBeInTheDocument();
		expect(screen.getByText('сделай миссию')).toBeInTheDocument();
		expect(screen.getByText('Главный результат миссии')).toBeInTheDocument();
		expect(
			screen.getByText('Полный ответ миссии для пользователя.')
		).toBeInTheDocument();
		expect(screen.getByText('Откройте результат')).toBeInTheDocument();

		fireEvent.click(
			screen.getByRole('button', {
				name: 'ewaCompanion.centerMissionOpenDetail',
			})
		);
		expect(
			screen.getByText('ewaCompanion.centerMissionPlanEyebrow')
		).toBeInTheDocument();
		expect(screen.getByText('1. Разведка; 2. План')).toBeInTheDocument();
		expect(
			screen.getByRole('button', {
				name: 'ewaCompanion.centerMissionOpenTechnicalTrace',
			})
		).toBeInTheDocument();

		fireEvent.click(
			screen.getByRole('button', {
				name: 'ewaCompanion.centerMissionDismissAria',
			})
		);
		expect(onDismiss).toHaveBeenCalledWith('run-1');
	});

	it('opens execution details without crashing the center mission canvas', async () => {
		const mission: MissionSurfaceBundle = {
			runId: 'run-1',
			title: 'сделай миссию',
			subtitle: 'Completed',
			answerSummary: 'Ответ',
			primaryResult: 'Результат',
			recommendedNextAction: '',
			responsibility: 'center',
			displayState: 'completed',
			documents: [],
			progress: null,
			workflowSummary: null,
			run: {
				id: 'run-1',
				principal_id: 'p1',
				status: 'completed',
				intent_kind: 'agentic_session',
				user_message: 'сделай миссию',
				plan_payload: {
					kind: 'agentic_session_v1',
					agentic_session_id: 'sess-1',
					session_status: 'completed',
					mission_display_state: 'completed',
					plan_summary: 'plan',
				},
				confirmation_state: {},
				result_payload: {},
				error_payload: {},
				execution_mode: 'async',
				run_revision: 1,
				created_at: null,
				updated_at: null,
				completed_at: null,
			},
		};

		render(
			<MissionCanvasUnderTest
				mission={mission}
				onDispatchActions={vi.fn()}
				onPlayTrack={vi.fn()}
				onDraftPlayPrompt={vi.fn()}
				onOpenPresentationInEwrp={vi.fn()}
			/>
		);

		expandCompletedMission();
		fireEvent.click(
			screen.getByRole('button', {
				name: 'ewaCompanion.centerMissionOpenDetail',
			})
		);
		fireEvent.click(
			screen.getByRole('button', {
				name: 'ewaCompanion.centerMissionOpenTechnicalTrace',
			})
		);

		expect(
			await screen.findByTestId('ewa-agentic-observability')
		).toBeInTheDocument();
	});

	it('mounts live execution column for active agentic without opt-in click', async () => {
		const mission: MissionSurfaceBundle = {
			runId: 'run-live',
			title: 'active mission',
			subtitle: 'running',
			answerSummary: '',
			primaryResult: 'In progress',
			recommendedNextAction: '',
			responsibility: 'center',
			displayState: 'running',
			documents: [],
			progress: null,
			workflowSummary: null,
			run: {
				id: 'run-live',
				principal_id: 'p1',
				status: 'running',
				intent_kind: 'agentic_session',
				user_message: 'active mission',
				plan_payload: {
					kind: 'agentic_session_v1',
					agentic_session_id: 'sess-live',
					session_status: 'executing',
					mission_display_state: 'running',
					plan_summary: '1. Research',
				},
				confirmation_state: {},
				result_payload: {},
				error_payload: {},
				execution_mode: 'async',
				run_revision: 2,
				created_at: null,
				updated_at: '2026-08-16T00:00:00Z',
				completed_at: null,
			},
		};

		render(
			<MissionCanvasUnderTest
				mission={mission}
				onDispatchActions={vi.fn()}
				onPlayTrack={vi.fn()}
				onDraftPlayPrompt={vi.fn()}
				onOpenPresentationInEwrp={vi.fn()}
				supportingTranscript={<p>Old chat bubble</p>}
			/>
		);

		expect(
			screen.getByTestId('ewa-center-mission-execution')
		).toBeInTheDocument();
		expect(
			screen.queryByRole('button', {
				name: 'ewaCompanion.centerMissionOpenDetail',
			})
		).not.toBeInTheDocument();
		const earlier = screen.getByTestId('ewa-center-mission-earlier-chat');
		expect(earlier).not.toHaveAttribute('open');
		expect(
			screen.getByText('ewaCompanion.centerMissionEarlierChatEyebrow')
		).toBeInTheDocument();
		expect(
			await screen.findByTestId('ewa-agentic-observability')
		).toBeInTheDocument();
	});

	it('keeps supporting transcript visible while mission chrome is collapsed', () => {
		const mission: MissionSurfaceBundle = {
			runId: 'run-1',
			title: 'сделай миссию',
			subtitle: 'Completed',
			answerSummary: '',
			primaryResult: 'Результат',
			recommendedNextAction: '',
			responsibility: 'center',
			displayState: 'completed',
			documents: [],
			progress: null,
			workflowSummary: null,
			run: {
				id: 'run-1',
				principal_id: 'p1',
				status: 'completed',
				intent_kind: 'agentic_session',
				user_message: 'сделай миссию',
				plan_payload: {
					kind: 'agentic_session_v1',
					agentic_session_id: 'sess-1',
					session_status: 'completed',
					mission_display_state: 'completed',
				},
				confirmation_state: {},
				result_payload: {},
				error_payload: {},
				execution_mode: 'async',
				run_revision: 1,
				created_at: null,
				updated_at: null,
				completed_at: null,
			},
		};

		render(
			<MissionCanvasUnderTest
				mission={mission}
				onDispatchActions={vi.fn()}
				onPlayTrack={vi.fn()}
				onDraftPlayPrompt={vi.fn()}
				onOpenPresentationInEwrp={vi.fn()}
				supportingTranscript={<p>Hello from Kora</p>}
			/>
		);

		expect(
			screen.getByTestId('ewa-center-mission-collapsed')
		).toBeInTheDocument();
		expect(screen.getByText('Hello from Kora')).toBeInTheDocument();
		expect(
			screen.getByTestId('ewa-center-mission-transcript')
		).toBeInTheDocument();
	});

	it('renders durable mission answer before operational details', () => {
		const mission: MissionSurfaceBundle = {
			runId: 'run-1',
			title: 'сделай миссию',
			subtitle: 'Completed',
			answerSummary: 'Полный ответ миссии для пользователя.',
			primaryResult: 'Главный результат миссии',
			recommendedNextAction: 'Откройте результат',
			responsibility: 'center',
			displayState: 'completed',
			documents: [],
			progress: null,
			workflowSummary: null,
			run: {
				id: 'run-1',
				principal_id: 'p1',
				status: 'completed',
				intent_kind: 'agentic_session',
				user_message: 'сделай миссию',
				plan_payload: {
					kind: 'agentic_session_v1',
					agentic_session_id: 'sess-1',
					session_status: 'completed',
					mission_display_state: 'completed',
				},
				confirmation_state: {},
				result_payload: {},
				error_payload: {},
				execution_mode: 'async',
				run_revision: 1,
				created_at: null,
				updated_at: null,
				completed_at: null,
			},
		};

		render(
			<MissionCanvasUnderTest
				mission={mission}
				onDispatchActions={vi.fn()}
				onPlayTrack={vi.fn()}
				onDraftPlayPrompt={vi.fn()}
				onOpenPresentationInEwrp={vi.fn()}
			/>
		);

		expandCompletedMission();

		expect(
			screen.getByText('ewaCompanion.centerMissionAnswerEyebrow')
		).toBeInTheDocument();
		expect(screen.getByText('сделай миссию')).toBeInTheDocument();
		expect(screen.getByText('Главный результат миссии')).toBeInTheDocument();
		expect(
			screen.getByText('Полный ответ миссии для пользователя.')
		).toBeInTheDocument();
		expect(screen.getByText('Откройте результат')).toBeInTheDocument();
		fireEvent.click(
			screen.getByRole('button', {
				name: 'ewaCompanion.centerMissionOpenDetail',
			})
		);
		expect(
			screen.getByRole('button', {
				name: 'ewaCompanion.centerMissionHideTechnicalTrace',
			})
		).toBeInTheDocument();
	});

	it('renders ready media action in the center canvas', () => {
		const onPlayTrack = vi.fn();
		const mission: MissionSurfaceBundle = {
			runId: 'run-track',
			title: 'Music mission',
			subtitle: 'Completed',
			answerSummary: 'Готов трек: Neon Dawn',
			primaryResult: 'Готов трек: Neon Dawn',
			recommendedNextAction: 'Откройте результат.',
			responsibility: 'center',
			displayState: 'completed',
			documents: [],
			progress: null,
			workflowSummary: null,
			readyTrack: {
				unifiedContentId: 'track-1',
				trackName: 'Neon Dawn',
				thumbnailUrl: null,
			},
			run: {
				id: 'run-track',
				principal_id: 'p1',
				status: 'completed',
				intent_kind: 'music_generation_background',
				user_message: 'make music',
				plan_payload: {},
				confirmation_state: {},
				result_payload: {
					unified_content_id: 'track-1',
					track_name: 'Neon Dawn',
				},
				error_payload: {},
				execution_mode: 'async',
				run_revision: 1,
				created_at: null,
				updated_at: null,
				completed_at: null,
			},
		};

		render(
			<MissionCanvasUnderTest
				mission={mission}
				onDispatchActions={vi.fn()}
				onPlayTrack={onPlayTrack}
				onDraftPlayPrompt={vi.fn()}
				onOpenPresentationInEwrp={vi.fn()}
			/>
		);

		expandCompletedMission();

		fireEvent.click(
			screen.getByRole('button', {
				name: 'ewaCompanion.centerMissionPlayTrack',
			})
		);

		expect(onPlayTrack).toHaveBeenCalledWith({
			type: 'music_play_track',
			unified_content_id: 'track-1',
			track_name: 'Neon Dawn',
		});
	});

	it('shows stale snapshot banner without replacing the mission answer', () => {
		const mission: MissionSurfaceBundle = {
			runId: 'run-1',
			title: 'mission context',
			subtitle: 'running',
			answerSummary: '',
			primaryResult: 'Last known result',
			recommendedNextAction: 'Wait for refresh',
			responsibility: 'center',
			displayState: 'running',
			documents: [],
			progress: null,
			workflowSummary: null,
			run: {
				id: 'run-1',
				principal_id: 'p1',
				status: 'running',
				intent_kind: 'agentic_session',
				user_message: 'mission context',
				plan_payload: {
					kind: 'agentic_session_v1',
					agentic_session_id: 'sess-1',
					session_status: 'executing',
					mission_display_state: 'running',
				},
				confirmation_state: {},
				result_payload: {},
				error_payload: {},
				execution_mode: 'async',
				run_revision: 1,
				created_at: null,
				updated_at: null,
				completed_at: null,
			},
		};

		render(
			<MissionCanvasUnderTest
				mission={mission}
				degradedKind="stale"
				degradedMessage="snapshot stale"
				onRefreshMissionStatus={vi.fn()}
				onDispatchActions={vi.fn()}
				onPlayTrack={vi.fn()}
				onDraftPlayPrompt={vi.fn()}
				onOpenPresentationInEwrp={vi.fn()}
			/>
		);

		expect(screen.getByText('snapshot stale')).toBeInTheDocument();
		expect(screen.getByText('Last known result')).toBeInTheDocument();
	});

	it('shows auth/backend degraded banner over an existing mission', () => {
		const mission: MissionSurfaceBundle = {
			runId: 'run-1',
			title: 'mission context',
			subtitle: 'running',
			answerSummary: '',
			primaryResult: 'Last known result',
			recommendedNextAction: 'Wait for refresh',
			responsibility: 'center',
			displayState: 'running',
			documents: [],
			progress: null,
			workflowSummary: null,
			run: {
				id: 'run-1',
				principal_id: 'p1',
				status: 'running',
				intent_kind: 'agentic_session',
				user_message: 'mission context',
				plan_payload: {},
				confirmation_state: {},
				result_payload: {},
				error_payload: {},
				execution_mode: 'async',
				run_revision: 1,
				created_at: null,
				updated_at: null,
				completed_at: null,
			},
		};

		render(
			<MissionCanvasUnderTest
				mission={mission}
				degradedKind="backend"
				degradedMessage="backend down"
				onRefreshMissionStatus={vi.fn()}
				onDispatchActions={vi.fn()}
				onPlayTrack={vi.fn()}
				onDraftPlayPrompt={vi.fn()}
				onOpenPresentationInEwrp={vi.fn()}
			/>
		);

		expect(screen.getByText('backend down')).toBeInTheDocument();
		expect(screen.getByText('Last known result')).toBeInTheDocument();
	});

	it('renders confirm bar for primary non-agentic awaiting mission', () => {
		const onConfirmRun = vi.fn();
		const mission: MissionSurfaceBundle = {
			runId: 'run-confirm',
			title: 'Create document?',
			subtitle: 'Needs confirm',
			answerSummary: '',
			primaryResult: '',
			recommendedNextAction: '',
			responsibility: 'center',
			displayState: 'awaiting_confirmation',
			documents: [],
			progress: null,
			workflowSummary: null,
			run: {
				id: 'run-confirm',
				principal_id: 'p1',
				status: 'awaiting_confirmation',
				intent_kind: 'doc_create',
				user_message: 'Create document?',
				plan_payload: {},
				confirmation_state: {},
				result_payload: {},
				error_payload: {},
				execution_mode: 'async',
				run_revision: 1,
				created_at: null,
				updated_at: null,
				completed_at: null,
			},
		};

		render(
			<MissionCanvasUnderTest
				mission={mission}
				onConfirmRun={onConfirmRun}
				onDispatchActions={vi.fn()}
				onPlayTrack={vi.fn()}
				onDraftPlayPrompt={vi.fn()}
				onOpenPresentationInEwrp={vi.fn()}
			/>
		);

		fireEvent.click(
			screen.getByRole('button', { name: 'ewaCompanion.operationCancel' })
		);
		expect(onConfirmRun).toHaveBeenCalledWith('run-confirm', 'cancel');
	});

	it('renders a center decision card for non-primary awaiting runs', () => {
		const onConfirmRun = vi.fn();
		render(
			<CompanionCenterDecisionCard
				run={{
					id: 'run-confirm',
					principal_id: 'p1',
					status: 'awaiting_confirmation',
					intent_kind: 'doc_create',
					user_message: 'Create document?',
					plan_payload: {},
					confirmation_state: {},
					result_payload: {},
					error_payload: {},
					execution_mode: 'async',
					run_revision: 1,
					created_at: null,
					updated_at: null,
					completed_at: null,
				}}
				onConfirmRun={onConfirmRun}
			/>
		);

		expect(
			screen.getByText('ewaCompanion.centerMissionDecisionEyebrow')
		).toBeInTheDocument();
		fireEvent.click(
			screen.getByRole('button', { name: 'ewaCompanion.operationConfirm' })
		);
		expect(onConfirmRun).toHaveBeenCalledWith('run-confirm', 'confirm');
	});

	it('keeps poll failures as a center mission degraded state', () => {
		const onRefresh = vi.fn();
		render(
			<CompanionCenterMissionUnavailable
				kind="backend"
				message="task-runs failed"
				onRefresh={onRefresh}
			/>
		);

		expect(
			screen.getByText('ewaCompanion.centerMissionDegradedEyebrow')
		).toBeInTheDocument();
		expect(screen.getByText('task-runs failed')).toBeInTheDocument();
		fireEvent.click(
			screen.getByRole('button', {
				name: 'ewaCompanion.centerMissionRefresh',
			})
		);
		expect(onRefresh).toHaveBeenCalledOnce();
	});

	it('uses auth-specific degraded copy and refresh action', () => {
		render(
			<CompanionCenterMissionUnavailable kind="auth" onRefresh={vi.fn()} />
		);

		expect(
			screen.getByText('ewaCompanion.centerMissionAuthTitle')
		).toBeInTheDocument();
		expect(
			screen.getByRole('button', {
				name: 'ewaCompanion.centerMissionRefreshSession',
			})
		).toBeInTheDocument();
	});
});
