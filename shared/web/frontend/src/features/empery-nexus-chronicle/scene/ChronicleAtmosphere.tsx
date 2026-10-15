/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Chapter-driven fog/light wash inside the R3F tree.
 *
 * Related:
 * - ChronicleSceneContext chapterId
 */

import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import type { Fog, DirectionalLight } from 'three';
import { useChronicleScene } from '../ChronicleSceneContext';

const FOG: Record<string, { near: number; far: number; color: string }> = {
	husk: { near: 7, far: 26, color: '#05070c' },
	word: { near: 8, far: 28, color: '#061018' },
	constellation: { near: 9, far: 30, color: '#070a10' },
	sovereignty: { near: 6, far: 24, color: '#0a0c12' },
};

export function ChronicleAtmosphere() {
	const { chapterId, pulse } = useChronicleScene();
	const scene = useThree((s) => s.scene);
	const lightRef = useRef<DirectionalLight>(null);

	useFrame(() => {
		const fog = scene.fog as Fog | null;
		const cfg = FOG[chapterId] ?? FOG.husk;
		if (fog) {
			fog.near = cfg.near;
			fog.far = cfg.far;
			fog.color.set(cfg.color);
		}
		if (lightRef.current) {
			lightRef.current.intensity = 0.5 + pulse * 0.55;
		}
	});

	return (
		<directionalLight
			ref={lightRef}
			position={[6, 8, 4]}
			intensity={0.55}
			color="#d4e0ea"
		/>
	);
}
