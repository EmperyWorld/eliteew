/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Голосовой Штаб: composer — health + session hooks, then shell or null for backgroundOnly.
 *
 * Invariants:
 * - Hooks run before `backgroundOnly` early return (Desktop on-demand engine stays live).
 * - TTS playback normalization lives in `hooks/useVoiceCommandSession.ts`.
 *
 * Related:
 * - `hooks/useVoiceCommandHealth.ts`, `hooks/useVoiceCommandSession.ts`, `components/VoiceCommandShell.tsx`
 */

import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DEFAULT_VOICE_SETTINGS, useVoiceSettingsOptional } from '@/voice-core';
import { log } from '@/utils/logger';
import { useTranslation } from 'react-i18next';
import { useDesktopVoiceOptional } from '@/pages/Desktop/context/DesktopVoiceContext';
import { useDesktopGuideTourOpener } from '@/pages/Desktop/hooks/useDesktopGuideTourOpener';
import { VoiceCommandShell } from './components/VoiceCommandShell';
import { useVoiceCommandHealth } from './hooks/useVoiceCommandHealth';
import { useVoiceCommandSession } from './hooks/useVoiceCommandSession';
import { loadVoiceCenterUI, saveVoiceCenterUI } from './storage';
import { VOICE_CENTER_UI_SYNC_EVENT } from './types';
import { resolveExecutionResponse } from './utils/voiceCommandI18n';

export interface VoiceCommandCenterProps {
	/** When true, only run pipeline (react to hot bar); render nothing. Used for background instance on Desktop. */
	backgroundOnly?: boolean;
	/** When true (Студия ГУ), hide duplicate page header — chrome is the window + parent tabs. */
	embeddedInStudio?: boolean;
	/** Вместе с {@link onGuideOpenChange} — кнопка «Экскурсия» в шапке Студии ГУ. */
	guideOpen?: boolean;
	onGuideOpenChange?: (open: boolean) => void;
}

export const VoiceCommandCenter: React.FC<VoiceCommandCenterProps> = ({
	backgroundOnly = false,
	embeddedInStudio = false,
	guideOpen: guideOpenProp,
	onGuideOpenChange,
}) => {
	const { t, i18n } = useTranslation('desktopUi', {
		keyPrefix: 'voiceCommand',
	});
	const resolveResponse = useCallback(
		(result: Parameters<typeof resolveExecutionResponse>[0]) =>
			resolveExecutionResponse(result, t, i18n.language),
		[t, i18n.language]
	);

	const voiceContext = useVoiceSettingsOptional();
	const persisted = voiceContext?.settings ?? DEFAULT_VOICE_SETTINGS;
	const [uiPrefs, setUiPrefs] = useState<{
		soundFeedback: boolean;
		autoListen: boolean;
		websocketMode: boolean;
		pushToTalk: boolean;
	}>(loadVoiceCenterUI);

	const settings = useMemo(
		() => ({
			language: persisted.language as 'ru' | 'en' | 'auto',
			ttsVoice: persisted.voice,
			llmModel: persisted.llamaModel,
			soundFeedback: uiPrefs.soundFeedback,
			autoListen: uiPrefs.autoListen,
			websocketMode: uiPrefs.websocketMode,
			pushToTalk: uiPrefs.pushToTalk,
		}),
		[
			persisted.language,
			persisted.voice,
			persisted.llamaModel,
			uiPrefs.soundFeedback,
			uiPrefs.autoListen,
			uiPrefs.websocketMode,
			uiPrefs.pushToTalk,
		]
	);

	const updatePersisted = useCallback(
		(patch: { language?: string; voice?: string; llamaModel?: string }) => {
			if (!voiceContext) return;
			voiceContext.updateSettings(patch);
			voiceContext.saveToServer().catch((err: unknown) => {
				log.warn(
					'VoiceCommandCenter',
					'live voice settings save failed',
					err instanceof Error ? err : undefined
				);
			});
		},
		[voiceContext]
	);

	const setSoundFeedback = useCallback((value: boolean) => {
		setUiPrefs((prev) => {
			const next = { ...prev, soundFeedback: value };
			saveVoiceCenterUI(next);
			return next;
		});
	}, []);

	const setWebsocketMode = useCallback((value: boolean) => {
		setUiPrefs((prev) => {
			const next = { ...prev, websocketMode: value };
			saveVoiceCenterUI(next);
			return next;
		});
	}, []);

	const setPushToTalk = useCallback((value: boolean) => {
		setUiPrefs((prev) => {
			const next = { ...prev, pushToTalk: value };
			saveVoiceCenterUI(next);
			return next;
		});
	}, []);

	useEffect(() => {
		const onSync = () => setUiPrefs(loadVoiceCenterUI());
		window.addEventListener(
			VOICE_CENTER_UI_SYNC_EVENT,
			onSync as EventListener
		);
		return () =>
			window.removeEventListener(
				VOICE_CENTER_UI_SYNC_EVENT,
				onSync as EventListener
			);
	}, []);

	const [internalGuideOpen, setInternalGuideOpen] = useState(false);
	const guideControlled =
		guideOpenProp !== undefined && onGuideOpenChange !== undefined;
	const showGuide = guideControlled
		? (guideOpenProp ?? false)
		: internalGuideOpen;
	const setShowGuide = useCallback(
		(v: boolean) => {
			if (guideControlled) onGuideOpenChange?.(v);
			else setInternalGuideOpen(v);
		},
		[guideControlled, onGuideOpenChange]
	);
	const openVoiceGuideTour = useCallback(() => {
		setShowGuide(true);
	}, [setShowGuide]);
	useDesktopGuideTourOpener(openVoiceGuideTour, {
		enabled: !embeddedInStudio && !backgroundOnly,
	});

	const { token } = useAuth();
	const desktopVoice = useDesktopVoiceOptional();

	const { serviceStatus } = useVoiceCommandHealth({ token, desktopVoice });

	const session = useVoiceCommandSession({
		settings,
		desktopVoice,
		t,
		resolveResponse,
	});

	if (backgroundOnly) {
		return null;
	}

	return (
		<VoiceCommandShell
			embeddedInStudio={embeddedInStudio}
			showGuide={showGuide}
			setShowGuide={setShowGuide}
			serviceStatus={serviceStatus}
			settings={settings}
			updatePersisted={updatePersisted}
			setSoundFeedback={setSoundFeedback}
			setWebsocketMode={setWebsocketMode}
			setPushToTalk={setPushToTalk}
			session={session}
		/>
	);
};

export default VoiceCommandCenter;
