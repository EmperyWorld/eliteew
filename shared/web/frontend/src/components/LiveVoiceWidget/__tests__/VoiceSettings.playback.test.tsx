/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Live Voice settings UI scope + save debounce does not loop on `saving`.
 *
 * Related:
 * - VoiceSettings.tsx
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VoiceSettings } from '../VoiceSettings';
import type { VoiceSettings as VoiceSettingsValues } from '@/voice-core';

const saveToServer = vi.fn(() => Promise.resolve());
const updateSettings = vi.fn();

const baseSettings: VoiceSettingsValues = {
	voice: 'xenia',
	language: 'ru',
	llamaModel: 'default',
	whisperModel: 'large-v3',
	speed: 1,
	volume: 1,
	enableArlekina: false,
};

let mockCtx: {
	settings: VoiceSettingsValues;
	loading: boolean;
	saving: boolean;
	updateSettings: typeof updateSettings;
	saveToServer: typeof saveToServer;
};

vi.mock('@/voice-core', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@/voice-core')>();
	return {
		...actual,
		useVoiceSettingsOptional: () => mockCtx,
	};
});

describe('VoiceSettings playback-only UI', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		saveToServer.mockClear();
		updateSettings.mockClear();
		mockCtx = {
			settings: { ...baseSettings },
			loading: false,
			saving: false,
			updateSettings,
			saveToServer,
		};
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('exposes only language, speed, and volume controls', () => {
		render(<VoiceSettings />);

		expect(screen.getByLabelText(/Язык|language/i)).toBeTruthy();
		expect(screen.getByLabelText(/Скорость речи/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Громкость/i)).toBeInTheDocument();

		expect(
			screen.queryByText(
				/Модель для ответа|Модель транскрибации|СтервеЛЛа|Арлекина/i
			)
		).not.toBeInTheDocument();
		expect(screen.queryByLabelText(/Голос/i)).not.toBeInTheDocument();
	});

	it('does not re-save when only saving flag toggles on the context', async () => {
		const { rerender } = render(<VoiceSettings />);

		await act(async () => {
			vi.advanceTimersByTime(900);
		});
		expect(saveToServer).not.toHaveBeenCalled();

		mockCtx = { ...mockCtx, saving: true };
		rerender(<VoiceSettings />);
		mockCtx = { ...mockCtx, saving: false };
		rerender(<VoiceSettings />);

		await act(async () => {
			vi.advanceTimersByTime(2000);
		});
		expect(saveToServer).not.toHaveBeenCalled();
	});

	it('debounces a single save after language change', async () => {
		updateSettings.mockImplementation((patch: Partial<VoiceSettingsValues>) => {
			mockCtx = {
				...mockCtx,
				settings: { ...mockCtx.settings, ...patch },
			};
		});

		const { rerender } = render(<VoiceSettings />);

		fireEvent.change(screen.getByRole('combobox'), {
			target: { value: 'en' },
		});
		expect(updateSettings).toHaveBeenCalledWith({ language: 'en' });

		rerender(<VoiceSettings />);

		await act(async () => {
			vi.advanceTimersByTime(400);
		});
		expect(saveToServer).not.toHaveBeenCalled();

		await act(async () => {
			vi.advanceTimersByTime(500);
		});
		expect(saveToServer).toHaveBeenCalledTimes(1);
	});
});
