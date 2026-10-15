/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Reality-layer camera controller mounted inside the R3F tree.
 *
 * Invariants:
 * - Must render as a child of Canvas.
 *
 * Related:
 * - motion/useLayerTransition.ts
 */

import { useChronicleScene } from '../ChronicleSceneContext';
import { useLayerTransition } from '../motion/useLayerTransition';

export function RealityLayers() {
	const { layer } = useChronicleScene();
	useLayerTransition(layer);
	return null;
}
