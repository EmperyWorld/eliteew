/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Motion camera dolly between reality layers (Mask / Muscle / Soul).
 *
 * Invariants:
 * - Camera z is animated toward layer target; no hard jumps.
 *
 * Related:
 * - scene/RealityLayers.tsx
 */

import { useThree } from '@react-three/fiber';
import { animate } from 'framer-motion';
import { useEffect } from 'react';
import {
	CHRONICLE_MANIFEST,
	type RealityLayerId,
} from '../data/chronicleManifest';

export function useLayerTransition(layer: RealityLayerId) {
	const camera = useThree((s) => s.camera);

	useEffect(() => {
		const target =
			CHRONICLE_MANIFEST.layers.find((l) => l.id === layer)?.cameraZ ?? 8;
		const transition = animate(camera.position.z, target, {
			duration: 1.35,
			ease: 'easeInOut',
			onUpdate: (value) => {
				camera.position.z = value;
				camera.lookAt(0, 0, 0);
			},
		});
		return () => {
			transition.stop();
		};
	}, [layer, camera]);
}
