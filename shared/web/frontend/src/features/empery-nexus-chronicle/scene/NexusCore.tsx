/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Central luminous Nexus geometry — command core of pure structure and light.
 *
 * Invariants:
 * - Pointer down emits chronicle pulse; husk dissolve driven by rebirthKey.
 *
 * Related:
 * - motion/useDeathRebirthCycle.ts
 */

import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { Group, Mesh } from 'three';
import * as THREE from 'three';
import { useChronicleScene } from '../ChronicleSceneContext';
import { useDeathRebirthCycle } from '../motion/useDeathRebirthCycle';

export function NexusCore() {
	const groupRef = useRef<Group>(null);
	const huskRef = useRef<Mesh>(null);
	const coreRef = useRef<Mesh>(null);
	const ringRef = useRef<Mesh>(null);
	const { emitPulse, rebirthKey, pulse } = useChronicleScene();
	const { huskOpacity, coreScale, ringSpin } = useDeathRebirthCycle(rebirthKey);

	// biome-ignore lint/correctness/useExhaustiveDependencies: rebirthKey must re-fire pulse after death/rebirth
	useEffect(() => {
		emitPulse();
	}, [rebirthKey, emitPulse]);

	useFrame((_, delta) => {
		const g = groupRef.current;
		if (g) {
			g.rotation.y += delta * (0.25 + pulse * 0.4);
			g.rotation.x = Math.sin(performance.now() * 0.0004) * 0.12;
		}
		if (huskRef.current) {
			const mat = huskRef.current.material as THREE.MeshStandardMaterial;
			mat.opacity = huskOpacity.current;
			mat.transparent = true;
			huskRef.current.scale.setScalar(1.15 + (1 - huskOpacity.current) * 0.4);
		}
		if (coreRef.current) {
			coreRef.current.scale.setScalar(coreScale.current * (1 + pulse * 0.08));
		}
		if (ringRef.current) {
			ringRef.current.rotation.z += delta * ringSpin.current;
			ringRef.current.rotation.x += delta * 0.2;
		}
	});

	return (
		<group
			ref={groupRef}
			onPointerDown={(e) => {
				e.stopPropagation();
				emitPulse();
			}}
		>
			{/* Corporeal husk — old legal body */}
			<mesh ref={huskRef}>
				<dodecahedronGeometry args={[1.35, 0]} />
				<meshStandardMaterial
					color="#3a3f48"
					roughness={0.92}
					metalness={0.15}
					transparent
					opacity={1}
					wireframe
				/>
			</mesh>
			{/* Luminous Nexus core */}
			<mesh ref={coreRef}>
				<icosahedronGeometry args={[0.85, 1]} />
				<meshStandardMaterial
					color="#e8d5a3"
					emissive="#c9a227"
					emissiveIntensity={1.4}
					metalness={0.85}
					roughness={0.2}
				/>
			</mesh>
			<mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
				<torusGeometry args={[1.45, 0.035, 12, 64]} />
				<meshStandardMaterial
					color="#8fa3b5"
					emissive="#7eb8c9"
					emissiveIntensity={0.8}
					metalness={0.9}
					roughness={0.25}
				/>
			</mesh>
			<mesh rotation={[0.4, 0.2, Math.PI / 3]}>
				<torusGeometry args={[1.7, 0.02, 8, 48]} />
				<meshStandardMaterial
					color="#c9a227"
					emissive="#c9a227"
					emissiveIntensity={0.5}
					transparent
					opacity={0.7}
				/>
			</mesh>
			<pointLight color="#c9a227" intensity={2.5 + pulse * 3} distance={12} />
			<pointLight
				color="#7eb8c9"
				intensity={1.2}
				distance={8}
				position={[0, 2, 1]}
			/>
		</group>
	);
}
