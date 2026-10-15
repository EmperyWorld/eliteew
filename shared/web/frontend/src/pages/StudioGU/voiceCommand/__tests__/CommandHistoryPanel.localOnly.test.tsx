/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * CommandHistoryPanel local-only banner contract (device-local VCC history).
 *
 * Related:
 * - `CommandHistoryPanel.tsx`, `desktopUi.workspace.localOnlyHint`
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CommandHistoryPanel } from '../components/CommandHistoryPanel';

vi.mock('@/pages/Desktop/context/DesktopWindowPortalStackContext', () => ({
	useDesktopWindowPortalStackBase: () => 9000,
}));

vi.mock('react-i18next', () => ({
	useTranslation: (_ns?: string, opts?: { keyPrefix?: string }) => {
		if (opts?.keyPrefix === 'voiceCommand') {
			return {
				t: (key: string, params?: { count?: number }) => {
					if (key === 'history.title') return 'Command journal';
					if (key === 'history.subtitle')
						return `Last ${params?.count ?? 0} commands on this device`;
					if (key === 'actions.close') return 'Close';
					if (key.startsWith('history.status.'))
						return key.split('.').pop() ?? key;
					return key;
				},
				i18n: { language: 'en' },
			};
		}
		return {
			t: (key: string) =>
				key === 'localOnlyHint'
					? 'Saved only on this device'
					: key === 'localOnlyVoiceDetail'
						? 'Command history and macros stay on this device only'
						: key,
			i18n: { language: 'en' },
		};
	},
}));

describe('CommandHistoryPanel local-only banner', () => {
	it('shows workspace localOnlyHint when showLocalOnlyBanner is true', () => {
		render(
			<CommandHistoryPanel
				open
				onClose={vi.fn()}
				items={[]}
				showLocalOnlyBanner
			/>
		);

		expect(screen.getByText('Saved only on this device')).toBeInTheDocument();
		expect(
			screen.getByText('Command history and macros stay on this device only')
		).toBeInTheDocument();
		expect(screen.getByRole('dialog')).toContainElement(
			screen.getByText('Saved only on this device')
		);
	});

	it('hides banner when showLocalOnlyBanner is false', () => {
		render(
			<CommandHistoryPanel
				open
				onClose={vi.fn()}
				items={[]}
				showLocalOnlyBanner={false}
			/>
		);

		expect(
			screen.queryByText('Saved only on this device')
		).not.toBeInTheDocument();
	});
});
