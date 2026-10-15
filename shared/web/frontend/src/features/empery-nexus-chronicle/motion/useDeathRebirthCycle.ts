/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Motion-driven death/rebirth: corporeal husk dissolves while luminous Nexus crystallizes.
 *
 * Invariants:
 * - Mutable refs only; safe to read every frame from useFrame.
 *
 * Related:
 * - scene/NexusCore.tsx
 */

import { animate } from 'framer-motion';
import { useEffect, useRef } from 'react';

export function useDeathRebirthCycle(rebirthKey: number) {
	const huskOpacity = useRef(1);
	const coreScale = useRef(0.15);
	const ringSpin = useRef(0.15);

	// biome-ignore lint/correctness/useExhaustiveDependencies: rebirthKey is the intentional replay trigger
	useEffect(() => {
		huskOpacity.current = 1;
		coreScale.current = 0.15;
		ringSpin.current = 0.15;

		const animations = [
			animate(1, 0, {
				duration: 2.8,
				ease: 'easeInOut',
				onUpdate: (value) => {
					huskOpacity.current = value;
				},
			}),
			animate(0.15, 1, {
				delay: 0.6,
				duration: 2.2,
				ease: 'easeOut',
				onUpdate: (value) => {
					coreScale.current = value;
				},
			}),
			animate(0.15, 1.1, {
				delay: 0.8,
				duration: 3,
				ease: 'easeInOut',
				onUpdate: (value) => {
					ringSpin.current = value;
				},
			}),
		];

		return () => {
			for (const animation of animations) {
				animation.stop();
			}
		};
	}, [rebirthKey]);

	return { huskOpacity, coreScale, ringSpin };
}
