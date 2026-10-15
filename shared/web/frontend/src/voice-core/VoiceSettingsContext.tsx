/**
 * VoiceSettingsContext - Single source of truth for voice settings across all voice UI modules.
 * Persists to server (GET/PUT /api/v1/live-voice/settings) with localStorage fallback.
 */

import * as React from 'react';
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from 'react';
import { apiClient, APIError } from '../services/api';
import authSession from '../services/authSession';
import { log } from '../utils/logger';
import {
	apiToVoiceSettings,
	broadcastVoiceSettingsChanged,
	DEFAULT_VOICE_SETTINGS,
	LIVE_VOICE_SETTINGS_SAVED_EVENT,
	voiceSettingsToApi,
	VOICE_SETTINGS_STORAGE_KEY,
	type VoiceSettings,
	type VoiceSettingsApi,
} from './types';

const SETTINGS_API = '/api/v1/live-voice/settings';

export interface VoiceSettingsContextValue {
	settings: VoiceSettings;
	setSettings: React.Dispatch<React.SetStateAction<VoiceSettings>>;
	updateSettings: (patch: Partial<VoiceSettings>) => void;
	loadFromServer: () => Promise<void>;
	saveToServer: (s?: VoiceSettings) => Promise<void>;
	loading: boolean;
	saving: boolean;
}

const VoiceSettingsContext = createContext<VoiceSettingsContextValue | null>(
	null
);

const LEGACY_VOICE_SETTINGS_KEY = 'liveVoice_widget_settings';

function loadFromLocalStorage(): VoiceSettings {
	try {
		let raw = localStorage.getItem(VOICE_SETTINGS_STORAGE_KEY);
		if (!raw && typeof localStorage !== 'undefined') {
			const legacy = localStorage.getItem(LEGACY_VOICE_SETTINGS_KEY);
			if (legacy) {
				localStorage.setItem(VOICE_SETTINGS_STORAGE_KEY, legacy);
				localStorage.removeItem(LEGACY_VOICE_SETTINGS_KEY);
				raw = legacy;
			}
		}
		if (raw) {
			const parsed = JSON.parse(raw) as Partial<VoiceSettings>;
			return {
				...DEFAULT_VOICE_SETTINGS,
				...parsed,
				voice:
					typeof parsed.voice === 'string'
						? parsed.voice
						: DEFAULT_VOICE_SETTINGS.voice,
				language:
					typeof parsed.language === 'string'
						? parsed.language
						: DEFAULT_VOICE_SETTINGS.language,
				llamaModel:
					typeof parsed.llamaModel === 'string'
						? parsed.llamaModel
						: DEFAULT_VOICE_SETTINGS.llamaModel,
				whisperModel:
					typeof parsed.whisperModel === 'string'
						? parsed.whisperModel
						: DEFAULT_VOICE_SETTINGS.whisperModel,
				speed:
					typeof parsed.speed === 'number'
						? parsed.speed
						: DEFAULT_VOICE_SETTINGS.speed,
				volume:
					typeof parsed.volume === 'number'
						? parsed.volume
						: DEFAULT_VOICE_SETTINGS.volume,
				enableArlekina:
					typeof parsed.enableArlekina === 'boolean'
						? parsed.enableArlekina
						: DEFAULT_VOICE_SETTINGS.enableArlekina,
			};
		}
	} catch (e) {
		log.warn(
			'VoiceSettingsContext',
			'Failed to load from localStorage',
			e instanceof Error ? e : new Error(String(e))
		);
	}
	return { ...DEFAULT_VOICE_SETTINGS };
}

function saveToLocalStorage(settings: VoiceSettings): void {
	try {
		localStorage.setItem(VOICE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
	} catch (e) {
		log.warn(
			'VoiceSettingsContext',
			'Failed to save to localStorage',
			e instanceof Error ? e : new Error(String(e))
		);
	}
}

export function VoiceSettingsProvider({
	children,
}: {
	children: ReactNode;
}): React.ReactElement {
	const [settings, setSettings] = useState<VoiceSettings>(loadFromLocalStorage);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	const loadFromServer = useCallback(async (): Promise<void> => {
		setLoading(true);
		try {
			const { ensureDesktopShellBootstrap } = await import(
				'@/pages/Desktop/services/desktopShellBootstrap'
			);
			// Yield to desktop cold bootstrap single-flight before voice settings GET.
			await ensureDesktopShellBootstrap();
			const response = await apiClient.get<VoiceSettingsApi>(SETTINGS_API);
			const next = apiToVoiceSettings(response.data, DEFAULT_VOICE_SETTINGS);
			setSettings(next);
			saveToLocalStorage(next);
			broadcastVoiceSettingsChanged(next);
		} catch (e) {
			const is404 = e instanceof APIError && e.statusCode === 404;
			if (!is404) {
				log.warn(
					'VoiceSettingsContext',
					'Failed to load settings from server',
					e instanceof Error ? e : new Error(String(e))
				);
			}
			setSettings(loadFromLocalStorage());
		} finally {
			setLoading(false);
		}
	}, []);

	const saveToServer = useCallback(
		async (s?: VoiceSettings): Promise<void> => {
			const toSave = s ?? settings;
			setSaving(true);
			try {
				await apiClient.put(SETTINGS_API, voiceSettingsToApi(toSave));
				saveToLocalStorage(toSave);
				broadcastVoiceSettingsChanged(toSave);
				if (typeof window !== 'undefined') {
					window.dispatchEvent(
						new CustomEvent(LIVE_VOICE_SETTINGS_SAVED_EVENT)
					);
				}
			} catch (e) {
				log.error(
					'VoiceSettingsContext',
					'Failed to save settings to server',
					e instanceof Error ? e : new Error(String(e))
				);
				saveToLocalStorage(toSave);
				throw e;
			} finally {
				setSaving(false);
			}
		},
		[settings]
	);

	const updateSettings = useCallback((patch: Partial<VoiceSettings>): void => {
		setSettings((prev) => {
			const next = { ...prev, ...patch };
			saveToLocalStorage(next);
			broadcastVoiceSettingsChanged(next);
			return next;
		});
	}, []);

	useEffect(() => {
		if (!authSession.authenticated) {
			setLoading(false);
			return;
		}
		void loadFromServer();
	}, [loadFromServer]);

	const value = useMemo<VoiceSettingsContextValue>(
		() => ({
			settings,
			setSettings,
			updateSettings,
			loadFromServer,
			saveToServer,
			loading,
			saving,
		}),
		[settings, updateSettings, loadFromServer, saveToServer, loading, saving]
	);

	return (
		<VoiceSettingsContext.Provider value={value}>
			{children}
		</VoiceSettingsContext.Provider>
	);
}

export function useVoiceSettings(): VoiceSettingsContextValue {
	const ctx = useContext(VoiceSettingsContext);
	if (ctx == null) {
		throw new Error(
			'useVoiceSettings must be used within VoiceSettingsProvider'
		);
	}
	return ctx;
}

/** Optional hook: returns null if outside provider (for gradual migration). */
export function useVoiceSettingsOptional(): VoiceSettingsContextValue | null {
	return useContext(VoiceSettingsContext);
}
