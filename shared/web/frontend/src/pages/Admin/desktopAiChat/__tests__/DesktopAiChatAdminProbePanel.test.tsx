/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DesktopAiChatAdminProbePanel } from '../DesktopAiChatAdminProbePanel';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => {
			if (key.startsWith('adminAiChat.probeCheck.')) {
				return `Human ${key.slice('adminAiChat.probeCheck.'.length)}`;
			}
			return key;
		},
		i18n: { language: 'en' },
	}),
}));

vi.mock('../desktopAiChatAdminApi', () => ({
	runDesktopAiChatAdminProbe: vi.fn(async () => ({
		all_ok: false,
		checks: [
			{
				id: 'llama_chat',
				ok: true,
				latency_ms: 10,
				message: 'ok',
			},
			{
				id: 'legacy_schema_points',
				ok: false,
				latency_ms: 3,
				message: 'legacy points remain',
				details: { legacy_count: 2 },
			},
		],
	})),
	isDesktopAiChatAdminForbidden: () => false,
}));

describe('DesktopAiChatAdminProbePanel', () => {
	it('shows human label keys and rollup banner after run', async () => {
		render(<DesktopAiChatAdminProbePanel />);
		await userEvent.click(
			screen.getByRole('button', { name: 'adminAiChat.probeRun' })
		);
		expect(await screen.findByText('adminAiChat.probeSomeFailed')).toBeTruthy();
		expect(screen.getByText('Human llama_chat')).toBeTruthy();
		expect(screen.getByText('Human legacy_schema_points')).toBeTruthy();
	});
});
