/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * React state for global guided-tour narrator voice (po&T / TZBrand).
 *
 * Related:
 * - guideTourVoicePreference.ts, GuideTourVoiceSelector.tsx
 */

import { useCallback, useState } from 'react';
import {
	type GuideTourVoiceKey,
	readGuideTourVoicePreference,
	writeGuideTourVoicePreference,
} from '@/components/guided-tour/guideTourVoicePreference';

export function useGuideTourVoicePreference(): [
	GuideTourVoiceKey,
	(voice: GuideTourVoiceKey) => void,
] {
	const [voice, setVoiceState] = useState<GuideTourVoiceKey>(() =>
		readGuideTourVoicePreference()
	);

	const setVoice = useCallback((next: GuideTourVoiceKey) => {
		setVoiceState(next);
		writeGuideTourVoicePreference(next);
	}, []);

	return [voice, setVoice];
}
