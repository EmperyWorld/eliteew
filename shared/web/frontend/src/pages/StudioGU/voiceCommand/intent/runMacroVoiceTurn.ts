import type { VoiceMacro } from '../macros/voiceMacros';
import type { VoiceMessage } from '../types';

export interface RunMacroVoiceTurnParams {
	transcript: string;
	macro: VoiceMacro;
	soundFeedback: boolean;
	recordCommandInHistory: (
		transcript: string,
		status: 'success' | 'error' | 'cancelled',
		responseText?: string,
		commandId?: string,
		params?: Record<string, string>
	) => void;
	addMessage: (msg: Omit<VoiceMessage, 'id' | 'timestamp'>) => void;
	runMacro: (macro: VoiceMacro) => Promise<void>;
	speakText: (text: string) => Promise<void>;
}

export async function runMacroVoiceTurn(
	params: RunMacroVoiceTurnParams
): Promise<void> {
	const { transcript, macro } = params;
	params.recordCommandInHistory(
		transcript,
		'success',
		`Макрос «${macro.name}» выполнен.`
	);
	params.addMessage({
		type: 'command',
		text: `Макрос «${macro.name}» выполнен.`,
		command: transcript,
		status: 'success',
	});
	await params.runMacro(macro);
	if (params.soundFeedback) {
		await params.speakText(`Выполнен макрос: ${macro.name}`);
	}
}
