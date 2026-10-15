/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Domain constellation orbiting the Nexus; visibility weighted by reality layer + pulse.
 *
 * Invariants:
 * - Nodes mutate via useMutationPulse; links brighten on pulse.
 * - Pointer down selects domain for HUD inspector (does not emit Nexus pulse).
 *
 * Related:
 * - data/chronicleManifest.ts
 */

import { EMPERY_NEXUS_CHRONICLE_NS } from '@/i18n/namespaces';
import { Html, Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Group, Mesh } from 'three';
import * as THREE from 'three';
import { useChronicleScene } from '../ChronicleSceneContext';
import {
	CHRONICLE_MANIFEST,
	type ChronicleDomain,
	type RealityLayerId,
} from '../data/chronicleManifest';
import { useMutationPulse } from '../motion/useMutationPulse';

function DomainNode({
	domain,
	index,
}: {
	domain: ChronicleDomain;
	index: number;
}) {
	const meshRef = useRef<Mesh>(null);
	const { t } = useTranslation(EMPERY_NEXUS_CHRONICLE_NS);
	const { layer, pulse, selectedDomainId, focusDomain } = useChronicleScene();
	const { scaleMul, phaseDrift } = useMutationPulse(index + 1);
	const size = 0.18 + Math.log10(domain.linesOfCode) * 0.045;
	const selected = selectedDomainId === domain.id;
	const layerBoost = layerEmphasis(domain.layer, layer);

	useFrame((state) => {
		const time = state.clock.elapsedTime;
		const mesh = meshRef.current;
		if (!mesh) return;
		const angle = domain.phase + time * 0.12 + phaseDrift.current;
		const r = domain.orbit * (1 + pulse * 0.05);
		mesh.position.set(
			Math.cos(angle) * r,
			Math.sin(angle * 0.7) * 0.55,
			Math.sin(angle) * r
		);
		const s =
			size *
			scaleMul.current *
			(0.85 + layerBoost * 0.35 + pulse * 0.15 + (selected ? 0.25 : 0));
		mesh.scale.setScalar(s / size);
		const mat = mesh.material as THREE.MeshStandardMaterial;
		mat.emissiveIntensity =
			0.35 + layerBoost * 0.9 + pulse * 1.2 + (selected ? 0.8 : 0);
		mat.opacity =
			0.35 + layerBoost * 0.55 + pulse * 0.2 + (selected ? 0.15 : 0);
	});

	return (
		<mesh
			ref={meshRef}
			onPointerDown={(e) => {
				e.stopPropagation();
				focusDomain(selectedDomainId === domain.id ? null : domain.id);
			}}
		>
			<sphereGeometry args={[size, 24, 24]} />
			<meshStandardMaterial
				color={domain.accent}
				emissive={domain.accent}
				emissiveIntensity={0.5}
				metalness={0.7}
				roughness={0.3}
				transparent
				opacity={0.85}
			/>
			<Html
				distanceFactor={10}
				style={{
					pointerEvents: 'none',
					transform: 'translate(-50%, -140%)',
					whiteSpace: 'nowrap',
					fontFamily: 'Manrope, sans-serif',
					fontSize: '11px',
					letterSpacing: '0.08em',
					color: selected ? 'rgba(201,162,39,0.95)' : 'rgba(232,238,244,0.85)',
					textShadow: '0 0 12px rgba(0,0,0,0.8)',
					opacity: 0.55 + layerBoost * 0.45 + (selected ? 0.35 : 0),
				}}
			>
				{t(`domains.${domain.id}.label`)}
			</Html>
		</mesh>
	);
}

function layerEmphasis(
	domainLayer: RealityLayerId,
	active: RealityLayerId
): number {
	if (domainLayer === active) return 1;
	if (active === 'soul') return 0.55;
	if (active === 'muscle' && domainLayer !== 'mask') return 0.7;
	return 0.25;
}

export function DomainConstellation() {
	const groupRef = useRef<Group>(null);
	const { pulse, selectedDomainId } = useChronicleScene();
	const domains = CHRONICLE_MANIFEST.domains;

	const linkPoints = useMemo(() => {
		return domains.map((d) => {
			const angle = d.phase;
			const r = d.orbit;
			return new THREE.Vector3(
				Math.cos(angle) * r,
				Math.sin(angle * 0.7) * 0.55,
				Math.sin(angle) * r
			);
		});
	}, []);

	useFrame((_, delta) => {
		if (groupRef.current) {
			groupRef.current.rotation.y += delta * 0.04;
		}
	});

	return (
		<group ref={groupRef}>
			{domains.map((domain, index) => (
				<DomainNode key={domain.id} domain={domain} index={index} />
			))}
			{linkPoints.map((p, i) => {
				const id = domains[i]?.id;
				const focused = id != null && selectedDomainId === id;
				return (
					<Line
						key={`link-${id ?? i}`}
						points={[new THREE.Vector3(0, 0, 0), p]}
						color={focused ? '#c9a227' : '#8fa3b5'}
						lineWidth={focused ? 2.2 : 1}
						transparent
						opacity={focused ? 0.55 + pulse * 0.25 : 0.12 + pulse * 0.35}
					/>
				);
			})}
		</group>
	);
}
