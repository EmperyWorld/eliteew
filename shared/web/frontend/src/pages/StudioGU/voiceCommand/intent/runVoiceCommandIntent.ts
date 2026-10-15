import type { Dispatch, SetStateAction } from 'react';
import {
	executeCommand,
	requiresConfirmation,
	type ExecutionResult,
} from '../engine';
import type { VoiceMessage } from '../types';

export interface RunVoiceCommandIntentParams {
	transcript: string;
	commandId: string;
	params?: Record<string, string>;
	soundFeedback: boolean;
	recordCommandInHistory: (
		transcript: string,
		status: 'success' | 'error' | 'cancelled',
		responseText?: string,
		commandId?: string,
		params?: Record<string, string>
	) => void;
	addMessage: (msg: Omit<VoiceMessage, 'id' | 'timestamp'>) => void;
	setMessages: Dispatch<SetStateAction<VoiceMessage[]>>;
	speakText: (text: string) => Promise<void>;
	resolveResponse: (result: ExecutionResult) => string;
	cancelledMessage: string;
	/** In-app confirm for reversible commands; return false to cancel. */
	requestConfirm?: (transcript: string) => Promise<boolean>;
	/** Already confirmed (e.g. disambiguation pick) — skip confirm dialog. */
	skipUserConfirm?: boolean;
}

/**
 * Confirm (if needed), execute, history, message bubble, optional TTS.
 */
export async function runVoiceCommandIntent(
	p: RunVoiceCommandIntentParams
): Promise<void> {
	let doExecute = true;
	if (p.skipUserConfirm !== true && requiresConfirmation(p.commandId)) {
		doExecute = (await p.requestConfirm?.(p.transcript)) ?? false;
	}
	if (!doExecute) {
		p.recordCommandInHistory(p.transcript, 'cancelled');
		p.addMessage({
			type: 'system',
			text: p.cancelledMessage,
		});
		return;
	}
	const execResult = executeCommand(p.commandId, p.params);
	const responseText = p.resolveResponse(execResult);
	p.recordCommandInHistory(
		p.transcript,
		execResult.status,
		responseText,
		p.commandId,
		p.params
	);
	if (execResult.sideEffect === 'clear_messages') {
		p.setMessages([]);
	}
	p.addMessage({
		type: 'command',
		text: responseText,
		command: p.transcript,
		status: execResult.status,
	});
	if (p.soundFeedback) {
		await p.speakText(responseText);
	}
}
