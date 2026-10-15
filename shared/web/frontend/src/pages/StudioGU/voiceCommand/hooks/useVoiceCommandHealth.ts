/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Health poll for voice-gateway STT/TTS and sync of service availability into DesktopVoiceContext.
 *
 * Invariants:
 * - Poll interval uses `DESKTOP_POLLING.VOICE_SERVICES_MS`; no poll when token is absent.
 *
 * Related:
 * - `VoiceCommandCenter.tsx`, `/api/v1/voice-gateway/health`
 */

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/services/api/client';
import { DESKTOP_POLLING } from '@/pages/Desktop/constants';
import type { DesktopVoiceContextValue } from '@/pages/Desktop/context/DesktopVoiceContext';
import type { ServiceStatus } from '../types';

export interface UseVoiceCommandHealthParams {
	token: string | null | undefined;
	desktopVoice: DesktopVoiceContextValue | null;
}

export interface UseVoiceCommandHealthReturn {
	serviceStatus: ServiceStatus;
	checkServicesStatus: () => Promise<void>;
}

export function useVoiceCommandHealth({
	token,
	desktopVoice,
}: UseVoiceCommandHealthParams): UseVoiceCommandHealthReturn {
	const [serviceStatus, setServiceStatus] = useState<ServiceStatus>({
		whisper: false,
		llama: false,
		tts: false,
	});

	const checkServicesStatus = useCallback(async () => {
		if (!token) return;

		try {
			const gateway = await api
				.get<{
					stt?: { status?: string };
					tts?: { configured?: boolean };
				}>('/api/v1/voice-gateway/health')
				.catch(() => null);
			if (!gateway) {
				setServiceStatus({ whisper: false, llama: false, tts: false });
				return;
			}
			const sttUp = gateway?.stt?.status === 'up';
			const ttsOk = gateway?.tts?.configured === true;

			setServiceStatus({
				whisper: sttUp,
				llama: sttUp && ttsOk,
				tts: ttsOk,
			});
		} catch {
			// ignore
		}
	}, [token]);

	useEffect(() => {
		checkServicesStatus();
		const interval = setInterval(
			checkServicesStatus,
			DESKTOP_POLLING.VOICE_SERVICES_MS
		);
		return () => clearInterval(interval);
	}, [checkServicesStatus]);

	useEffect(() => {
		if (!desktopVoice) return;
		desktopVoice.setVoiceCommandStatus({
			serviceAvailable: serviceStatus.whisper && serviceStatus.llama,
		});
	}, [desktopVoice, serviceStatus.whisper, serviceStatus.llama]);

	return { serviceStatus, checkServicesStatus };
}
