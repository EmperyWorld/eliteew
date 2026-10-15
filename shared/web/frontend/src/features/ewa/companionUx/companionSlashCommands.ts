/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Slash-command autocomplete for companion composer (U6.10).
 *
 * Invariants:
 * - Suggestions are client-side templates; sending still goes through normal chat turn.
 *
 * Related:
 * - documentation/product/ewa/EWA-COMPANION-QUICK-INTENTS.md
 */

export type CompanionSlashCommand = {
	command: string;
	labelKey: string;
	promptKey: string;
};

export const COMPANION_SLASH_COMMANDS: readonly CompanionSlashCommand[] = [
	{
		command: '/music',
		labelKey: 'ewaCompanion.slashMusicLabel',
		promptKey: 'ewaCompanion.quickPresetDefaults.musicGenerate.prompt',
	},
	{
		command: '/file',
		labelKey: 'ewaCompanion.slashFileLabel',
		promptKey: 'ewaCompanion.quickPresetDefaults.documentList.prompt',
	},
	{
		command: '/image',
		labelKey: 'ewaCompanion.slashImageLabel',
		promptKey: 'ewaCompanion.quickPresetDefaults.imageGenerate.prompt',
	},
] as const;

export function matchCompanionSlashCommands(
	draft: string
): CompanionSlashCommand[] {
	const trimmed = draft.trim();
	if (!trimmed.startsWith('/')) return [];
	const token = trimmed.split(/\s/u)[0]?.toLowerCase() ?? '';
	if (!token || token === '/') {
		return [...COMPANION_SLASH_COMMANDS];
	}
	return COMPANION_SLASH_COMMANDS.filter((row) =>
		row.command.startsWith(token)
	);
}
