import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import desktopUiEn from '../../../../i18n/locales/en/desktopUi.json';
import {
	createMinimalDesktopSettingsPanelProps,
	MINIMAL_DESKTOP_SETTINGS_CENTER,
} from '../../__fixtures__/desktopSettingsTestDoubles';
import {
	DesktopSettingsPanel,
	DESKTOP_SETTINGS_MAIN_TABPANEL_ID,
} from '../DesktopSettingsPanel';

function nestedString(
	obj: Record<string, unknown>,
	path: string[]
): string | undefined {
	let cur: unknown = obj;
	for (const p of path) {
		if (!cur || typeof cur !== 'object') return undefined;
		cur = (cur as Record<string, unknown>)[p];
	}
	return typeof cur === 'string' ? cur : undefined;
}

function desktopUiT(key: string): string {
	const parts = key.split('.');
	let cur: unknown = desktopUiEn;
	for (const p of parts) {
		if (!cur || typeof cur !== 'object') return key;
		cur = (cur as Record<string, unknown>)[p];
	}
	return typeof cur === 'string' ? cur : key;
}

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (k: string, opts?: Record<string, unknown>) => {
			let text = desktopUiT(k);
			if (opts) {
				for (const [key, value] of Object.entries(opts)) {
					text = text.replaceAll(`{{${key}}}`, String(value));
				}
			}
			return text;
		},
		i18n: { language: 'en' },
	}),
}));

