/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Map FastAPI/axios errors from voice-gateway to localized user-facing text.
 *
 * Related:
 * - `VoiceCommandCenter.tsx`, `desktopUi.voiceCommand.gatewayErrors`
 */

import axios from 'axios';
import type { VoiceCommandT } from './utils/voiceCommandI18n';

/** Map FastAPI/axios errors from voice-gateway to user-facing text. */
export function voiceGatewayErrorMessage(
	err: unknown,
	t?: VoiceCommandT
): string {
	const gt = (
		key: 'generic' | 'server500' | 'badRequest400',
		params?: Record<string, string>
	) =>
		t?.(`gatewayErrors.${key}` as never, params) ??
		{
			generic: 'Voice processing error',
			server500:
				'Server error (500). Check API logs for speech recognition or cache issues.',
			badRequest400:
				'The server rejected the request. Check that the recording is not empty and the microphone is enabled.',
		}[key];

	if (!axios.isAxiosError(err) || err.response == null) {
		return err instanceof Error ? err.message : gt('generic');
	}
	const status = err.response.status;
	const raw = err.response.data;
	let detail = err.response.statusText || '';

	const applyBody = (errBody: unknown): void => {
		if (!errBody || typeof errBody !== 'object') return;
		const b = errBody as Record<string, unknown>;
		if (typeof b.detail === 'string') {
			detail = b.detail;
		} else if (
			Array.isArray(b.detail) &&
			b.detail[0] &&
			typeof (b.detail[0] as { msg?: string }).msg === 'string'
		) {
			detail = (b.detail[0] as { msg: string }).msg;
		} else if (
			b.detail &&
			typeof b.detail === 'object' &&
			'msg' in (b.detail as object)
		) {
			detail = String((b.detail as { msg: string }).msg);
		}
	};

	if (typeof raw === 'string') {
		try {
			const errBody = raw ? JSON.parse(raw) : {};
			applyBody(errBody);
		} catch {
			if (raw.length < 200) detail = raw;
		}
	} else {
		applyBody(raw);
	}

	if (status === 500 && (detail === 'Internal Server Error' || !detail)) {
		detail = gt('server500');
	}
	if (status === 400 && (detail === 'Bad Request' || !detail)) {
		detail = gt('badRequest400');
	}
	if (!detail) {
		return (
			t?.('gatewayErrors.transcriptionFailed' as never, {
				status: String(status),
			}) ?? `Transcription failed (${status})`
		);
	}
	return detail;
}
