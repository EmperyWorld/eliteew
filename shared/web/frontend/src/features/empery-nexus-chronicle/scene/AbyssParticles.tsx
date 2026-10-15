/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Dense particle abyss representing unorganized monorepo complexity.
 *
 * Invariants:
 * - Particle count derived from chronicleManifest budget helper.
 *
 * Related:
 * - data/chronicleManifest.ts
 */

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Points } from 'three';
import * as THREE from 'three';
import {
	CHRONICLE_MANIFEST,
	particleBudgetFromManifest,
} from '../data/chronicleManifest';
import { useChronicleScene } from '../ChronicleSceneContext';

export function AbyssParticles() {
	const pointsRef = useRef<Points>(null);
	const { pulse } = useChronicleScene();
	const count = particleBudgetFromManifest(CHRONICLE_MANIFEST);

	const { positions, colors } = useMemo(() => {
		const positions = new Float32Array(count * 3);
		const colors = new Float32Array(count * 3);
		const gold = new THREE.Color('#c9a227');
		const steel = new THREE.Color('#5a6d7e');
		for (let i = 0; i < count; i++) {
			const r = 2.5 + Math.random() * 14;
			const theta = Math.random() * Math.PI * 2;
			const phi = Math.acos(2 * Math.random() - 1);
			positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
			positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
			positions[i * 3 + 2] = r * Math.cos(phi);
			const c = Math.random() > 0.88 ? gold : steel;
			colors[i * 3] = c.r;
			colors[i * 3 + 1] = c.g;
			colors[i * 3 + 2] = c.b;
		}
		return { positions, colors };
	}, [count]);

	useFrame((_, delta) => {
		const pts = pointsRef.current;
		if (!pts) return;
		pts.rotation.y += delta * (0.02 + pulse * 0.08);
		pts.rotation.x += delta * 0.008;
		const mat = pts.material as THREE.PointsMaterial;
		mat.opacity = 0.28 + pulse * 0.45;
		mat.size = 0.028 + pulse * 0.03;
	});

	return (
		<points ref={pointsRef}>
			<bufferGeometry>
				<bufferAttribute attach="attributes-position" args={[positions, 3]} />
				<bufferAttribute attach="attributes-color" args={[colors, 3]} />
			</bufferGeometry>
			<pointsMaterial
				size={0.03}
				vertexColors
				transparent
				opacity={0.32}
				depthWrite={false}
				blending={THREE.AdditiveBlending}
				sizeAttenuation
			/>
		</points>
	);
}
