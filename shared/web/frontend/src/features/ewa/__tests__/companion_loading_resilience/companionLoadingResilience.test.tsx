/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * R-03 Phase 0 + regression lock: EWA companion loading must not hang forever on stalled API.
 *
 * Related:
 * - src/features/ewa/EwaDesktopApp.tsx
 * - src/features/ewa/ewaCompanionLoadStall.ts
 * - src/features/ewa/companionOutputSurface/CompanionWorkflowObservationSettings.tsx
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { EwaDesktopApp } from '@/features/ewa/EwaDesktopApp';
import { CompanionWorkflowObservationSettings } from '@/features/ewa/companionOutputSurface/CompanionWorkflowObservationSettings';
import {
	EWA_COMPANION_LOAD_STALL_MS,
	EwaCompanionLoadTimeoutError,
	withEwaCompanionLoadStall,
} from '@/features/ewa/ewaCompanionLoadStall';
import * as ewaCompanionLoadStall from '@/features/ewa/ewaCompanionLoadStall';
import { APIError } from '@/services/api/client';

const profileApiMock = vi.hoisted(() => ({
	getEwaCompanionProfile: vi.fn(),
}));

const observationPrefsMock = vi.hoisted(() => ({
	loadObservationTriggerPrefs: vi.fn(),
	saveObservationTriggerPrefs: vi.fn(),
}));

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'ru' },
	}),
}));

vi.mock('@/notifications', () => ({
	useNotifications: () => ({ info: vi.fn() }),
}));

vi.mock('@/pages/Desktop/context/DesktopAppPropsContext', () => ({
	useDesktopAppProps: () => ({
		refreshDesktopConfigFromServer: vi.fn(),
	}),
}));

vi.mock('@/features/ewa/ewaIcons/EwaIconSprites', () => ({
	EwaIconSprites: () => null,
}));

vi.mock('@/features/ewa/EwaCompanionChatPanel', () => ({
	EwaCompanionChatPanel: () => <div data-testid="mock-ewa-chat" />,
}));

vi.mock('@/features/ewa/EwaCompanionFirstMeet', () => ({
	EwaCompanionFirstMeet: () => <div data-testid="mock-first-meet" />,
}));

vi.mock('@/services/ewa/ewaCompanionProfileApi', () => ({
	getEwaCompanionProfile: profileApiMock.getEwaCompanionProfile,
	isCompanionProfileNotInitializedError: () => false,
}));

vi.mock('@/features/ewa/companionObservationTriggerPrefs', () => ({
	loadObservationTriggerPrefs: observationPrefsMock.loadObservationTriggerPrefs,
	saveObservationTriggerPrefs: observationPrefsMock.saveObservationTriggerPrefs,
	DEFAULT_COMPANION_OBSERVATION_TRIGGER_PREFS: {
		idleEnabled: true,
		focusAppEnabled: true,
	},
}));

const sampleProfile = {
	principal_id: 'p1',
	schema_version: '1',
	seed_persona_id: 'tala',
	baseline: {},
	learned_preferences: {},
	style_parameters: {},
	character_state: {},
	memory_display: [],
	companion_revision: 1,
	updated_at: null,
	voice_enabled: true,
};

