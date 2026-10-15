/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Isolated AI stream buffers for Professional Worlds listings, brand snippets, and learning coach output.
 *
 * Invariants:
 * - Each lane has independent text/status so tab switches do not clobber unrelated previews.
 * - Callers decide which lane to write; copying reads the lane that matches the active surface.
 *
 * Related:
 * - ProfessionalWorldsApp.tsx
 */

import { useCallback, useState } from 'react';

export type ProfessionalWorldsAiStreamLane = 'listing' | 'brand' | 'learning';

export type AiStreamLaneState = {
	text: string;
	status: string;
};

const emptyLane = (): AiStreamLaneState => ({ text: '', status: '' });

export function useProfessionalWorldsAiStreams() {
	const [listingStream, setListingStream] =
		useState<AiStreamLaneState>(emptyLane);
	const [brandStream, setBrandStream] = useState<AiStreamLaneState>(emptyLane);
	const [learningStream, setLearningStream] =
		useState<AiStreamLaneState>(emptyLane);

	const patchLane = useCallback(
		(
			lane: ProfessionalWorldsAiStreamLane,
			patch: Partial<AiStreamLaneState>
		) => {
			switch (lane) {
				case 'listing':
					setListingStream((p) => ({ ...p, ...patch }));
					break;
				case 'brand':
					setBrandStream((p) => ({ ...p, ...patch }));
					break;
				case 'learning':
					setLearningStream((p) => ({ ...p, ...patch }));
					break;
			}
		},
		[]
	);

	const setLaneText = useCallback(
		(lane: ProfessionalWorldsAiStreamLane, text: string) => {
			patchLane(lane, { text });
		},
		[patchLane]
	);

	const setLaneStatus = useCallback(
		(lane: ProfessionalWorldsAiStreamLane, status: string) => {
			patchLane(lane, { status });
		},
		[patchLane]
	);

	return {
		listingStream,
		brandStream,
		learningStream,
		setLaneText,
		setLaneStatus,
		setListingStream,
		setBrandStream,
		setLearningStream,
	};
}
