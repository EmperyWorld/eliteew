/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared React context for Empery Nexus Chronicle scene/HUD coordination.
 *
 * Invariants:
 * - Pulse, layer, chapter, and selected domain are the cross-tree scene signals.
 * - Focusing a domain syncs reality layer to that domain's layer.
 *
 * Related:
 * - EmperyNexusChroniclePage.tsx
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { ChronicleChapterId } from './data/chronicleChapters';
import type {
	ChronicleDomainId,
	RealityLayerId,
} from './data/chronicleManifest';

export type ChronicleSceneApi = {
	layer: RealityLayerId;
	setLayer: (layer: RealityLayerId) => void;
	pulse: number;
	emitPulse: () => void;
	rebirthKey: number;
	replayRebirth: () => void;
	selectedDomainId: ChronicleDomainId | null;
	setSelectedDomainId: (id: ChronicleDomainId | null) => void;
	/** Focus domain and sync reality layer to the domain's layer. */
	focusDomain: (id: ChronicleDomainId | null) => void;
	cycleDomain: (direction: 1 | -1) => void;
	chapterId: ChronicleChapterId;
	setChapterId: (id: ChronicleChapterId) => void;
	cycleChapter: (direction: 1 | -1) => void;
};

const ChronicleSceneContext = createContext<ChronicleSceneApi | null>(null);

export function ChronicleSceneProvider({
	value,
	children,
}: {
	value: ChronicleSceneApi;
	children: ReactNode;
}) {
	return (
		<ChronicleSceneContext.Provider value={value}>
			{children}
		</ChronicleSceneContext.Provider>
	);
}

export function useChronicleScene(): ChronicleSceneApi {
	const ctx = useContext(ChronicleSceneContext);
	if (!ctx) {
		throw new Error('useChronicleScene requires ChronicleSceneProvider');
	}
	return ctx;
}
