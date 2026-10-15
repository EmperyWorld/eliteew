/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Live Voice expanded panel: power toggle stays enabled when socket is down;
 * dock chrome stays opaque; record empty state is mic-hero (no instruction card).
 *
 * Related:
 * - WidgetExpanded.tsx, liveVoiceLayoutTokens.ts
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
	LIVE_VOICE_OPAQUE_PRIMARY,
	LIVE_VOICE_PANEL_ROOT_DOCK,
} from '../liveVoiceLayoutTokens';
import { WidgetExpanded } from '../WidgetExpanded';

const lv: Record<string, string> = {
	panelAria: 'Голосовой помощник',
	title: 'Голос',
	statusReady: 'Готов к разговору',
	statusStandby: 'Включите, чтобы говорить',
	statusOffline: 'Нет связи — запасной путь',
	powerOn: 'Включить голос',
	powerOff: 'Выключить голос',
	powerOnConnect: 'Включить — подключение к сервису',
	closePanel: 'Закрыть панель',
	tabsAria: 'Разделы',
	tabRecord: 'Запись',
	tabText: 'Текст',
	tabSettings: 'Настройки',
	tabHistory: 'История',
	emptyHint:
		'Нажмите микрофон и скажите фразу — ответ появится здесь и озвучится.',
	enableFirstHint: 'Сначала включите голос переключателем вверху.',
	youSaid: 'Вы сказали',
	reply: 'Ответ',
	stopPlayback: 'Остановить озвучку',
	reset: 'Сбросить',
	dragPanel: 'Перетащить панель',
};

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => lv[key] ?? key,
	}),
}));

vi.mock('@/pages/Desktop/components/DesktopChromeTooltip', () => ({
	DesktopChromeTooltip: ({ children }: { children: React.ReactNode }) => (
		<>{children}</>
	),
}));

vi.mock('../../../contexts/AuthContext', () => ({
	useAuth: () => ({ user: { id: 'u1' } }),
}));

vi.mock('../RecordingButton', () => ({
	RecordingButton: () => <div>mic</div>,
}));

vi.mock('../VoiceSettings', () => ({ VoiceSettings: () => null }));
vi.mock('../ConversationHistory', () => ({
	ConversationHistory: () => null,
}));
vi.mock('../PipelineStatus', () => ({ PipelineStatus: () => null }));
vi.mock('../TextToVoicePanel', () => ({ TextToVoicePanel: () => null }));

describe('WidgetExpanded power toggle', () => {
	it('allows enable while disconnected (connect-on-toggle)', () => {
		const onToggleActive = vi.fn();
		render(
			<WidgetExpanded
				chrome="dock"
				isRecording={false}
				isActive={false}
				isConnected={false}
				onClose={vi.fn()}
				onRecordingClick={vi.fn()}
				onToggleActive={onToggleActive}
			/>
		);

		const toggle = screen.getByRole('button', {
			name: /Включить голос/i,
		});
		expect(toggle).not.toBeDisabled();
		fireEvent.click(toggle);
		expect(onToggleActive).toHaveBeenCalledWith(true);
	});

	it('dock panel root uses opaque primary fill classes', () => {
		const { container } = render(
			<WidgetExpanded
				chrome="dock"
				isRecording={false}
				onClose={vi.fn()}
				onRecordingClick={vi.fn()}
			/>
		);
		const panel = container.querySelector('#live-voice-widget-panel');
		expect(panel).toBeTruthy();
		expect(panel?.className).toContain(LIVE_VOICE_OPAQUE_PRIMARY);
		for (const token of LIVE_VOICE_PANEL_ROOT_DOCK.split(/\s+/).filter(
			Boolean
		)) {
			expect(panel?.className).toContain(token);
		}
	});

	it('record empty state is mic hero without instruction card title', () => {
		render(
			<WidgetExpanded
				chrome="dock"
				isRecording={false}
				isActive
				isConnected
				modelsReady
				onClose={vi.fn()}
				onRecordingClick={vi.fn()}
			/>
		);
		expect(screen.getByRole('heading', { name: 'Голос' })).toBeTruthy();
		expect(screen.getByText(/Нажмите микрофон и скажите фразу/i)).toBeTruthy();
		expect(screen.queryByText('Голосовой ответ')).toBeNull();
		expect(screen.queryByText('Live Voice')).toBeNull();
	});
});
