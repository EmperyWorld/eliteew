/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Regression coverage for the isolated Document Editor V2 shell foundation.
 *
 * Invariants:
 * - The V2 shell must expose the requested rails, editor placeholder, header and footer without mounting UltimateDocEditor.
 * - Legacy fallback is an explicit caller-provided action.
 *
 * Related:
 * - src/features/documentEditorV2/DocEditorV2Shell.tsx
 */

import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it, vi } from 'vitest';

import i18n, { i18nReady } from '@/i18n/config';

import { DocEditorV2Shell } from '../DocEditorV2Shell';

async function renderShell(ui: ReactElement) {
	await i18nReady;
	await i18n.changeLanguage('ru');
	return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

describe('DocEditorV2Shell', () => {
	it('renders the isolated v2 editor shell regions', async () => {
		await renderShell(<DocEditorV2Shell />);

		expect(
			screen.getByRole('heading', { name: 'Новый документ V2' })
		).toBeInTheDocument();
		expect(screen.getByText('Структура')).toBeInTheDocument();
		expect(screen.getAllByText('Импорт').length).toBeGreaterThan(0);
		expect(
			screen.getByRole('main', { name: 'Рабочая область документа' })
		).toBeInTheDocument();
		expect(screen.getByText('ЕВА рядом')).toBeInTheDocument();
		expect(screen.getByText('Предложения')).toBeInTheDocument();
		expect(screen.getByText('Черновик: серверный')).toBeInTheDocument();
	});

	it('keeps fallback to the legacy editor explicit', async () => {
		const onFallbackToLegacy = vi.fn();

		await renderShell(
			<DocEditorV2Shell onFallbackToLegacy={onFallbackToLegacy} />
		);

		fireEvent.click(screen.getByRole('button', { name: 'Старый редактор' }));

		expect(onFallbackToLegacy).toHaveBeenCalledTimes(1);
	});
});
