/**
 * Command guards: which commands require confirmation or are destructive.
 * Used before execution to show confirm dialog when needed.
 */

import { getCommandById } from './commandCatalog';

export function requiresConfirmation(commandId: string): boolean {
	const cmd = getCommandById(commandId);
	return cmd?.requiresConfirmation === true;
}

export function isDestructive(commandId: string): boolean {
	const cmd = getCommandById(commandId);
	return cmd?.destructive === true;
}

export function isReversible(commandId: string): boolean {
	if (commandId === 'minimize_all' || commandId === 'show_desktop') {
		return true;
	}
	const cmd = getCommandById(commandId);
	return cmd?.id?.startsWith('open_') === true;
}