vi.mock('sonner', () => ({
	toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

beforeAll(() => {
	vi.stubGlobal(
		'matchMedia',
		vi.fn().mockImplementation((query: string) => ({
			matches: false,
			media: query,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			addListener: vi.fn(),
			removeListener: vi.fn(),
			dispatchEvent: vi.fn(() => false),
			onchange: null,
		}))
	);
});

afterAll(() => {
	vi.unstubAllGlobals();
});

describe('DesktopSettingsPanel a11y (wave 9)', () => {
	it('uses tablist + tab + tabpanel wiring for sections', () => {
		render(
			<DesktopSettingsPanel
				{...createMinimalDesktopSettingsPanelProps({ activeTab: 'shell' })}
			/>
		);

		const primaryTablist = screen.getByRole('tablist', {
			name: nestedString(desktopUiEn as Record<string, unknown>, [
				'settingsPanel',
				'primarySectionsNavAria',
			]),
		});
		expect(within(primaryTablist).getAllByRole('tab')).toHaveLength(4);

		const advancedTablist = screen.getByRole('tablist', {
			name: nestedString(desktopUiEn as Record<string, unknown>, [
				'settingsPanel',
				'advancedDisclosure',
				'tabsAria',
			]),
		});
		expect(within(advancedTablist).getAllByRole('tab')).toHaveLength(2);

		const shellLabel = nestedString(desktopUiEn as Record<string, unknown>, [
			'settingsPanel',
			'tabs',
			'shell',
			'label',
		]);
		expect(shellLabel).toBeTruthy();
		const shellTab = within(advancedTablist).getByRole('tab', {
			name: shellLabel,
		});
		expect(shellTab).toHaveAttribute('aria-selected', 'true');
		expect(shellTab).toHaveAttribute(
			'aria-controls',
			DESKTOP_SETTINGS_MAIN_TABPANEL_ID
		);

		const panel = screen.getByRole('tabpanel');
		expect(panel).toHaveAttribute('id', DESKTOP_SETTINGS_MAIN_TABPANEL_ID);
		const labelledBy = panel.getAttribute('aria-labelledby');
		expect(labelledBy).toBeTruthy();
		const labelledEl = labelledBy ? document.getElementById(labelledBy) : null;
		expect(labelledEl).toBe(shellTab);
	});

	it('exposes accessible product title without in-panel close chrome', () => {
		render(
			<DesktopSettingsPanel {...createMinimalDesktopSettingsPanelProps()} />
		);
		expect(
			screen.getByRole('heading', {
				name:
					nestedString(desktopUiEn as Record<string, unknown>, [
						'settingsPanel',
						'headerTitle',
					]) ?? /Desktop settings/i,
			})
		).toBeInTheDocument();
		expect(
			screen.queryByRole('button', {
				name:
					nestedString(desktopUiEn as Record<string, unknown>, [
						'modal',
						'close',
					]) ?? /close/i,
			})
		).not.toBeInTheDocument();
	});

	it('exposes personalize section heading for the default tab', async () => {
		render(
			<DesktopSettingsPanel {...createMinimalDesktopSettingsPanelProps()} />
		);
		expect(
			await screen.findByRole(
				'heading',
				{
					name:
						nestedString(desktopUiEn as Record<string, unknown>, [
							'settingsPanel',
							'sectionPersonalizeTitle',
						]) ?? /Personalize|Персонализация/i,
				},
				{ timeout: 8000 }
			)
		).toBeInTheDocument();
	});

	it('switches primary tabs with 1–4 and advanced tabs after disclosure', () => {
		const onActiveTabChange = vi.fn();
		render(
			<DesktopSettingsPanel
				{...createMinimalDesktopSettingsPanelProps({
					activeTab: 'personalize',
					onActiveTabChange,
				})}
			/>
		);

		fireEvent.keyDown(window, { key: '3' });
		expect(onActiveTabChange).toHaveBeenCalledWith('chrome');

		onActiveTabChange.mockClear();
		fireEvent.keyDown(window, { key: '4' });
		expect(onActiveTabChange).toHaveBeenCalledWith('widgets');

		onActiveTabChange.mockClear();
		fireEvent.keyDown(window, { key: '5' });
		expect(onActiveTabChange).not.toHaveBeenCalled();

		fireEvent.click(
			screen.getByRole('button', {
				name: nestedString(desktopUiEn as Record<string, unknown>, [
					'settingsPanel',
					'advancedDisclosure',
					'label',
				]),
			})
		);
		fireEvent.keyDown(window, { key: '5' });
		expect(onActiveTabChange).toHaveBeenCalledWith('shell');

		onActiveTabChange.mockClear();
		const input = document.createElement('input');
		document.body.appendChild(input);
		input.focus();
		fireEvent.keyDown(input, { key: '5', bubbles: true });
		expect(onActiveTabChange).not.toHaveBeenCalled();
		input.remove();
	});

	it('moves roving tab focus with arrow keys on tablist', () => {
		const onActiveTabChange = vi.fn();
		render(
			<DesktopSettingsPanel
				{...createMinimalDesktopSettingsPanelProps({
					activeTab: 'chrome',
					onActiveTabChange,
				})}
			/>
		);

		const chromeTab = screen.getByRole('tab', {
			name: nestedString(desktopUiEn as Record<string, unknown>, [
				'settingsPanel',
				'tabs',
				'chrome',
				'label',
			]),
		});
		chromeTab.focus();
		fireEvent.keyDown(chromeTab, { key: 'ArrowRight' });
		expect(onActiveTabChange).toHaveBeenCalledWith('widgets');
	});

	it('shell sync card shows offline hint and persist queue count', async () => {
		render(
			<DesktopSettingsPanel
				{...createMinimalDesktopSettingsPanelProps({
					activeTab: 'shell',
					settingsCenterBridge: {
						...MINIMAL_DESKTOP_SETTINGS_CENTER,
						sync: {
							...MINIMAL_DESKTOP_SETTINGS_CENTER.sync,
							isOnline: false,
							persistQueue: { config: 1, shell: 2, total: 3 },
						},
					},
				})}
			/>
		);

		expect(
			await screen.findByTestId(
				'desktop-settings-persist-queue-banner',
				{},
				{ timeout: 8000 }
			)
		).toBeInTheDocument();
		expect(
			screen.getByText(/Offline: desktop changes are queued locally/i)
		).toBeInTheDocument();
		expect(
			screen.getByText(/Pending saves in queue: 3 \(config 1, shell 2\)/)
		).toBeInTheDocument();
	});

	it('shell sync prefs card renders clock and quiet mode controls', async () => {
		render(
			<DesktopSettingsPanel
				{...createMinimalDesktopSettingsPanelProps({ activeTab: 'shell' })}
			/>
		);
		expect(
			await screen.findByLabelText(/Show seconds on taskbar clock/i)
		).toBeInTheDocument();
		expect(
			document.getElementById('desktop-settings-field-shell_state-quiet_mode')
		).toBeTruthy();
	});

	it('sync card flush button invokes onFlushPersistQueue', async () => {
		const onFlushPersistQueue = vi.fn();
		render(
			<DesktopSettingsPanel
				{...createMinimalDesktopSettingsPanelProps({
					activeTab: 'shell',
					settingsCenterBridge: {
						...MINIMAL_DESKTOP_SETTINGS_CENTER,
						sync: {
							...MINIMAL_DESKTOP_SETTINGS_CENTER.sync,
							persistQueue: { config: 0, shell: 1, total: 1 },
							onFlushPersistQueue,
						},
					},
				})}
			/>
		);

		const flush = await screen.findByTestId(
			'desktop-settings-persist-queue-flush'
		);
		flush.click();
		expect(onFlushPersistQueue).toHaveBeenCalledTimes(1);
	});
});
