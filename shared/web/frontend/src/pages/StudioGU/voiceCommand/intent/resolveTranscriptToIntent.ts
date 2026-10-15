/**
 * Единая цепочка: локальный parse → макрос → map-intent.
 * Используется и HTTP process, и WebSocket transcript.
 */

import { api } from '@/services/api/client';
import type { VoiceMacro } from '../macros/voiceMacros';
import { findMacroByTranscript } from '../macros/voiceMacros';
import { getCommandById, parseCommand } from '../engine';

export type TranscriptIntent =
	| { kind: 'macro'; macro: VoiceMacro }
	| { kind: 'disambiguate'; intent: string; candidates: string[] }
	| { kind: 'command'; commandId: string; params?: Record<string, string> }
	| { kind: 'conversation' };

export async function resolveTranscriptToIntent(
	transcript: string,
	macros: VoiceMacro[]
): Promise<TranscriptIntent> {
	let parsed = parseCommand(transcript);
	if (!parsed && transcript.trim().length > 0) {
		const macro = findMacroByTranscript(transcript, macros);
		if (macro) return { kind: 'macro', macro };
		try {
			const mapData = await api.post<{ command_id?: string }>(
				'/api/v1/voice-gateway/map-intent',
				{ transcript: transcript.trim() }
			);
			const commandId = mapData?.command_id;
			if (typeof commandId === 'string' && getCommandById(commandId)) {
				parsed = { commandId };
			}
		} catch {
			// fall through to conversation
		}
	}
	if (parsed && 'ambiguous' in parsed && parsed.ambiguous) {
		return {
			kind: 'disambiguate',
			intent: parsed.intent,
			candidates: parsed.candidates,
		};
	}
	if (parsed && 'commandId' in parsed) {
		return {
			kind: 'command',
			commandId: parsed.commandId,
			params: parsed.params,
		};
	}
	return { kind: 'conversation' };
}
