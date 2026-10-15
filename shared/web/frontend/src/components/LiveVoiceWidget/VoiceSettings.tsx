/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Live Voice settings panel: language, speech rate, and volume only.
 * Persists via VoiceSettingsContext (or local API fallback).
 *
 * Invariants:
 * - UI does not expose model / voice / persona pickers (server keeps those fields).
 * - Debounced save depends on editable field values, not the whole context object
 *   (avoids «Сохранение…» flicker when `saving` toggles).
 *
 * Related:
 * - voice-core/VoiceSettingsContext.tsx, VOICE-CONTROL-STUDIO.md
 */

import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { LanguageIcon } from '@heroicons/react/24/outline';
import { apiClient } from '../../services/api';
import { log } from '../../utils/logger';
import { DEFAULT_LLAMA_MODEL } from '../../config';
import { DESKTOP_TYPOGRAPHY } from '@/pages/Desktop/constants';
import { cn } from '@/utils/cn';
import {
	LIVE_VOICE_SETTINGS_SAVED_EVENT,
	useVoiceSettingsOptional,
	VOICE_SETTINGS_STORAGE_KEY,
	type VoiceSettings as VoiceSettingsValues,
} from '../../voice-core';

const DEFAULT_SETTINGS: VoiceSettingsValues = {
	voice: 'xenia',
	language: 'ru',
	llamaModel: DEFAULT_LLAMA_MODEL,
	whisperModel: 'large-v3',
	speed: 1.0,
	volume: 1.0,
	enableArlekina: true,
};

const LANGUAGES = [
	{ id: 'auto', name: 'Автоопределение' },
	{ id: 'en', name: 'English' },
	{ id: 'ru', name: 'Русский' },
] as const;

const FIELD_CLASS = cn(
	'w-full rounded-(--desktop-radius) border border-(--desktop-border-subtle)',
	'bg-[rgb(var(--desktop-bg-secondary-rgb))] px-3.5 py-2.5',
	'text-sm text-(--desktop-text-primary)',
	'focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)]'
);

const RANGE_CLASS = cn(
	'h-2 w-full cursor-pointer appearance-none rounded-full',
	'bg-(--desktop-border-subtle) accent-[rgb(var(--desktop-accent-rgb))]',
	'focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--desktop-accent-rgb)/0.45)]'
);

interface ServerSettingsResponse {
	tts_voice?: string;
	language?: string;
	llama_model?: string;
	whisper_model?: string;
	tts_speed?: number;
	tts_volume?: number;
	enable_arlekina?: boolean;
}

const loadSettingsFromServer = async (): Promise<VoiceSettingsValues> => {
	try {
		const response = await apiClient.get<ServerSettingsResponse>(
			'/api/v1/live-voice/settings'
		);
		const s = response.data;
		return {
			voice:
				typeof s.tts_voice === 'string' ? s.tts_voice : DEFAULT_SETTINGS.voice,
			language:
				typeof s.language === 'string' ? s.language : DEFAULT_SETTINGS.language,
			llamaModel:
				typeof s.llama_model === 'string'
					? s.llama_model
					: DEFAULT_SETTINGS.llamaModel,
			whisperModel:
				typeof s.whisper_model === 'string'
					? s.whisper_model
					: DEFAULT_SETTINGS.whisperModel,
			speed:
				typeof s.tts_speed === 'number' ? s.tts_speed : DEFAULT_SETTINGS.speed,
			volume:
				typeof s.tts_volume === 'number'
					? s.tts_volume
					: DEFAULT_SETTINGS.volume,
			enableArlekina:
				typeof s.enable_arlekina === 'boolean'
					? s.enable_arlekina
					: DEFAULT_SETTINGS.enableArlekina,
		};
	} catch (e) {
		log.warn(
			'VoiceSettings',
			'Failed to load settings from server',
			e instanceof Error ? e : new Error(String(e))
		);
		try {
			const saved = localStorage.getItem(VOICE_SETTINGS_STORAGE_KEY);
			if (saved) {
				const parsed = JSON.parse(saved) as Partial<VoiceSettingsValues>;
				return { ...DEFAULT_SETTINGS, ...parsed };
			}
		} catch {
			// ignore
		}
		return DEFAULT_SETTINGS;
	}
};

