/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * VoiceCommandCenter i18n shell contract (EN title, clear feed vs journal semantics).
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { VoiceCommandCenter } from '../VoiceCommandCenter';

vi.mock('@/contexts/AuthContext', () => ({
	useAuth: () => ({ token: null }),
}));

vi.mock('@/voice-core', () => ({
	DEFAULT_VOICE_SETTINGS: {
		language: 'en',
		voice: 'xenia',
		llamaModel: 'default',
	},
	useVoiceSettingsOptional: () => null,
	synthesize: vi.fn(),
}));

vi.mock('@/components/LiveVoiceWidget/hooks/useLiveVoiceWebSocket', () => ({
	useLiveVoiceWebSocket: () => ({
		sendAudio: vi.fn(),
		setActive: vi.fn(),
	}),
}));

vi.mock('@/pages/Desktop/context/DesktopVoiceContext', () => ({
	useDesktopVoiceOptional: () => null,
}));

vi.mock('@/pages/Desktop/hooks/useDesktopGuideTourOpener', () => ({
	useDesktopGuideTourOpener: vi.fn(),
}));

vi.mock('@/pages/Desktop/context/DesktopWindowPortalStackContext', () => ({
	useDesktopWindowPortalStackBase: () => 9000,
}));

vi.mock('react-i18next', async (importOriginal) => {
	const actual = await importOriginal<typeof import('react-i18next')>();
	const voiceCommandMap: Record<string, string> = {
		title: 'Voice Command Center',
		subtitle: 'Control by voice',
		'actions.clearFeed': 'Clear message feed',
		'actions.commandHistory': 'Command journal',
		embeddedLocalOnlyChip: 'Device-only history',
		'feed.emptyTitle': 'Ready to listen',
		'feed.emptyDescription': 'Tap the microphone',
		'feed.tapToRecord': 'Tap to record',
		'macros.title': 'Macros',
		'commands.title': 'Available commands',
		'services.stt': 'Speech recognition',
		'services.llm': 'Intent model',
		'services.tts': 'Spoken responses',
	};
	return {
		...actual,
		useTranslation: (ns?: string, opts?: { keyPrefix?: string }) => {
			if (ns === 'desktopUi' && opts?.keyPrefix === 'workspace') {
				return {
					t: (key: string) =>
						key === 'localOnlyHint'
							? 'Saved only on this device'
							: key === 'localOnlyVoiceDetail'
								? 'Command history and macros stay on this device only'
								: key,
					i18n: { language: 'en' },
				};
			}
			return {
				t: (key: string) => voiceCommandMap[key] ?? key,
				i18n: { language: 'en' },
			};
		},
	};
});

describe('VoiceCommandCenter i18n shell', () => {
	beforeEach(() => {
		Element.prototype.scrollIntoView = vi.fn();
	});

	it('renders English title in standalone mode', () => {
		render(<VoiceCommandCenter />);
		expect(screen.getByText('Voice Command Center')).toBeInTheDocument();
		expect(screen.getByText('Control by voice')).toBeInTheDocument();
	});

	it('labels trash as clear feed not full history', () => {
		render(<VoiceCommandCenter />);
		expect(
			screen.getByRole('button', { name: 'Clear message feed' })
		).toBeInTheDocument();
	});

	it('hides local-only chip when embedded in Studio GU', () => {
		render(<VoiceCommandCenter embeddedInStudio />);
		expect(screen.queryByText('Device-only history')).not.toBeInTheDocument();
		expect(screen.queryByText('Voice Command Center')).not.toBeInTheDocument();
	});
});
