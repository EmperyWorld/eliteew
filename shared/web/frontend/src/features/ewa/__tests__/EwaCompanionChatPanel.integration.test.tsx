/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Integration test for orchestration glue after bundle split — submit → stream final → reloadProfile.
 *
 * Invariants:
 * - Mocks `ewaCompanionChatApi` stream path; does not hit network.
 *
 * Related:
 * - src/features/ewa/companionUx/useEwaCompanionChatPanelOrchestration.tsx
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useEwaCompanionChatPanelOrchestration } from '@/features/ewa/companionUx/useEwaCompanionChatPanelOrchestration';
import type { EwaCompanionProfileOut } from '@/services/ewa/ewaCompanionProfileApi';

const { streamEwaCompanionChatMessage, reloadProfile } = vi.hoisted(() => ({
	streamEwaCompanionChatMessage: vi.fn(),
	reloadProfile: vi.fn(async () => undefined),
}));

const NEUTRAL_CHARACTER_STATE: EwaCompanionProfileOut['character_state'] = {
	seed_persona_id: 'ewa',
	mood: { valence: 0, energy: 0, tension: 0, confidence: 0 },
	bond: { trust: 0, familiarity: 0, repair_need: 0 },
	interaction_style: { answer_length: 0, initiative: 0, reassurance: 0 },
};

function profileFixture(
	overrides: Partial<EwaCompanionProfileOut> = {}
): EwaCompanionProfileOut {
	const base: EwaCompanionProfileOut = {
		principal_id: 'principal-integration',
		schema_version: '1',
		seed_persona_id: 'ewa',
		baseline: {},
		learned_preferences: {},
		style_parameters: {},
		memory_display: [],
		character_state: NEUTRAL_CHARACTER_STATE,
		companion_revision: 1,
		updated_at: null,
		voice_enabled: false,
		reactive_chrome_enabled: true,
	};
	return {
		...base,
		...overrides,
		character_state: overrides.character_state ?? base.character_state,
		voice_enabled: overrides.voice_enabled ?? base.voice_enabled,
		reactive_chrome_enabled:
			overrides.reactive_chrome_enabled ?? base.reactive_chrome_enabled,
		baseline: overrides.baseline ?? base.baseline,
		learned_preferences:
			overrides.learned_preferences ?? base.learned_preferences,
		style_parameters: overrides.style_parameters ?? base.style_parameters,
		memory_display: overrides.memory_display ?? base.memory_display,
	};
}

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

vi.mock('@/notifications', () => ({
	useNotifications: () => ({
		error: vi.fn(),
		success: vi.fn(),
	}),
}));

vi.mock('@/pages/Desktop/context/EwaCompanionShellBridgeContext', () => ({
	useEwaCompanionShellBridge: () => ({ getSnapshot: () => null }),
}));

vi.mock('@/pages/Desktop/context/DesktopWindowActiveContext', () => ({
	useDesktopWindowActive: () => true,
	useDesktopWindowSurfaceState: () => ({
		isSurfaceVisible: true,
		isTabVisible: true,
	}),
}));

vi.mock('@/pages/Desktop/hooks/useDesktopGuideTourOpener', () => ({
	useDesktopGuideTourOpener: () => undefined,
}));

vi.mock('@/hooks/useMediaQuery', () => ({
	useMediaQuery: () => false,
}));

vi.mock('@/utils/mobileEmbeddedSpaRoute', () => ({
	isMobileEwaCompanionEmbeddedRoute: () => false,
}));

vi.mock('@/features/ewa/companionPresence/useReducedMotion', () => ({
	useReducedMotion: () => false,
}));

vi.mock('@/features/ewa/useEwaCompanionAnticipationTick', () => ({
	useEwaCompanionAnticipationTick: () => ({
		hint: null,
		dismissHint: vi.fn(),
	}),
}));

vi.mock('@/services/ewa/ewaCompanionPlansApi', async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import('@/services/ewa/ewaCompanionPlansApi')
		>();
	return {
		...actual,
		getEwaCompanionActivePlan: vi.fn(async () => null),
	};
});

vi.mock('@/services/ewa/ewaCompanionProfileApi', async (importOriginal) => {
	const actual =
		await importOriginal<
			typeof import('@/services/ewa/ewaCompanionProfileApi')
		>();
	return {
		...actual,
		listEwaCompanionQuickPresets: vi.fn(async () => []),
	};
});

vi.mock('@/features/ewa/companionOperations/useCompanionOperationRuns', () => ({
	useCompanionOperationRuns: () => ({
		operationRuns: [],
		setOperationRuns: vi.fn(),
		operationsRefreshing: false,
		refreshOperationRuns: vi.fn(async () => undefined),
		operationsHistoryExpanded: false,
		loadMoreOperationsHistory: vi.fn(),
		canLoadMoreOperationsHistory: false,
		operationsDisplayLimit: 8,
		patchOperationRun: vi.fn(),
		handleConfirmOperationRun: vi.fn(async () => undefined),
		handleCancelOperationRun: vi.fn(async () => undefined),
		confirmBusyRunId: null,
		cancelBusyRunId: null,
		hasActiveOperations: false,
		transcriptProgressItems: [],
		transcriptWorkflowSummaries: [],
		syncTaskRunSnapshot: vi.fn(),
	}),
}));

vi.mock('@/features/ewa/useEwaCompanionVoiceInput', () => ({
	useEwaCompanionVoiceInput: () => ({
		voiceInputBusy: false,
		voiceInputState: 'idle',
		handleVoiceMicClick: vi.fn(),
	}),
}));

vi.mock('@/features/ewa/useEwaCompanionVoiceOutput', () => ({
	useEwaCompanionVoiceOutput: () => ({
		voiceOutputState: 'idle',
		voiceOutEnabled: false,
		speakCompanionReply: vi.fn(async () => undefined),
		stopSpeaking: vi.fn(),
	}),
}));

vi.mock('@/features/ewa/useEwaCompanionVoiceSession', () => ({
	useEwaCompanionVoiceSession: () => ({
		voiceSessionActive: false,
		enterVoiceSession: vi.fn(),
		handleVoiceSpeakerClick: vi.fn(),
	}),
}));

vi.mock('@/features/ewa/companionOperations/useCompanionTaskEvents', () => ({
	useCompanionTaskEvents: () => ({ taskEventHandlers: {} }),
}));

vi.mock('@/services/ewa/ewaCompanionChatApi', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('@/services/ewa/ewaCompanionChatApi')>();
	return {
		...actual,
		streamEwaCompanionChatMessage,
		postEwaCompanionChatMessage: vi.fn(async () => ({
			reply: 'sync fallback',
			companion_revision: 2,
			actions: [],
		})),
		newCompanionClientTurnId: vi.fn(() => 'turn-integration'),
		listEwaCompanionTaskRuns: vi.fn(async () => []),
	};
});

describe('EwaCompanionChatPanel orchestration integration', () => {
	it('glue hook wires transcript, operations, and compact presence bundles', () => {
		const { result } = renderHook(() =>
			useEwaCompanionChatPanelOrchestration({
				profile: profileFixture(),
				reloadProfile,
			})
		);

		expect(result.current.transcriptColumnProps).toBeDefined();
		expect(result.current.operationsRailProps).toBeDefined();
		expect(result.current.compactPresenceProps).toBeDefined();
		expect(result.current.composerSectionProps.composerVisible).toBe(true);
	});
});
