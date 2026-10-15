/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Curated idea starter chips for MusicForge create form.
 *
 * Related:
 * - MusicForgeIdeaStarters.tsx
 */

export type MusicForgeIdeaPreset = {
	id: string;
	labelKey: string;
	ideaKey: string;
};

export const MUSIC_FORGE_IDEA_STARTER_PRESETS: MusicForgeIdeaPreset[] = [
	{
		id: 'summer-yard',
		labelKey: 'musicForge.ideaStarters.summerYard.label',
		ideaKey: 'musicForge.ideaStarters.summerYard.idea',
	},
	{
		id: 'night-drive',
		labelKey: 'musicForge.ideaStarters.nightDrive.label',
		ideaKey: 'musicForge.ideaStarters.nightDrive.idea',
	},
	{
		id: 'friendship-ballad',
		labelKey: 'musicForge.ideaStarters.friendshipBallad.label',
		ideaKey: 'musicForge.ideaStarters.friendshipBallad.idea',
	},
];