describe('companion loading resilience (R-03)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useRealTimers();
		profileApiMock.getEwaCompanionProfile.mockResolvedValue(sampleProfile);
		observationPrefsMock.loadObservationTriggerPrefs.mockResolvedValue({
			idleEnabled: true,
			focusAppEnabled: true,
		});
		observationPrefsMock.saveObservationTriggerPrefs.mockImplementation(
			async (_pid: string, patch: Record<string, boolean>) => ({
				idleEnabled: patch.idleEnabled ?? true,
				focusAppEnabled: patch.focusAppEnabled ?? true,
			})
		);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('phase 0 — stall guard utility', () => {
		it('without stall guard a hanging promise never settles within the stall window', async () => {
			vi.useFakeTimers();
			const hanging = new Promise<void>(() => {});
			let settled = false;
			void hanging.then(() => {
				settled = true;
			});

			await vi.advanceTimersByTimeAsync(EWA_COMPANION_LOAD_STALL_MS + 1_000);
			expect(settled).toBe(false);
			vi.useRealTimers();
		});

		it('with stall guard rejects at LOAD_STALL_MS', async () => {
			vi.useFakeTimers();
			const hanging = new Promise<void>(() => {});
			const guarded = withEwaCompanionLoadStall(hanging);
			const outcome = guarded.catch((error: unknown) => error);

			await vi.advanceTimersByTimeAsync(EWA_COMPANION_LOAD_STALL_MS);
			const result = await outcome;
			expect(result).toBeInstanceOf(EwaCompanionLoadTimeoutError);
			expect((result as Error).message).toBe('Request Timeout');
			vi.useRealTimers();
		});
	});

	describe('EwaDesktopApp profile gate', () => {
		it('leaves loading skeleton until stall timeout when profile fetch hangs', async () => {
			vi.useFakeTimers({ shouldAdvanceTime: true });
			profileApiMock.getEwaCompanionProfile.mockImplementation(
				() => new Promise(() => {})
			);

			render(<EwaDesktopApp openedFromSessionRestore />);

			expect(screen.getByRole('status', { busy: true })).toBeInTheDocument();
			expect(
				screen.queryByText('ewaCompanion.gateLoadTimeoutTitle')
			).not.toBeInTheDocument();

			await act(async () => {
				await vi.advanceTimersByTimeAsync(EWA_COMPANION_LOAD_STALL_MS);
			});

			expect(
				screen.getByText('ewaCompanion.gateLoadTimeoutTitle')
			).toBeInTheDocument();
			expect(
				screen.getByText('ewaCompanion.gateLoadTimeout')
			).toBeInTheDocument();
			expect(
				screen.queryByRole('status', { busy: true })
			).not.toBeInTheDocument();
		});

		it('retries profile load from the timeout gate', async () => {
			vi.useFakeTimers({ shouldAdvanceTime: true });
			profileApiMock.getEwaCompanionProfile
				.mockImplementationOnce(() => new Promise(() => {}))
				.mockResolvedValueOnce(sampleProfile);

			render(<EwaDesktopApp openedFromSessionRestore />);

			await act(async () => {
				await vi.advanceTimersByTimeAsync(EWA_COMPANION_LOAD_STALL_MS);
			});

			expect(
				screen.getByText('ewaCompanion.gateLoadTimeoutTitle')
			).toBeInTheDocument();

			await act(async () => {
				fireEvent.click(
					screen.getByRole('button', { name: 'ewaCompanion.gateRetry' })
				);
				await vi.runAllTimersAsync();
			});

			expect(await screen.findByTestId('mock-ewa-chat')).toBeInTheDocument();
		});

		it('slow profile fetch under stall limit still reaches ready state', async () => {
			vi.useFakeTimers({ shouldAdvanceTime: true });
			profileApiMock.getEwaCompanionProfile.mockImplementation(
				() =>
					new Promise((resolve) => {
						globalThis.setTimeout(() => resolve(sampleProfile), 5_000);
					})
			);

			render(<EwaDesktopApp openedFromSessionRestore />);
			expect(screen.getByRole('status', { busy: true })).toBeInTheDocument();

			await act(async () => {
				await vi.advanceTimersByTimeAsync(5_000);
			});

			expect(await screen.findByTestId('mock-ewa-chat')).toBeInTheDocument();
			expect(
				screen.queryByText('ewaCompanion.gateLoadTimeoutTitle')
			).not.toBeInTheDocument();
		});

		it('still maps API errors without waiting for stall timeout', async () => {
			profileApiMock.getEwaCompanionProfile.mockRejectedValueOnce(
				new APIError('offline', 503)
			);

			render(<EwaDesktopApp openedFromSessionRestore />);

			expect(
				await screen.findByText('ewaCompanion.gateNoDbTitle')
			).toBeInTheDocument();
			expect(
				screen.queryByText('ewaCompanion.gateLoadTimeoutTitle')
			).not.toBeInTheDocument();
		});
	});

	describe('CompanionWorkflowObservationSettings', () => {
		it('maps stall timeout to error panel with retry instead of infinite loading', async () => {
			vi.spyOn(
				ewaCompanionLoadStall,
				'withEwaCompanionLoadStall'
			).mockImplementation(() =>
				Promise.reject(new EwaCompanionLoadTimeoutError())
			);

			render(<CompanionWorkflowObservationSettings principalId="p1" />);

			expect(
				await screen.findByText(
					'ewaCompanion.observationTriggers.loadTimeoutTitle'
				)
			).toBeInTheDocument();
			expect(
				screen.getByRole('button', {
					name: 'ewaCompanion.observationTriggers.loadRetry',
				})
			).toBeInTheDocument();
			expect(
				screen.queryByText('ewaCompanion.observationTriggers.idle')
			).not.toBeInTheDocument();
		});
	});
});