const saveSettingsToServer = async (
	settings: VoiceSettingsValues
): Promise<void> => {
	await apiClient.put('/api/v1/live-voice/settings', {
		tts_voice: settings.voice,
		language: settings.language,
		llama_model: settings.llamaModel,
		whisper_model: settings.whisperModel,
		tts_speed: settings.speed,
		tts_volume: settings.volume,
		enable_arlekina: settings.enableArlekina,
	});
	try {
		localStorage.setItem(VOICE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
	} catch {
		// ignore
	}
};

export const VoiceSettings: React.FC = () => {
	const ctx = useVoiceSettingsOptional();
	const [localSettings, setLocalSettings] =
		useState<VoiceSettingsValues>(DEFAULT_SETTINGS);
	const [localLoading, setLocalLoading] = useState(true);
	const [localSaving, setLocalSaving] = useState(false);
	const skipInitialSaveRef = useRef(true);

	const hasContext = ctx !== null;
	const settings = hasContext ? ctx.settings : localSettings;
	const loading = hasContext ? ctx.loading : localLoading;
	const saving = hasContext ? ctx.saving : localSaving;
	const saveToServer = hasContext ? ctx.saveToServer : null;

	const updateSettings = (patch: Partial<VoiceSettingsValues>): void => {
		if (hasContext && ctx) {
			ctx.updateSettings(patch);
			return;
		}
		setLocalSettings((prev) => ({ ...prev, ...patch }));
	};

	useEffect(() => {
		if (hasContext) return;
		void loadSettingsFromServer().then((loaded) => {
			setLocalSettings(loaded);
			setLocalLoading(false);
		});
	}, [hasContext]);

	// Debounce only on editable field changes — never on `ctx` / `saving` (that caused flicker).
	useEffect(() => {
		if (loading) {
			skipInitialSaveRef.current = true;
			return;
		}
		if (skipInitialSaveRef.current) {
			skipInitialSaveRef.current = false;
			return;
		}

		const timeoutId = window.setTimeout(() => {
			if (hasContext && saveToServer) {
				void saveToServer().catch((e: unknown) => {
					log.error(
						'VoiceSettings',
						'Failed to save settings',
						e instanceof Error ? e : new Error(String(e))
					);
				});
				return;
			}
			setLocalSaving(true);
			void saveSettingsToServer(settings)
				.then(() => {
					if (typeof window !== 'undefined') {
						window.dispatchEvent(
							new CustomEvent(LIVE_VOICE_SETTINGS_SAVED_EVENT)
						);
					}
				})
				.catch((e: unknown) => {
					log.error(
						'VoiceSettings',
						'Failed to save settings',
						e instanceof Error ? e : new Error(String(e))
					);
				})
				.finally(() => {
					setLocalSaving(false);
				});
		}, 800);

		return () => {
			window.clearTimeout(timeoutId);
		};
	}, [hasContext, loading, saveToServer, settings]);

	if (loading) {
		return (
			<div className="flex items-center justify-center py-8">
				<p className={DESKTOP_TYPOGRAPHY.meta}>Загрузка настроек…</p>
			</div>
		);
	}

	return (
		<div className="space-y-5" data-live-voice-settings="playback">
			{saving ? (
				<p
					className={cn(DESKTOP_TYPOGRAPHY.meta, 'text-(--desktop-text-muted)')}
					data-live-voice-settings-saving
				>
					Сохранение…
				</p>
			) : null}

			<div>
				<label
					htmlFor="language-select"
					className={cn(
						DESKTOP_TYPOGRAPHY.meta,
						'mb-2 flex items-center gap-2 text-(--desktop-text-secondary)'
					)}
				>
					<LanguageIcon width={16} height={16} aria-hidden />
					Язык
				</label>
				<select
					id="language-select"
					value={settings.language}
					onChange={(e) => updateSettings({ language: e.target.value })}
					className={FIELD_CLASS}
				>
					{LANGUAGES.map((lang) => (
						<option key={lang.id} value={lang.id}>
							{lang.name}
						</option>
					))}
				</select>
			</div>

			<div>
				<label
					htmlFor="speed-range"
					className={cn(
						DESKTOP_TYPOGRAPHY.meta,
						'mb-2 block text-(--desktop-text-secondary)'
					)}
				>
					Скорость речи: {settings.speed.toFixed(1)}×
				</label>
				<input
					id="speed-range"
					type="range"
					min="0.5"
					max="2.0"
					step="0.1"
					value={settings.speed}
					onChange={(e) =>
						updateSettings({ speed: Number.parseFloat(e.target.value) })
					}
					className={RANGE_CLASS}
					aria-label="Скорость речи"
				/>
				<div
					className={cn(
						DESKTOP_TYPOGRAPHY.meta,
						'mt-1 flex justify-between text-(--desktop-text-dim)'
					)}
				>
					<span>0.5×</span>
					<span>1.0×</span>
					<span>2.0×</span>
				</div>
			</div>

			<div>
				<label
					htmlFor="volume-range"
					className={cn(
						DESKTOP_TYPOGRAPHY.meta,
						'mb-2 block text-(--desktop-text-secondary)'
					)}
				>
					Громкость: {Math.round(settings.volume * 100)}%
				</label>
				<input
					id="volume-range"
					type="range"
					min="0"
					max="1"
					step="0.01"
					value={settings.volume}
					onChange={(e) =>
						updateSettings({ volume: Number.parseFloat(e.target.value) })
					}
					className={RANGE_CLASS}
					aria-label="Громкость"
				/>
				<div
					className={cn(
						DESKTOP_TYPOGRAPHY.meta,
						'mt-1 flex justify-between text-(--desktop-text-dim)'
					)}
				>
					<span>0%</span>
					<span>50%</span>
					<span>100%</span>
				</div>
			</div>
		</div>
	);
};
