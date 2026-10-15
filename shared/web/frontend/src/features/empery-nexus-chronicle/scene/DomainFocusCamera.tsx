/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Ease camera toward selected domain star for living-atlas depth.
 *
 * Invariants:
 * - When no domain selected, returns lookAt origin; does not fight layer Z hard.
 *
 * Related:
 * - scene/DomainConstellation.tsx
 */

import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useChronicleScene } from '../ChronicleSceneContext';
import { findChronicleDomain } from '../data/chronicleManifest';

export function DomainFocusCamera() {
	const { selectedDomainId, pulse } = useChronicleScene();
	const camera = useThree((s) => s.camera);
	const look = useRef(new THREE.Vector3(0, 0, 0));
	const targetLook = useMemo(() => new THREE.Vector3(), []);

	useFrame((_, delta) => {
		const domain = findChronicleDomain(selectedDomainId);
		if (domain) {
			const angle = domain.phase;
			const r = domain.orbit * (1 + pulse * 0.05);
			targetLook.set(
				Math.cos(angle) * r * 0.35,
				Math.sin(angle * 0.7) * 0.2,
				Math.sin(angle) * r * 0.35
			);
		} else {
			targetLook.set(0, 0, 0);
		}
		look.current.lerp(targetLook, Math.min(1, delta * 2.2));
		camera.lookAt(look.current);
	});

	return null;
}
