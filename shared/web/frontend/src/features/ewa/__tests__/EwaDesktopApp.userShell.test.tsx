/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest coverage for the user-facing EWA desktop shell chrome around companion chat.
 *
 * Invariants:
 * - User chat shell must not expose operator/debug gear menu actions.
 *
 * Related:
 * - src/features/ewa/EwaDesktopApp.tsx
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EwaDesktopApp } from '@/features/ewa/EwaDesktopApp';
import { APIError } from '@/services/api/client';

const profileApiMock = vi.hoisted(() => ({
	getEwaCompanionProfile: vi.fn(),
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

describe('EwaDesktopApp user shell', () => {
	beforeEach(() => {
		profileApiMock.getEwaCompanionProfile.mockResolvedValue({
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
		});
	});

	it('renders companion chat without the old gear tools menu', async () => {
		render(<EwaDesktopApp openedFromSessionRestore />);

		expect(await screen.findByTestId('mock-ewa-chat')).toBeInTheDocument();
		expect(
			screen.queryByLabelText('ewaDesktopApp.toolsMenuAria')
		).not.toBeInTheDocument();
		expect(screen.queryByRole('menu')).not.toBeInTheDocument();
	});

	it('publishes the companion display name to desktop window payload', async () => {
		const onWindowPayloadChange = vi.fn();

		render(
			<EwaDesktopApp
				openedFromSessionRestore
				onWindowPayloadChange={onWindowPayloadChange}
			/>
		);

		await screen.findByTestId('mock-ewa-chat');
		await waitFor(() => {
			expect(onWindowPayloadChange).toHaveBeenCalledWith(
				expect.objectContaining({
					ewaDesktopPersonaId: 'tala',
					ewaDesktopDisplayName: 'Тала',
				})
			);
		});
	});

	it('uses a shared state panel when companion storage is unavailable', async () => {
		profileApiMock.getEwaCompanionProfile.mockRejectedValueOnce(
			new APIError('offline', 503)
		);

		render(<EwaDesktopApp openedFromSessionRestore />);

		expect(
			await screen.findByText('ewaCompanion.gateNoDbTitle')
		).toBeInTheDocument();
		expect(screen.getByText('ewaCompanion.gateNoDb')).toBeInTheDocument();
	});

	it('retries companion profile loading from the offline gate', async () => {
		profileApiMock.getEwaCompanionProfile
			.mockRejectedValueOnce(new APIError('offline', 503))
			.mockResolvedValueOnce({
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
			});

		render(<EwaDesktopApp openedFromSessionRestore />);

		expect(
			await screen.findByText('ewaCompanion.gateNoDbTitle')
		).toBeInTheDocument();
		fireEvent.click(
			screen.getByRole('button', { name: 'ewaCompanion.gateRetry' })
		);

		expect(await screen.findByTestId('mock-ewa-chat')).toBeInTheDocument();
		expect(
			profileApiMock.getEwaCompanionProfile.mock.calls.length
		).toBeGreaterThan(1);
	});
});
