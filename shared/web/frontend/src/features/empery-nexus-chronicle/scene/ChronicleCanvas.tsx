/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * R3F Canvas host for Abyss, Nexus, domains, atmosphere, and postprocessing.
 *
 * Invariants:
 * - three/R3F/postprocessing imports stay inside this lazy chronicle chunk only.
 * - Postprocessing disabled when prefers-reduced-motion.
 *
 * Related:
 * - EmperyNexusChroniclePage.tsx
 */

import { Canvas } from '@react-three/fiber';
import {
	Bloom,
	ChromaticAberration,
	EffectComposer,
	Vignette,
} from '@react-three/postprocessing';
import { Stars } from '@react-three/drei';
import { Suspense } from 'react';
import { Vector2 } from 'three';
import { AbyssParticles } from './AbyssParticles';
import { ChronicleAtmosphere } from './ChronicleAtmosphere';
import { DomainConstellation } from './DomainConstellation';
import { DomainFocusCamera } from './DomainFocusCamera';
import { NexusCore } from './NexusCore';
import { RealityLayers } from './RealityLayers';

function prefersReducedMotion(): boolean {
	if (typeof window === 'undefined' || !window.matchMedia) return false;
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function ChronicleEffects() {
	if (prefersReducedMotion()) return null;
	return (
		<EffectComposer multisampling={0}>
			<Bloom
				intensity={0.55}
				luminanceThreshold={0.35}
				luminanceSmoothing={0.7}
				mipmapBlur
			/>
			<Vignette offset={0.25} darkness={0.65} />
			<ChromaticAberration
				offset={new Vector2(0.0006, 0.0006)}
				radialModulation={false}
				modulationOffset={0}
			/>
		</EffectComposer>
	);
}

export function ChronicleCanvas() {
	const reduced = prefersReducedMotion();
	return (
		<Canvas
			className="empery-nexus-chronicle__canvas-host"
			dpr={[1, 1.75]}
			camera={{ position: [0, 1.2, 11], fov: 48, near: 0.1, far: 80 }}
			gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
			style={{ position: 'absolute', inset: 0 }}
		>
			<color attach="background" args={['#03050a']} />
			<fog attach="fog" args={['#03050a', 8, 28]} />
			<ambientLight intensity={0.22} />
			<Suspense fallback={null}>
				{reduced ? null : (
					<Stars
						radius={48}
						depth={36}
						count={900}
						factor={2.4}
						saturation={0}
						fade
						speed={0.15}
					/>
				)}
				<AbyssParticles />
				<DomainConstellation />
				<NexusCore />
				<RealityLayers />
				<DomainFocusCamera />
				<ChronicleAtmosphere />
				<ChronicleEffects />
			</Suspense>
		</Canvas>
	);
}
