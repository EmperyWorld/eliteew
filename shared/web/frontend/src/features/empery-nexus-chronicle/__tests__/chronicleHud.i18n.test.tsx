/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock RU/EN parity and HUD copy for Empery Nexus Chronicle.
 *
 * Invariants:
 * - Every English key exists in Russian for emperyNexusChronicle.
 * - HUD renders localized primary CTA, chapters rail, and domain inspector.
 *
 * Related:
 * - i18n/locales/{ru,en}/emperyNexusChronicle.json
 * - ui/ChronicleHud.tsx
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { EMPERY_NEXUS_CHRONICLE_NS } from '@/i18n/namespaces';
import en from '@/i18n/locales/en/emperyNexusChronicle.json';
import ru from '@/i18n/locales/ru/emperyNexusChronicle.json';
import { ChronicleSceneProvider } from '../ChronicleSceneContext';
import { ChronicleHud } from '../ui/ChronicleHud';

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
	const keys: string[] = [];
	for (const [k, v] of Object.entries(obj)) {
		const path = prefix ? `${prefix}.${k}` : k;
		if (v && typeof v === 'object' && !Array.isArray(v)) {
			keys.push(...flattenKeys(v as Record<string, unknown>, path));
		} else {
			keys.push(path);
		}
	}
	return keys;
}

const chronicleI18n = i18n.createInstance();

beforeAll(async () => {
	await chronicleI18n.use(initReactI18next).init({
		lng: 'ru',
		fallbackLng: 'ru',
		resources: {
			ru: { [EMPERY_NEXUS_CHRONICLE_NS]: ru },
			en: { [EMPERY_NEXUS_CHRONICLE_NS]: en },
		},
		ns: [EMPERY_NEXUS_CHRONICLE_NS],
		defaultNS: EMPERY_NEXUS_CHRONICLE_NS,
		interpolation: { escapeValue: false },
	});
});

function renderHud(
	overrides?: Partial<{
		selectedDomainId: 'api' | null;
		chapterId: 'husk' | 'sovereignty';
	}>
) {
	const onNavigate = vi.fn();
	const api = {
		layer: 'mask' as const,
		setLayer: vi.fn(),
		pulse: 0,
		emitPulse: vi.fn(),
		rebirthKey: 0,
		replayRebirth: vi.fn(),
		selectedDomainId: overrides?.selectedDomainId ?? null,
		setSelectedDomainId: vi.fn(),
		focusDomain: vi.fn(),
		cycleDomain: vi.fn(),
		chapterId: overrides?.chapterId ?? ('husk' as const),
		setChapterId: vi.fn(),
		cycleChapter: vi.fn(),
	};
	render(
		<I18nextProvider i18n={chronicleI18n}>
			<ChronicleSceneProvider value={api}>
				<ChronicleHud
					onNavigate={onNavigate}
					cinemaMode={false}
					muted={false}
					audioNeedsGesture={false}
					onToggleCinema={vi.fn()}
					onToggleHelp={vi.fn()}
					onToggleMute={vi.fn()}
					onAwakenAudio={vi.fn()}
				/>
			</ChronicleSceneProvider>
		</I18nextProvider>
	);
	return { onNavigate, api };
}

describe('emperyNexusChronicle i18n', () => {
	it('keeps RU/EN key parity for the chronicle namespace', () => {
		const enKeys = flattenKeys(en as Record<string, unknown>).sort();
		const ruKeys = flattenKeys(ru as Record<string, unknown>).sort();
		expect(ruKeys).toEqual(enKeys);
		expect(enKeys).toContain('actions.return');
		expect(enKeys).toContain('actions.toggleMute');
		expect(enKeys).toContain('chapters.sovereignty.body');
		expect(enKeys).toContain('domains.api.role');
		expect(enKeys).toContain('layers.soul.title');
		expect(enKeys).toContain('hierarchy.nexus');
		expect(enKeys).toContain('coldOpen.skip');
		expect(enKeys).toContain('domains.api.lore');
		expect(enKeys).toContain('actions.awakenAudio');
		expect(enKeys).toContain('hints.audioUnlock');
	});

	it('renders Russian HUD primary CTA, chapters, and empty inspector', async () => {
		await chronicleI18n.changeLanguage('ru');
		const { onNavigate, api } = renderHud();
		expect(
			screen.getByRole('button', { name: 'Вернуться в Мир' })
		).toBeInTheDocument();
		expect(screen.getByTestId('empery-nexus-chapters')).toHaveTextContent(
			'Оболочка'
		);
		expect(
			screen.getByTestId('empery-nexus-domain-inspector')
		).toHaveTextContent('Домен не выбран');
		await userEvent.click(
			screen.getByRole('button', { name: 'Следующая глава' })
		);
		expect(api.cycleChapter).toHaveBeenCalledWith(1);
		await userEvent.click(
			screen.getByRole('button', { name: 'Вернуться в Мир' })
		);
		expect(onNavigate).toHaveBeenCalledWith('desktop');
	});

	it('renders English inspector when a domain is focused', async () => {
		await chronicleI18n.changeLanguage('en');
		const { api } = renderHud({ selectedDomainId: 'api' });
		expect(screen.getByText('API')).toBeInTheDocument();
		expect(
			screen.getByText(/EliteEW muscle — logic executing Nexus law/)
		).toBeInTheDocument();
		expect(
			screen.getByText(/Routes, workers, and contracts are muscle fibers/)
		).toBeInTheDocument();
		expect(screen.getByTestId('empery-nexus-hierarchy')).toHaveTextContent(
			'Nexus'
		);
		await userEvent.click(screen.getByRole('button', { name: 'Clear focus' }));
		expect(api.focusDomain).toHaveBeenCalledWith(null);
	});
});
